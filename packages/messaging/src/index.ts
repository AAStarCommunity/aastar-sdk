// @aastar/messaging — Spore Protocol TypeScript SDK (M1 MVP)
//
// Primary exports for the messaging SDK.
// For XMTP drop-in compatibility, import from '@aastar/messaging/xmtp-compat'.

// ─── Main classes ─────────────────────────────────────────────────────────────
export { SporeAgent } from './SporeAgent.js';
export { MessageContext } from './MessageContext.js';
export { ConversationContext } from './ConversationContext.js';

// ─── Sub-module exports ────────────────────────────────────────────────────────
export * from './identity/AirAccountIdentity.js';
export * from './relay/RelayPool.js';
export * as crypto from './crypto/Nip44Crypto.js';
export { NostrTransport } from './transport/NostrTransport.js';
export { KIND_GIFT_WRAP, KIND_SEAL, KIND_RUMOR, KIND_METADATA, KIND_RELAY_LIST } from './transport/NostrTransport.js';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
    PrivateKeyHex,
    NostrPubkeyHex,
    SporeIdentity,
    RelayUrl,
    RelayPoolConfig,
    UnsignedNostrEvent,
    SignedNostrEvent,
    ConversationType,
    SporeConversation,
    MessageContentType,
    SporeMessage,
    SporeEnv,
    SporeAgentConfig,
    SporeAgentEventMap,
    SporeEventName,
    SealedEvent,
    GiftWrapEvent,
} from './types.js';
