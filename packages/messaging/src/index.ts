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
export { InMemoryNonceStore, FileNonceStore, InMemoryVoucherStore } from './payment/NonceStore.js';
export type { NonceStore, VoucherStore, BestVoucher } from './payment/NonceStore.js';

// ─── M8: Identity Registry + Multi-Device ────────────────────────────────────
export { SporeIdentityRegistry, KIND_PROFILE, KIND_DEVICE_LIST } from './identity/SporeIdentityRegistry.js';
export type {
    IdentityProfile,
    LinkedDevice,
    LinkDeviceOptions,
} from './identity/SporeIdentityRegistry.js';

// ─── M9: MLS Key Agreement ────────────────────────────────────────────────────
export {
    SporeKeyAgreement,
    KIND_KEY_PACKAGE,
    KIND_MLS_WELCOME,
    KIND_MLS_GROUP_MESSAGE,
    SPORE_MLS_WELCOME_PREFIX,
    SPORE_MLS_CIPHER,
} from './keyagreement/SporeKeyAgreement.js';
export type {
    MlsGroupState,
    MlsWelcomePayload,
} from './types.js';

// ─── M7: Content Type Codecs ──────────────────────────────────────────────────

// Codec framework
export { CodecRegistry, contentTypeIdToString, parseContentTypeId } from './codecs/SporeCodec.js';
export type { SporeCodec, SporeContentTypeId } from './codecs/SporeCodec.js';

// Built-in codecs
export { TextCodec, ContentTypeText } from './codecs/TextCodec.js';
export { ReactionCodec, ContentTypeReaction } from './codecs/ReactionCodec.js';
export type { ReactionContent, ReactionAction } from './codecs/ReactionCodec.js';
export { ReplyCodec, ContentTypeReply } from './codecs/ReplyCodec.js';
export type { ReplyContent } from './codecs/ReplyCodec.js';
export { RemoteAttachmentCodec, ContentTypeRemoteAttachment } from './codecs/RemoteAttachmentCodec.js';
export type { RemoteAttachmentContent } from './codecs/RemoteAttachmentCodec.js';

// ─── M12: Waku Transport Adapter ─────────────────────────────────────────────
export { WakuTransport } from './transport/WakuTransport.js';
export type { WakuTransportConfig, WakuNodeLike } from './transport/WakuTransport.js';
export type { SporeTransport } from './transport/SporeTransport.js';

// ─── M11: Mainnet Hardening ───────────────────────────────────────────────────
export { RateLimiter, InMemoryRateLimitStore } from './hardening/RateLimiter.js';
export type { RateLimiterConfig, RateLimitStore } from './hardening/RateLimiter.js';
export { runMainnetChecklist } from './hardening/MainnetChecklist.js';
export type {
    MainnetChecklistInput,
    ChecklistReport,
    CheckResult,
    CheckSeverity,
} from './hardening/MainnetChecklist.js';

// ─── M10: HTTP/SSE Gateway ────────────────────────────────────────────────────
export { SporeHttpGateway } from './gateway/SporeHttpGateway.js';
export type { SporeHttpGatewayConfig } from './gateway/SporeHttpGateway.js';
export type {
    SendMessageRequest,
    SendMessageResponse,
    ConversationsResponse,
    MessagesResponse,
    MessageSummary,
    ConversationSummary,
    StreamEvent,
    GatewayErrorResponse,
} from './gateway/GatewayTypes.js';
