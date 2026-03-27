// NostrTransport — Nostr WebSocket transport layer for Spore Protocol.
//
// Replaces the gRPC transport of XMTP with Nostr relay WebSocket connections.
// Handles:
//   - Sending encrypted DMs via NIP-17 Gift Wrap (kind:1059)
//   - Sending/receiving group messages (kind:11 open / kind:14 encrypted)
//   - Subscribing to incoming DMs and group events for a given pubkey
//   - Building and signing Nostr events

import {
    finalizeEvent,
    generateSecretKey,
    verifyEvent,
    type NostrEvent,
    type EventTemplate,
} from 'nostr-tools';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex as nobleBytesToHex } from '@noble/hashes/utils';
import { RelayPool } from '../relay/RelayPool.js';
import * as crypto from '../crypto/Nip44Crypto.js';
import type { SporeConversation, SporeMessage, SignedNostrEvent } from '../types.js';

// Nostr event kinds used by Spore Protocol
export const KIND_GIFT_WRAP = 1059;  // NIP-17 outer gift wrap (DM)
export const KIND_SEAL = 13;         // NIP-17 inner seal
export const KIND_RUMOR = 14;        // NIP-17 plaintext rumor (direct message rumor)
export const KIND_METADATA = 0;      // NIP-01 profile metadata
export const KIND_RELAY_LIST = 10050; // NIP-65 relay list

// NIP-29 Group Management event kinds
export const KIND_GROUP_META = 9000;    // Group metadata (name, picture, description)
export const KIND_GROUP_ADD = 9001;     // Add member(s) to group
export const KIND_GROUP_REMOVE = 9002;  // Remove member(s) from group

export interface SendDmOptions {
    senderPrivkeyHex: string;
    senderPubkeyHex: string;
    recipientPubkeyHex: string;
    content: string;
    replyToId?: string;
}

export interface SendGroupMessageOptions {
    senderPrivkeyHex: string;
    senderPubkeyHex: string;
    groupId: string;
    memberPubkeys: string[];
    content: string;
    replyToId?: string;
}

/** Options for group metadata creation (kind:9000) */
export interface SendGroupMetaOptions {
    senderPrivkeyHex: string;
    groupId: string;
    name?: string;
    picture?: string;
    description?: string;
    about?: string;
}

/** Options for adding or removing a group member (kind:9001 / kind:9002) */
export interface SendGroupMembershipOptions {
    senderPrivkeyHex: string;
    groupId: string;
    /** Action: 9001 = add, 9002 = remove */
    kind: typeof KIND_GROUP_ADD | typeof KIND_GROUP_REMOVE;
    /** Pubkeys to add or remove */
    memberPubkeys: string[];
}

/** Callback invoked when a new message arrives over Nostr */
export type IncomingMessageHandler = (
    message: SporeMessage,
    rawEvent: NostrEvent
) => void;

export class NostrTransport {
    private readonly pool: RelayPool;
    private readonly debug: boolean;

    constructor(pool: RelayPool, debug = false) {
        this.pool = pool;
        this.debug = debug;
    }

    // ─── DM via NIP-17 Gift Wrap ──────────────────────────────────────────────

