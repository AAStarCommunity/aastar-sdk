// SporeIdentityRegistry — NIP-01 profile metadata + multi-device key linking.
//
// Two concerns are handled here:
//
// 1. Identity profile (kind:0):
//    Publishes and queries NIP-01 profile metadata events.
//    Spore extends the standard kind:0 JSON with an "eth_address" field
//    so that Ethereum users can be discovered by their on-chain identity.
//    The Nostr pubkey IS the same secp256k1 key as the ETH private key
//    (via AirAccountIdentity), so no separate on-chain signature is needed —
//    possession of the Nostr privkey proves ownership of the ETH key.
//
// 2. Device list (kind:10001 — parameterized replaceable):
//    Allows a user to declare multiple device pubkeys that should all
//    receive their messages. The primary device publishes a kind:10001 event
//    listing device pubkeys as 'p' tags. Other agents can subscribe to this
//    event to discover all devices that should receive messages for a given
//    identity.
//
// Wire format:
//   kind:0 content — JSON string:
//     { "name": "...", "about": "...", "picture": "...", "eth_address": "0x..." }
//
//   kind:10001 tags:
//     ['d', 'spore-devices']          — parameterized replaceable key
//     ['p', '<device-pubkey>', '<label>?']  — one per linked device

import {
    finalizeEvent,
    verifyEvent,
    type NostrEvent,
    type EventTemplate,
} from 'nostr-tools';
import type { RelayPool } from '../relay/RelayPool.js';

// ─── Constants ────────────────────────────────────────────────────────────────

export const KIND_PROFILE = 0;          // NIP-01 profile metadata
export const KIND_DEVICE_LIST = 10001;  // Spore device list (parameterized replaceable)

const DEVICE_LIST_D_TAG = 'spore-devices';

// ─── Types ────────────────────────────────────────────────────────────────────

/** NIP-01 profile metadata extended with Spore fields */
export interface IdentityProfile {
    /** Nostr pubkey (64-char hex) — the primary identity key */
    nostrPubkey: string;
    /** Ethereum address derived from the same secp256k1 key */
    ethAddress?: `0x${string}`;
    /** Display name */
    name?: string;
    /** Short bio */
    about?: string;
    /** Profile picture URL */
    picture?: string;
    /** Arbitrary extra fields (passed through to the kind:0 JSON) */
    extra?: Record<string, unknown>;
}

/** Options for linking a device */
export interface LinkDeviceOptions {
    /** Label for the device (e.g. "iPhone 15", "MacBook Pro") */
    label?: string;
}

/** A linked device entry */
export interface LinkedDevice {
    /** Nostr pubkey of the device */
    pubkey: string;
    /** Optional human-readable label */
    label?: string;
}

// ─── SporeIdentityRegistry ────────────────────────────────────────────────────

/**
 * SporeIdentityRegistry — profile publishing and multi-device management.
 *
 * This is a stateless helper that wraps RelayPool.fetchEvents() and publish()
 * to provide higher-level identity operations.
 *
 * All methods are pure relay I/O — no local state is mutated.
 */
export class SporeIdentityRegistry {
    constructor(
        private readonly pool: RelayPool,
        private readonly debug: boolean = false
    ) {}

    // ─── Profile API ──────────────────────────────────────────────────────────

    /**
     * Publish a NIP-01 kind:0 profile event.
     *
     * The event content is a JSON object containing the profile fields.
     * An "eth_address" field is included if profile.ethAddress is set.
     *
     * @param privkeyHex - Signer private key (hex)
     * @param profile    - Profile data to publish
     * @returns Nostr event id
     */
    async publishProfile(privkeyHex: string, profile: Omit<IdentityProfile, 'nostrPubkey'>): Promise<string> {
        const content: Record<string, unknown> = {};
        // extra fields applied first; reserved keys below always win over extra
        if (profile.extra) Object.assign(content, profile.extra);
        if (profile.name !== undefined) content['name'] = profile.name;
        if (profile.about !== undefined) content['about'] = profile.about;
        if (profile.picture !== undefined) content['picture'] = profile.picture;
        if (profile.ethAddress !== undefined) content['eth_address'] = profile.ethAddress;

        const template: EventTemplate = {
            kind: KIND_PROFILE,
            content: JSON.stringify(content),
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
        };

        const event = finalizeEvent(template, hexToBytes(privkeyHex));
        await this.pool.publish(event);

        if (this.debug) {
            console.debug('[SporeIdentityRegistry] published profile, id:', event.id);
        }

        return event.id;
    }

    /**
     * Fetch the latest kind:0 profile event for a given Nostr pubkey.
     *
     * Returns the most recent profile or null if none found.
     *
     * @param nostrPubkey - 64-char hex Nostr pubkey
     * @param timeoutMs   - Relay query timeout (default: 5000ms)
     */
    async fetchProfile(nostrPubkey: string, timeoutMs = 5000): Promise<IdentityProfile | null> {
        const events = await this.pool.fetchEvents(
            { kinds: [KIND_PROFILE], authors: [nostrPubkey], limit: 1 },
            timeoutMs
        );

        if (events.length === 0) return null;

        // Pick the most recent *verified* event; skip any with invalid signatures
        const verified = events.filter((ev) => verifyEvent(ev));
        if (verified.length === 0) return null;
        const latest = verified.sort((a, b) => b.created_at - a.created_at)[0]!;
        return parseProfile(latest);
    }

