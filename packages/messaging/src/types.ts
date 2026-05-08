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
    /** Raw content string (encoded payload — use decodedContent for structured data) */
    content: string;
    /** Content type (legacy simple union — prefer contentTypeId for M7+ codecs) */
    contentType: MessageContentType;
    /**
     * M7: Content type identifier string ("authority/type/version").
     * Present when the event carries a 'ct' tag. Used to look up the
     * registered SporeCodec for decoding structured content.
     * Absent for plain-text messages.
     */
    contentTypeId?: string;
    /**
     * M7: Structured content decoded by the matching SporeCodec.
     * Only populated by SporeAgent when a matching codec is registered.
     * Absent when no codec is registered or the message is plain text.
     */
    decodedContent?: unknown;
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
    /**
     * Consent allowlist: only messages from these Nostr pubkeys are processed.
     * Takes precedence over blockedSenders. If omitted, all senders are allowed.
     */
    allowedSenders?: Set<string>;
    /**
     * Consent blocklist: messages from these Nostr pubkeys are silently dropped.
     * Ignored if allowedSenders is set (allowlist takes full precedence).
     */
    blockedSenders?: Set<string>;
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
    /** Unhandled error in a message handler (ctx is null when error occurs outside a message context) */
    unhandledError: (error: Error, ctx: MessageContext | ConversationContext | null) => Promise<void> | void;
    /** M2: Bridge failed to process a payment event (kind:23402–23405) */
    'bridge:error': (kind: number, event: SignedNostrEvent, error: Error) => Promise<void> | void;
}

export type SporeEventName = keyof SporeAgentEventMap;

// ─── M5: Conversations API ────────────────────────────────────────────────────

/** Options for agent.listConversations() */
export interface ListConversationsOptions {
    /** Filter by conversation type. Default: 'all' */
    type?: ConversationType | 'all';
    /** Maximum number of conversations to return. Default: 100 */
    limit?: number;
}

/** Options for agent.getMessages() */
export interface GetMessagesOptions {
    /** Maximum number of messages to return. Default: 50 */
    limit?: number;
    /** Only return messages created after this Unix timestamp (seconds) */
    since?: number;
    /** Only return messages created before this Unix timestamp (seconds) */
    until?: number;
}

/** Options for agent.streamAllMessages() */
export interface StreamAllMessagesOptions {
    /** AbortSignal to stop the stream */
    signal?: AbortSignal;
}

// ─── M6: Group Management ─────────────────────────────────────────────────────

/** Options for creating a new group */
export interface CreateGroupOptions {
    /** Human-readable group name */
    topic?: string;
    /** Initial member pubkeys (not including self) */
    initialMembers?: string[];
}

/** Snapshot of a group's current state */
export interface GroupInfo {
    id: string;
    topic?: string;
    members: string[];
    createdAt: number;
}

// ─── M9: MLS Key Agreement ────────────────────────────────────────────────────

/**
 * Runtime state for an active MLS group.
 *
 * Must be persisted by the application; SporeKeyAgreement is stateless.
 * epochKey is sensitive — keep in memory; never serialise to disk unencrypted.
 */
export interface MlsGroupState {
    /** Unique group identifier (32-byte hex) */
    groupId: string;
    /** Current epoch number (0 at creation, incremented on each ratchet) */
    epoch: number;
    /** 32-byte symmetric key for the current epoch */
    epochKey: Uint8Array;
    /** Nostr pubkeys of all current group members */
    members: string[];
}

/**
 * Welcome payload carried inside a NIP-17 DM to a new group member.
 *
 * epochKeyHex is the shared group key — it must be NIP-44 encrypted to the
 * recipient before being sent (the DM transport handles this automatically).
 */
export interface MlsWelcomePayload {
    type: 'spore-mls-welcome';
    groupId: string;
    epoch: number;
    epochKeyHex: string;
    members: string[];
    cipher: string;
}

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