    /**
     * Send an encrypted DM using NIP-17 Gift Wrap (kind:1059 + sealed sender).
     *
     * Flow:
     *   1. Build a "rumor" (unsigned kind:14 event with content)
     *   2. Seal the rumor: encrypt it with sender's privkey to recipient, sign as kind:13
     *   3. Gift-wrap the seal: encrypt with a random ephemeral key, publish as kind:1059
     *
     * This prevents correlation of sender identity to the outer event.
     */
    async sendDm(opts: SendDmOptions): Promise<string> {
        const { senderPrivkeyHex, senderPubkeyHex, recipientPubkeyHex, content, replyToId } = opts;

        // Step 1: Build rumor (unsigned — no id/sig)
        const rumorTags: string[][] = [['p', recipientPubkeyHex]];
        if (replyToId) {
            rumorTags.push(['e', replyToId, '', 'reply']);
        }

        // Rumor is an unsigned event-like object (not a full EventTemplate since it
        // carries pubkey as part of the encrypted payload, not as a signed field)
        const rumor = {
            kind: KIND_RUMOR,
            content,
            created_at: unixNow(),
            tags: rumorTags,
            pubkey: senderPubkeyHex,
        };

        // Step 2: Seal — encrypt rumor JSON with sender key → recipient pubkey
        const rumorJson = JSON.stringify(rumor);
        const sealContent = crypto.encrypt(senderPrivkeyHex, recipientPubkeyHex, rumorJson);

        const sealTemplate: EventTemplate = {
            kind: KIND_SEAL,
            content: sealContent,
            created_at: randomTimestampInLastDay(),
            tags: [],
        };

        const sealEvent = finalizeEvent(sealTemplate, hexToBytes(senderPrivkeyHex));

        // Step 3: Gift wrap — ephemeral key encrypts the seal → recipient
        const ephemeralKeyBytes = generateSecretKey(); // Uint8Array
        const ephemeralKeyHex = bytesToHex(ephemeralKeyBytes);

        const sealJson = JSON.stringify(sealEvent);
        const wrapContent = crypto.encrypt(ephemeralKeyHex, recipientPubkeyHex, sealJson);

        const wrapTemplate: EventTemplate = {
            kind: KIND_GIFT_WRAP,
            content: wrapContent,
            created_at: randomTimestampInLastDay(),
            tags: [['p', recipientPubkeyHex]],
        };

        const wrapEvent = finalizeEvent(wrapTemplate, ephemeralKeyBytes);

        await this.pool.publish(wrapEvent);

        if (this.debug) {
            console.debug('[NostrTransport] DM sent, wrap id:', wrapEvent.id);
        }

        return wrapEvent.id;
    }

    // ─── Group messages (kind:11 / NIP-29) ────────────────────────────────────

    /**
     * Send a group message.
     * Uses kind:11 (NIP-29 group message) with member pubkeys in tags.
     * For M1 the content is sent plaintext; per-member encryption is layered in M2.
     */
    async sendGroupMessage(opts: SendGroupMessageOptions): Promise<string> {
        const { senderPrivkeyHex, groupId, content, replyToId } = opts;

        const tags: string[][] = [
            ['h', groupId],
            ...opts.memberPubkeys.map((pk) => ['p', pk]),
        ];
        if (replyToId) {
            tags.push(['e', replyToId, '', 'reply']);
        }

        const unsigned: EventTemplate = {
            kind: 11, // NIP-29 group message
            content,
            created_at: unixNow(),
            tags,
        };

        const event = finalizeEvent(unsigned, hexToBytes(senderPrivkeyHex));

        await this.pool.publish(event);

        if (this.debug) {
            console.debug('[NostrTransport] group message sent, id:', event.id);
        }

        return event.id;
    }

    // ─── Group Management (NIP-29) ────────────────────────────────────────────

    /**
     * Publish group metadata (kind:9000).
     * Creates or updates the group's name/picture/description on relay.
     * Typically called once when creating a new group.
     *
     * @returns Nostr event id
     */
    async sendGroupMeta(opts: SendGroupMetaOptions): Promise<string> {
        const { senderPrivkeyHex, groupId, name, picture, description, about } = opts;

        const tags: string[][] = [['d', groupId]];
        if (name) tags.push(['name', name]);
        if (picture) tags.push(['picture', picture]);
        if (description) tags.push(['description', description]);
        if (about) tags.push(['about', about]);

        const unsigned: EventTemplate = {
            kind: KIND_GROUP_META,
            content: '',
            created_at: unixNow(),
            tags,
        };

        const event = finalizeEvent(unsigned, hexToBytes(senderPrivkeyHex));
        await this.pool.publish(event);

        if (this.debug) {
            console.debug('[NostrTransport] group meta sent, id:', event.id, 'groupId:', groupId);
        }

        return event.id;
    }

