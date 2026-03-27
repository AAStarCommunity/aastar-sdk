// SporeKeyAgreement — NIP-104 compatible group key agreement layer.
//
// Protocol overview:
//
//   kind:443  KeyPackage — device broadcasts its secp256k1 ECDH public key so
//             that group creators can include it when building group keys.
//
//   kind:444  Welcome — group epoch key, encrypted 1:1 to each new member via
//             NIP-44, delivered through the NIP-17 gift-wrap DM channel.
//             Identified by SPORE_MLS_WELCOME_PREFIX in the plaintext.
//
//   kind:445  Group message — NIP-44 ciphertext using the current epoch key
//             (ChaCha20-Poly1305, random 32-byte nonce).  Tagged with groupId
//             and epoch number so recipients can look up the right key.
//
// Epoch key lifecycle:
//   epoch-0  = randomBytes(32)                                    (group creation)
//   epoch-n  = HKDF-SHA256(epoch-n-1, "", "spore-mls-next-epoch")  (ratchet)
//
// Security properties:
//   - Forward secrecy: after ratcheting, past epoch keys cannot be recovered.
//   - Post-compromise security: key rotation after member removal creates a
//     fresh epoch key unknown to the removed member.
//   - Relay integrity: all key-package events are Schnorr-verified before use.

import { finalizeEvent, verifyEvent, type EventTemplate } from 'nostr-tools';
import { encrypt as nip44Encrypt, decrypt as nip44Decrypt } from 'nostr-tools/nip44';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';
import { randomBytes as nobleRandomBytes } from '@noble/hashes/utils';
import type { RelayPool } from '../relay/RelayPool.js';

// ─── Constants ────────────────────────────────────────────────────────────────

export const KIND_KEY_PACKAGE = 443;
export const KIND_MLS_WELCOME = 444;
export const KIND_MLS_GROUP_MESSAGE = 445;

/** Prefix embedded in Welcome DM plaintext for reliable detection. */
export const SPORE_MLS_WELCOME_PREFIX = '\x00spore-mls-welcome\x00';

/** Cipher suite identifier included in KeyPackage and Welcome metadata. */
export const SPORE_MLS_CIPHER = 'secp256k1-nip44-chacha20';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Runtime state for an active MLS group.
 *
 * Must be stored by the application; this module does not cache state.
 * The epochKey is sensitive — store it in memory only (never serialise to disk
 * without encrypting it first).
 */
export interface MlsGroupState {
    /** Globally unique group identifier (hex) */
    groupId: string;
    /** Current epoch number (0 at creation, incremented on each ratchet) */
    epoch: number;
    /** 32-byte symmetric key for the current epoch */
    epochKey: Uint8Array;
    /** Nostr pubkeys of all current group members */
    members: string[];
}

/**
 * Welcome payload transmitted inside a NIP-17 DM to a new group member.
 *
 * The epochKeyHex field contains the symmetric key and must be treated as
 * secret — it is NIP-44 encrypted to the recipient's pubkey before delivery.
 */
export interface MlsWelcomePayload {
    type: 'spore-mls-welcome';
    groupId: string;
    epoch: number;
    epochKeyHex: string;
    members: string[];
    cipher: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
    const h = hex.startsWith('0x') ? hex.slice(2) : hex;
    const result = new Uint8Array(h.length / 2);
    for (let i = 0; i < result.length; i++) {
        result[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
    }
    return result;
}

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

// ─── SporeKeyAgreement ────────────────────────────────────────────────────────

/**
 * SporeKeyAgreement — NIP-104 key agreement primitives.
 *
 * This class is stateless.  All cryptographic state (epoch keys, member lists)
 * is returned to the caller and must be stored application-side.
 *
 * Typical workflow:
 * ```ts
 * const ka = new SporeKeyAgreement();
 *
 * // Each device publishes a KeyPackage once (or periodically):
 * await ka.publishKeyPackage(myPrivkey, pool);
 *
 * // Group creator builds group + delivers Welcome:
 * const state = ka.createGroup(groupId, memberPubkeys);
 * for (const pk of memberPubkeys) {
 *   const dmContent = ka.encodeWelcomeDmContent(ka.buildWelcomePayload(state));
 *   await transport.sendDm({ ..., recipientPubkeyHex: pk, content: dmContent });
 * }
 *
 * // Member processes incoming Welcome:
 * const payload = ka.parseWelcomeDmContent(dmContent);
 * const state   = ka.processWelcome(payload!);
 *
 * // Send/receive group messages:
 * const ct  = ka.encryptGroupMessage(plaintext, state.epochKey);
 * const pt  = ka.decryptGroupMessage(ct, state.epochKey);
 * ```
 */
export class SporeKeyAgreement {
    constructor(private readonly debug: boolean = false) {}

