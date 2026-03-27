// Shared types and interfaces for @aastar/messaging (Spore Protocol SDK)
// Mirrors the XMTP agent-sdk public API surface.

// ─── Identity ────────────────────────────────────────────────────────────────

/** Hex-encoded 32-byte private key (AirAccount EOA / Nostr keypair) */
export type PrivateKeyHex = `0x${string}` | string;

/** Hex-encoded 32-byte Nostr public key (x-only, secp256k1) */
export type NostrPubkeyHex = string;

/** Fully qualified identity for this agent */
export interface SporeIdentity {
    /** Nostr public key (hex, 64 chars) */
    pubkey: NostrPubkeyHex;
    /** Ethereum address derived from the same secp256k1 key */
    address: `0x${string}`;
    /** Raw private key (kept in memory only) */
    privateKeyHex: string;
}

// ─── Relay ───────────────────────────────────────────────────────────────────

/** WebSocket URL of a Nostr relay */
export type RelayUrl = string;

export interface RelayPoolConfig {
    /** List of relay WebSocket URLs to connect to */
    relays: RelayUrl[];
    /** How long (ms) to wait for a relay to connect before giving up */
    connectTimeoutMs?: number;
    /** Whether to automatically reconnect on close (default: true) */
    autoReconnect?: boolean;
}

// ─── Nostr Events ─────────────────────────────────────────────────────────────

/** Minimal Nostr event structure (pre-signing) */
export interface UnsignedNostrEvent {
    kind: number;
    created_at: number;
    tags: string[][];
    content: string;
    pubkey: string;
}

/** Signed Nostr event (id + sig added by nostr-tools) */
export interface SignedNostrEvent extends UnsignedNostrEvent {
    id: string;
    sig: string;
}

// ─── Conversation ─────────────────────────────────────────────────────────────

/** Type of conversation */
export type ConversationType = 'dm' | 'group';

/** Represents a conversation (DM or group) */
export interface SporeConversation {
    /** Unique conversation identifier (for DMs: sorted pubkey pair hash; for groups: group id) */
    id: string;
    /** Conversation type */
    type: ConversationType;
    /** Pubkeys of all participants (including self) */
    members: NostrPubkeyHex[];
    /** Group topic/name (for group conversations) */
    topic?: string;
    /** Creation timestamp (Unix seconds) */
    createdAt: number;
}

// ─── Messages ─────────────────────────────────────────────────────────────────

/** Supported content types */
export type MessageContentType = 'text' | 'reaction' | 'reply' | 'attachment';

/** A decoded message within a conversation */
export interface SporeMessage {
    /** Nostr event id */
    id: string;
    /** Sender's Nostr pubkey */
    senderPubkey: NostrPubkeyHex;
    /** Plaintext content (after NIP-44 decryption) */
    content: string;
    /** Content type */
    contentType: MessageContentType;
    /** Unix timestamp (seconds) */
    sentAt: number;
    /** Reference to parent message id (for replies / reactions) */
    referencedMessageId?: string;
    /** The conversation this message belongs to */
    conversation: SporeConversation;
    /** Raw Nostr event for advanced use */
    rawEvent: SignedNostrEvent;
}

// ─── Agent Config ─────────────────────────────────────────────────────────────

/** Deployment environment */
export type SporeEnv = 'dev' | 'test' | 'production';

/** Configuration for SporeAgent */
export interface SporeAgentConfig {
    /** Hex private key for AirAccount EOA / Nostr identity */
    privateKeyHex: string;
    /** Relay URLs to connect to (overrides SPORE_RELAYS env var) */
    relays?: RelayUrl[];
    /** Environment: dev uses test relays with looser policies (default: 'dev') */
    env?: SporeEnv;
    /** Whether to log debug messages (default: false) */
    debug?: boolean;
}

// ─── Event Handler Types ───────────────────────────────────────────────────────

import type { MessageContext } from './MessageContext.js';
import type { ConversationContext } from './ConversationContext.js';

/** Map of all SporeAgent event names to their handler signatures */
export interface SporeAgentEventMap {
    /** Any text message received */
    text: (ctx: MessageContext) => Promise<void> | void;
    /** DM received (sealed-sender, NIP-17) */
    dm: (ctx: MessageContext) => Promise<void> | void;
    /** Group message received */
    group: (ctx: MessageContext) => Promise<void> | void;
    /** New conversation discovered */
    conversation: (ctx: ConversationContext) => Promise<void> | void;
    /** Generic message (any type) — fires before type-specific handlers */
    message: (ctx: MessageContext) => Promise<void> | void;
    /** Agent started and relay connections established */
    start: (agent: { address: string; pubkey: string }) => Promise<void> | void;
    /** Agent stopped */
    stop: () => Promise<void> | void;
    /** Unhandled error in a message handler */
    unhandledError: (error: Error, ctx: MessageContext) => Promise<void> | void;
    /** M2: Bridge failed to process a payment event (kind:23402–23405) */
    'bridge:error': (kind: number, event: SignedNostrEvent, error: Error) => Promise<void> | void;
}

export type SporeEventName = keyof SporeAgentEventMap;

// ─── NIP-17 Gift Wrap ─────────────────────────────────────────────────────────

/** Intermediate sealed event (kind:13) before gift wrapping */
export interface SealedEvent {
    kind: 13;
    content: string; // NIP-44 encrypted rumor
    created_at: number;
    tags: string[][];
    pubkey: string;
    id: string;
    sig: string;
}

/** NIP-17 Gift Wrap outer envelope (kind:1059) */
export interface GiftWrapEvent {
    kind: 1059;
    content: string; // NIP-44 encrypted seal
    created_at: number;
    tags: [['p', string], ...string[][]];
    pubkey: string; // random ephemeral key
    id: string;
    sig: string;
}