    /**
     * Add or remove group members via NIP-29 management events.
     *
     * - kind:9001 (KIND_GROUP_ADD)    — add member(s) to the group
     * - kind:9002 (KIND_GROUP_REMOVE) — remove member(s) from the group
     *
     * Each target pubkey gets its own 'p' tag per NIP-29 convention.
     *
     * @returns Nostr event id
     */
    async sendGroupMembership(opts: SendGroupMembershipOptions): Promise<string> {
        const { senderPrivkeyHex, groupId, kind, memberPubkeys } = opts;

        const tags: string[][] = [
            ['h', groupId],
            ...memberPubkeys.map((pk) => ['p', pk]),
        ];

        const unsigned: EventTemplate = {
            kind,
            content: '',
            created_at: unixNow(),
            tags,
        };

        const event = finalizeEvent(unsigned, hexToBytes(senderPrivkeyHex));
        await this.pool.publish(event);

        if (this.debug) {
            const action = kind === KIND_GROUP_ADD ? 'add' : 'remove';
            console.debug(`[NostrTransport] group ${action} sent, id:`, event.id, 'groupId:', groupId);
        }

        return event.id;
    }

    // ─── Subscriptions ────────────────────────────────────────────────────────

    /**
     * Subscribe to incoming DMs (gift-wrapped kind:1059 events) for a pubkey.
     *
     * @param myPubkeyHex  - Own Nostr pubkey to subscribe for
     * @param myPrivkeyHex - Own private key for decryption
     * @param handler      - Called for each decoded SporeMessage
     * @returns Unsubscribe function
     */
    subscribeToDms(
        myPubkeyHex: string,
        myPrivkeyHex: string,
        handler: IncomingMessageHandler
    ): () => void {
        return this.pool.subscribe(
            { kinds: [KIND_GIFT_WRAP], '#p': [myPubkeyHex] },
            (rawEvent) => {
                try {
                    const message = this.unwrapDm(rawEvent, myPrivkeyHex, myPubkeyHex);
                    if (message) {
                        handler(message, rawEvent);
                    }
                } catch (err) {
                    if (this.debug) {
                        console.error('[NostrTransport] failed to unwrap DM:', err);
                    }
                }
            }
        );
    }

    /**
     * Subscribe to group messages (kind:11) for groups where our pubkey is listed.
     *
     * @param myPubkeyHex  - Own Nostr pubkey
     * @param groupIds     - Optional: filter to specific group ids (empty = all)
     * @param handler      - Called for each decoded SporeMessage
     * @returns Unsubscribe function
     */
    subscribeToGroups(
        myPubkeyHex: string,
        groupIds: string[],
        handler: IncomingMessageHandler
    ): () => void {
        const filter: { kinds: number[]; '#p': string[]; '#h'?: string[] } = {
            kinds: [11],
            '#p': [myPubkeyHex],
        };

        if (groupIds.length > 0) {
            filter['#h'] = groupIds;
        }

        return this.pool.subscribe(filter, (rawEvent) => {
            try {
                const message = this.decodeGroupEvent(rawEvent);
                if (message) {
                    handler(message, rawEvent);
                }
            } catch (err) {
                if (this.debug) {
                    console.error('[NostrTransport] failed to decode group event:', err);
                }
            }
        });
    }

    // ─── Public decoding helpers (used by SporeAgent.getMessages) ────────────

    /**
     * Attempt to decrypt a gift-wrapped DM event (kind:1059) into a SporeMessage.
     * Returns null if the event is not addressed to us or decryption fails.
     *
     * @param wrapEvent    - Raw kind:1059 event from relay
     * @param myPrivkeyHex - Our private key for decryption
     * @param myPubkeyHex  - Our public key (used to derive conversation id)
     */
    decryptDm(
        wrapEvent: NostrEvent,
        myPrivkeyHex: string,
        myPubkeyHex: string
    ): SporeMessage | null {
        return this.unwrapDm(wrapEvent, myPrivkeyHex, myPubkeyHex);
    }

    /**
     * Decode a plaintext NIP-29 group event (kind:11) into a SporeMessage.
     * Returns null if the 'h' (group id) tag is missing.
     *
     * @param event - Raw kind:11 Nostr event
     */
    decodeGroup(event: NostrEvent): SporeMessage | null {
        return this.decodeGroupEvent(event);
    }

    // ─── Private decoding helpers ─────────────────────────────────────────────