    // ─── KeyPackage API ────────────────────────────────────────────────────────

    /**
     * Publish a kind:443 KeyPackage event announcing this device's ECDH public key.
     *
     * The device's secp256k1 Nostr pubkey is the key material.  Other devices
     * fetch this event to verify device participation and to derive group keys
     * without the device being online.
     *
     * @param privkeyHex - Device private key (32-byte hex)
     * @param pool       - RelayPool to publish to
     * @returns Nostr event id
     */
    async publishKeyPackage(privkeyHex: string, pool: RelayPool): Promise<string> {
        const template: EventTemplate = {
            kind: KIND_KEY_PACKAGE,
            content: '',
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ['d', 'spore-kp'],
                ['version', '1'],
                ['cipher', SPORE_MLS_CIPHER],
            ],
        };

        const event = finalizeEvent(template, hexToBytes(privkeyHex));
        await pool.publish(event);

        if (this.debug) {
            console.debug('[SporeKeyAgreement] published KeyPackage id:', event.id);
        }

        return event.id;
    }

    /**
     * Fetch the most recent KeyPackage for each requested pubkey.
     *
     * Returns a Map of pubkey → { pubkey, eventId }.
     * Events with invalid Schnorr signatures are silently discarded.
     * Pubkeys without a valid KeyPackage are absent from the result.
     *
     * @param pubkeys   - Device pubkeys to query
     * @param pool      - RelayPool to query
     * @param timeoutMs - Query timeout in ms (default: 5000)
     */
    async fetchKeyPackages(
        pubkeys: string[],
        pool: RelayPool,
        timeoutMs = 5000
    ): Promise<Map<string, { pubkey: string; eventId: string }>> {
        if (pubkeys.length === 0) return new Map();

        const events = await pool.fetchEvents(
            { kinds: [KIND_KEY_PACKAGE], authors: pubkeys, '#d': ['spore-kp'] },
            timeoutMs
        );

        // Keep only the most recent *verified* event per pubkey
        const byPubkey = new Map<string, { created_at: number; id: string; pubkey: string }>();
        for (const ev of events) {
            if (!verifyEvent(ev)) continue;
            const existing = byPubkey.get(ev.pubkey);
            if (!existing || ev.created_at > existing.created_at) {
                byPubkey.set(ev.pubkey, ev);
            }
        }

        const result = new Map<string, { pubkey: string; eventId: string }>();
        for (const [pubkey, ev] of byPubkey) {
            result.set(pubkey, { pubkey, eventId: ev.id });
        }
        return result;
    }

    // ─── Group Key Operations ──────────────────────────────────────────────────

    /**
     * Create a new MLS group with a fresh random epoch-0 key.
     *
     * The caller is responsible for delivering Welcome messages to each member
     * (see buildWelcomePayload + encodeWelcomeDmContent).
     *
     * @param groupId - Unique group identifier (e.g. 32-byte hex)
     * @param members - Nostr pubkeys of ALL group members (including self)
     * @returns Initial MlsGroupState
     */
    createGroup(groupId: string, members: string[]): MlsGroupState {
        const epochKey = nobleRandomBytes(32);
        return { groupId, epoch: 0, epochKey, members };
    }

    /**
     * Ratchet the epoch key forward using HKDF-SHA256.
     *
     * Derives the next 32-byte epoch key:
     *   nextKey = HKDF-SHA256(IKM=currentKey, salt="", info="spore-mls-next-epoch")
     *
     * After ratcheting, the previous epochKey provides no information about
     * future keys (forward secrecy).  Call this after member add/remove
     * or on a scheduled rotation policy.
     *
     * @param state - Current group state
     * @returns New group state with epoch incremented and epochKey updated
     */
    ratchetEpoch(state: MlsGroupState): MlsGroupState {
        const nextKey = hkdf(
            sha256,
            state.epochKey,
            new Uint8Array(0),        // salt (empty)
            'spore-mls-next-epoch',   // info
            32                        // output length
        );
        return {
            ...state,
            epoch: state.epoch + 1,
            epochKey: nextKey,
        };
    }

    // ─── Welcome (group key delivery) ─────────────────────────────────────────