    /**
     * Fetch profiles for multiple pubkeys in one query.
     *
     * Returns a Map of nostrPubkey → IdentityProfile.
     * Pubkeys with no profile are absent from the map.
     *
     * @param nostrPubkeys - Array of 64-char hex pubkeys
     * @param timeoutMs    - Relay query timeout (default: 5000ms)
     */
    async fetchProfiles(nostrPubkeys: string[], timeoutMs = 5000): Promise<Map<string, IdentityProfile>> {
        if (nostrPubkeys.length === 0) return new Map();

        const events = await this.pool.fetchEvents(
            { kinds: [KIND_PROFILE], authors: nostrPubkeys },
            timeoutMs
        );

        const result = new Map<string, IdentityProfile>();
        // Group by pubkey and keep only the most recent per pubkey
        const byPubkey = new Map<string, NostrEvent>();
        for (const ev of events) {
            // Skip events with invalid Schnorr signatures (malicious relay protection)
            if (!verifyEvent(ev)) continue;
            const existing = byPubkey.get(ev.pubkey);
            if (!existing || ev.created_at > existing.created_at) {
                byPubkey.set(ev.pubkey, ev);
            }
        }

        for (const [pubkey, ev] of byPubkey) {
            const profile = parseProfile(ev);
            if (profile) result.set(pubkey, profile);
        }

        return result;
    }

    // ─── Device List API ──────────────────────────────────────────────────────

    /**
     * Publish a device list event (kind:10001), declaring all devices that
     * should receive messages for this identity.
     *
     * This is a replaceable event — publishing a new one replaces the previous.
     * The list should be authoritative: include ALL device pubkeys, not just new ones.
     *
     * @param primaryPrivkeyHex - Primary identity private key
     * @param devices           - Full list of linked devices (replaces previous)
     * @returns Nostr event id
     */
    async publishDeviceList(
        primaryPrivkeyHex: string,
        devices: LinkedDevice[]
    ): Promise<string> {
        const tags: string[][] = [
            ['d', DEVICE_LIST_D_TAG],
            ...devices.map((d) => d.label ? ['p', d.pubkey, d.label] : ['p', d.pubkey]),
        ];

        const template: EventTemplate = {
            kind: KIND_DEVICE_LIST,
            content: '',
            created_at: Math.floor(Date.now() / 1000),
            tags,
        };

        const event = finalizeEvent(template, hexToBytes(primaryPrivkeyHex));
        await this.pool.publish(event);

        if (this.debug) {
            console.debug('[SporeIdentityRegistry] published device list, devices:', devices.length);
        }

        return event.id;
    }

    /**
     * Fetch the linked device list for a primary pubkey.
     *
     * Returns an empty array if no device list is published.
     *
     * @param primaryPubkey - Primary Nostr pubkey
     * @param timeoutMs     - Relay query timeout (default: 5000ms)
     */
    async fetchDeviceList(primaryPubkey: string, timeoutMs = 5000): Promise<LinkedDevice[]> {
        const events = await this.pool.fetchEvents(
            {
                kinds: [KIND_DEVICE_LIST],
                authors: [primaryPubkey],
                '#d': [DEVICE_LIST_D_TAG],
                limit: 1,
            },
            timeoutMs
        );

        if (events.length === 0) return [];

        // Only trust events with a valid Schnorr signature
        const verified = events.filter((ev) => verifyEvent(ev));
        if (verified.length === 0) return [];
        const latest = verified.sort((a, b) => b.created_at - a.created_at)[0]!;
        return parseDeviceList(latest);
    }

    /**
     * Check whether a device pubkey is in the primary identity's device list.
     *
     * @param primaryPubkey - Primary Nostr pubkey
     * @param devicePubkey  - Device pubkey to check
     */
    async isLinkedDevice(primaryPubkey: string, devicePubkey: string): Promise<boolean> {
        const devices = await this.fetchDeviceList(primaryPubkey);
        return devices.some((d) => d.pubkey === devicePubkey);
    }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function parseProfile(event: NostrEvent): IdentityProfile | null {
    try {
        const json = JSON.parse(event.content) as Record<string, unknown>;
        const profile: IdentityProfile = { nostrPubkey: event.pubkey };
        if (typeof json['name'] === 'string') profile.name = json['name'];
        if (typeof json['about'] === 'string') profile.about = json['about'];
        if (typeof json['picture'] === 'string') profile.picture = json['picture'];
        if (typeof json['eth_address'] === 'string') {
            profile.ethAddress = json['eth_address'] as `0x${string}`;
        }
        return profile;
    } catch {
        return null;
    }
}

function parseDeviceList(event: NostrEvent): LinkedDevice[] {
    return event.tags
        .filter((t) => t[0] === 'p' && typeof t[1] === 'string')
        .map((t) => ({
            pubkey: t[1]!,
            label: typeof t[2] === 'string' ? t[2] : undefined,
        }));
}

function hexToBytes(hex: string): Uint8Array {
    const h = hex.startsWith('0x') ? hex.slice(2) : hex;
    const result = new Uint8Array(Math.ceil(h.length / 2));
    for (let i = 0; i < result.length; i++) {
        result[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
    }
    return result;
}