    /**
     * Unwrap a NIP-17 gift-wrapped DM (kind:1059 → kind:13 → kind:14).
     * Returns null if decryption fails (not addressed to us).
     */
    private unwrapDm(
        wrapEvent: NostrEvent,
        myPrivkeyHex: string,
        myPubkeyHex: string
    ): SporeMessage | null {
        // Step 1: decrypt gift wrap with our key using the ephemeral sender pubkey
        let sealJson: string;
        try {
            sealJson = crypto.decrypt(myPrivkeyHex, wrapEvent.pubkey, wrapEvent.content);
        } catch {
            return null; // not for us
        }

        const sealEvent: SignedNostrEvent = JSON.parse(sealJson) as SignedNostrEvent;
        // Guard against malformed seal — both fields must be strings
        if (typeof sealEvent.pubkey !== 'string' || typeof sealEvent.content !== 'string') {
            return null;
        }
        // CRIT-1: Verify the seal's Schnorr signature before trusting its pubkey as sender.
        // Without this, an attacker can craft a seal with an arbitrary pubkey to impersonate any user.
        if (!verifyEvent(sealEvent)) {
            return null;
        }

        // Step 2: decrypt seal using sender's pubkey
        let rumorJson: string;
        try {
            rumorJson = crypto.decrypt(myPrivkeyHex, sealEvent.pubkey, sealEvent.content);
        } catch {
            return null;
        }

        const rumor = JSON.parse(rumorJson) as { content: string; tags: string[][] };

        // True sender is identified by the seal's pubkey (not the ephemeral wrap pubkey)
        const senderPubkey = sealEvent.pubkey;
        const participants = [senderPubkey, myPubkeyHex].sort();
        const convId = deriveConversationId(participants);

        const conversation: SporeConversation = {
            id: convId,
            type: 'dm',
            members: participants,
            createdAt: wrapEvent.created_at,
        };

        const replyTag = rumor.tags?.find(
            (t: string[]) => t[0] === 'e' && t[3] === 'reply'
        );

        return {
            id: wrapEvent.id,
            senderPubkey,
            content: rumor.content,
            contentType: 'text',
            sentAt: wrapEvent.created_at,
            referencedMessageId: replyTag?.[1],
            conversation,
            rawEvent: wrapEvent as SignedNostrEvent,
        };
    }

    /** Decode a plaintext NIP-29 group event (kind:11) into a SporeMessage. */
    private decodeGroupEvent(event: NostrEvent): SporeMessage | null {
        const groupTag = event.tags.find((t) => t[0] === 'h');
        if (!groupTag) return null;

        const groupId = groupTag[1];
        const memberPubkeys = event.tags
            .filter((t) => t[0] === 'p')
            .map((t) => t[1]);

        const conversation: SporeConversation = {
            id: groupId,
            type: 'group',
            members: [event.pubkey, ...memberPubkeys],
            createdAt: event.created_at,
        };

        const replyTag = event.tags.find((t) => t[0] === 'e' && t[3] === 'reply');

        return {
            id: event.id,
            senderPubkey: event.pubkey,
            content: event.content,
            contentType: 'text',
            sentAt: event.created_at,
            referencedMessageId: replyTag?.[1],
            conversation,
            rawEvent: event as SignedNostrEvent,
        };
    }
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

function unixNow(): number {
    return Math.floor(Date.now() / 1000);
}

/**
 * Return a random timestamp within the last 2 days.
 * NIP-17 requires randomising created_at to prevent timing correlation.
 *
 * Uses rejection sampling to eliminate modulo bias: the window (172800s) does not
 * divide 2^32 evenly, so naive `% windowSeconds` would bias toward lower offsets.
 * We discard samples ≥ floor(2^32 / windowSeconds) * windowSeconds and resample.
 */
function randomTimestampInLastDay(): number {
    const twoDaysAgo = unixNow() - 2 * 24 * 60 * 60;
    const windowSeconds = 2 * 24 * 60 * 60; // 172800
    const limit = Math.floor(0x100000000 / windowSeconds) * windowSeconds; // 4294656000
    const buf = new Uint32Array(1);
    let offset: number;
    do {
        globalThis.crypto.getRandomValues(buf);
        offset = buf[0]!;
    } while (offset >= limit);
    return twoDaysAgo + (offset % windowSeconds);
}

function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Deterministically derive a conversation id for a DM from sorted participant pubkeys.
 * Uses SHA256 to prevent trivial collision via embedded ':' in crafted pubkey values.
 */
function deriveConversationId(sortedPubkeys: string[]): string {
    const input = new TextEncoder().encode(sortedPubkeys.join(':'));
    return nobleBytesToHex(sha256(input));
}