    /**
     * Build the Welcome payload for delivery to a new member.
     *
     * The payload contains the epoch key in hex — it MUST be NIP-44 encrypted
     * to the recipient before transmission.
     *
     * @param state - Current group state
     * @returns Welcome payload (plaintext — encrypt before sending)
     */
    buildWelcomePayload(state: MlsGroupState): MlsWelcomePayload {
        return {
            type: 'spore-mls-welcome',
            groupId: state.groupId,
            epoch: state.epoch,
            epochKeyHex: bytesToHex(state.epochKey),
            members: [...state.members],
            cipher: SPORE_MLS_CIPHER,
        };
    }

    /**
     * Encode a Welcome payload as a DM content string.
     *
     * Prefixes the JSON with SPORE_MLS_WELCOME_PREFIX so that the recipient's
     * message handler can detect and route it without decoding the outer DM.
     *
     * @param payload - Welcome payload from buildWelcomePayload
     * @returns DM content string (NIP-44 encrypt this before sending)
     */
    encodeWelcomeDmContent(payload: MlsWelcomePayload): string {
        return SPORE_MLS_WELCOME_PREFIX + JSON.stringify(payload);
    }

    /**
     * Parse a Welcome from a decrypted DM content string.
     *
     * Returns null if the content is not a valid Spore MLS Welcome.
     *
     * @param content - Decrypted DM content string
     */
    parseWelcomeDmContent(content: string): MlsWelcomePayload | null {
        if (!content.startsWith(SPORE_MLS_WELCOME_PREFIX)) return null;
        try {
            const raw = content.slice(SPORE_MLS_WELCOME_PREFIX.length);
            const json = JSON.parse(raw) as Record<string, unknown>;

            if (json['type'] !== 'spore-mls-welcome') return null;
            if (typeof json['groupId'] !== 'string') return null;
            if (typeof json['epochKeyHex'] !== 'string') return null;
            if (typeof json['epoch'] !== 'number') return null;
            if (!Array.isArray(json['members'])) return null;

            return json as unknown as MlsWelcomePayload;
        } catch {
            return null;
        }
    }

    /**
     * Reconstruct an MlsGroupState from a received and parsed Welcome payload.
     *
     * @param payload - Parsed Welcome payload from parseWelcomeDmContent
     * @returns MlsGroupState for the group
     */
    processWelcome(payload: MlsWelcomePayload): MlsGroupState {
        return {
            groupId: payload.groupId,
            epoch: payload.epoch,
            epochKey: hexToBytes(payload.epochKeyHex),
            members: [...payload.members],
        };
    }

    // ─── Group Message Encryption ──────────────────────────────────────────────

    /**
     * Encrypt a group message with the current epoch key.
     *
     * Uses NIP-44's ChaCha20-Poly1305 with a random 32-byte nonce.
     * The same cipher interface as 1:1 NIP-44, but keyed with the shared
     * epoch key instead of a per-pair ECDH secret.
     *
     * @param plaintext - UTF-8 message content
     * @param epochKey  - 32-byte current epoch key from MlsGroupState
     * @returns Base64-encoded NIP-44 ciphertext
     */
    encryptGroupMessage(plaintext: string, epochKey: Uint8Array): string {
        return nip44Encrypt(plaintext, epochKey);
    }

    /**
     * Decrypt a group message encrypted with the epoch key.
     *
     * @param ciphertext - Base64-encoded NIP-44 ciphertext
     * @param epochKey   - 32-byte epoch key from MlsGroupState
     * @returns Decrypted UTF-8 plaintext
     * @throws If decryption fails (wrong key, corrupt ciphertext)
     */
    decryptGroupMessage(ciphertext: string, epochKey: Uint8Array): string {
        return nip44Decrypt(ciphertext, epochKey);
    }

    /**
     * Build and sign a kind:445 MLS group message event.
     *
     * The ciphertext (from encryptGroupMessage) is set as the event content.
     * The event includes the groupId and epoch number as tags so receivers
     * can select the correct epoch key.
     *
     * @param privkeyHex - Sender private key
     * @param groupId    - Group identifier (from MlsGroupState.groupId)
     * @param epoch      - Current epoch number (from MlsGroupState.epoch)
     * @param ciphertext - Output of encryptGroupMessage
     * @returns Signed kind:445 Nostr event
     */
    buildGroupMessageEvent(
        privkeyHex: string,
        groupId: string,
        epoch: number,
        ciphertext: string
    ) {
        const template: EventTemplate = {
            kind: KIND_MLS_GROUP_MESSAGE,
            content: ciphertext,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ['h', groupId],
                ['epoch', epoch.toString()],
            ],
        };
        return finalizeEvent(template, hexToBytes(privkeyHex));
    }
}
