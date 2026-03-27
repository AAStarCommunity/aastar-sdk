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
export {
    KIND_GIFT_WRAP, KIND_SEAL, KIND_RUMOR, KIND_METADATA, KIND_RELAY_LIST,
    KIND_GROUP_META, KIND_GROUP_ADD, KIND_GROUP_REMOVE,
} from './transport/NostrTransport.js';

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
    // M5 Conversations API
    ListConversationsOptions,
    GetMessagesOptions,
    StreamAllMessagesOptions,
    // M6 Group Management
    CreateGroupOptions,
    GroupInfo,
} from './types.js';

// ─── M2 Bridge Layer ──────────────────────────────────────────────────────────

// Bridge implementations
export { X402Bridge } from './payment/X402Bridge.js';
export { ChannelBridge } from './payment/ChannelBridge.js';
export { UserOpBridge } from './payment/UserOpBridge.js';

// Bridge kind constants
export {
    SPORE_KIND_X402,
    SPORE_KIND_CHANNEL,
    SPORE_KIND_USEROP,
    SPORE_KIND_STORAGE,
} from './payment/SporeEventBridge.js';

// Bridge types
export type {
    SporeEventBridge,
    SporeKind,
    BridgeResult,
} from './payment/SporeEventBridge.js';

export type {
    X402BridgeConfig,
    X402ClientLike,
    X402RejectReason,
} from './payment/X402Bridge.js';

export type {
    ChannelBridgeConfig,
    ChannelClientLike,
    ChannelState,
} from './payment/ChannelBridge.js';

export type {
    UserOpBridgeConfig,
    UserOpAuthMode,
    BundlerClientLike,
} from './payment/UserOpBridge.js';

// M2 event type system
export * from './events/SporeEventTypes.js';

// ─── Persistence Interfaces (H2/H3) ───────────────────────────────────────────
export { InMemoryNonceStore, InMemoryVoucherStore } from './payment/NonceStore.js';
export type { NonceStore, VoucherStore, BestVoucher } from './payment/NonceStore.js';
