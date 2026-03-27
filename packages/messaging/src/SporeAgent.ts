// SporeAgent — main entry point for the Spore Protocol SDK.
//
// Mirrors the @xmtp/agent-sdk Agent class API exactly so callers can migrate
// by swapping a single import line:
//
//   // Before:
//   import { Agent } from '@xmtp/agent-sdk';
//   // After:
//   import { SporeAgent as Agent } from '@aastar/messaging';
//
// Architecture:
//   SporeAgent (EventEmitter)
//       └── AirAccountIdentity  (EOA → Nostr pubkey)
//       └── RelayPool           (multi-relay WebSocket management)
//       └── NostrTransport      (event building, NIP-17 gift wrap)
//       └── MessageContext      (per-message handler context)
//       └── ConversationContext (per-conversation handler context)

import { EventEmitter } from 'node:events';
import { createIdentity, createIdentityFromEnv } from './identity/AirAccountIdentity.js';
import { RelayPool, DEFAULT_RELAYS, parseRelaysFromEnv } from './relay/RelayPool.js';
import { NostrTransport } from './transport/NostrTransport.js';
import { MessageContext } from './MessageContext.js';
import { ConversationContext } from './ConversationContext.js';
import type {
    SporeAgentConfig,
    SporeAgentEventMap,
    SporeEventName,
    SporeIdentity,
    SporeMessage,
    SporeConversation,
    RelayUrl,
    SignedNostrEvent,
} from './types.js';
import type { SporeEventBridge, SporeKind } from './payment/SporeEventBridge.js';
import { X402Bridge } from './payment/X402Bridge.js';
import { ChannelBridge } from './payment/ChannelBridge.js';
import { UserOpBridge } from './payment/UserOpBridge.js';
import type { X402BridgeConfig } from './payment/X402Bridge.js';
import type { ChannelBridgeConfig } from './payment/ChannelBridge.js';
import type { UserOpBridgeConfig } from './payment/UserOpBridge.js';

// ─── SporeAgent ───────────────────────────────────────────────────────────────

/**
 * SporeAgent is the primary class for building messaging agents on the Spore
 * Protocol. It provides an EventEmitter-based API identical to the XMTP
 * agent-sdk Agent class, but with Nostr/NIP-17 as the transport layer and
 * AirAccount EOA keys as the identity layer.
 *
 * @example
 * ```ts
 * const agent = await SporeAgent.createFromEnv();
 *
 * agent.on('text', async (ctx) => {
 *   await ctx.sendText(`Echo: ${ctx.message.content}`);
 * });
 *
 * await agent.start();
 * ```
 */
export class SporeAgent extends EventEmitter {
    private readonly identity: SporeIdentity;
    private readonly pool: RelayPool;
    private readonly transport: NostrTransport;
    private readonly config: SporeAgentConfig;

    /** Subscription closers — called on stop() */
    private readonly unsubscribeFns: Array<() => void> = [];

    /** Whether the agent is currently running */
    private running = false;

    /** Tracks known conversations to emit 'conversation' events only once */
    private readonly knownConversations = new Map<string, SporeConversation>();

    /** M2: Registered on-chain bridges keyed by Nostr event kind */
    private readonly bridges = new Map<number, SporeEventBridge<SporeKind>>();

    private constructor(
        identity: SporeIdentity,
        pool: RelayPool,
        transport: NostrTransport,
        config: SporeAgentConfig
    ) {
        super({ captureRejections: true });
        this.identity = identity;
        this.pool = pool;
        this.transport = transport;
        this.config = config;
    }

    // ─── Factory methods ───────────────────────────────────────────────────────

    /**
     * Create a SporeAgent from environment variables.
     *
     * Required env vars:
     *   SPORE_WALLET_KEY  — hex-encoded 32-byte private key (0x prefix optional)
     *
     * Optional env vars:
     *   SPORE_RELAYS      — comma-separated relay WebSocket URLs
     *   SPORE_ENV         — "dev" | "production" (default: "dev")
     */
    static async createFromEnv(): Promise<SporeAgent> {
        const identity = await createIdentityFromEnv();
        const relays = parseRelaysFromEnv();
        const env = (process.env['SPORE_ENV'] as 'dev' | 'production') ?? 'dev';

        const config: SporeAgentConfig = {
            privateKeyHex: identity.privateKeyHex,
            relays: relays.length > 0 ? relays : DEFAULT_RELAYS,
            env,
            debug: env === 'dev',
        };

        return SporeAgent.create(config);
    }

    /**
     * Create a SporeAgent with explicit configuration.
     *
     * @param config - Agent configuration (private key, relays, env, debug)
     */
    static async create(config: SporeAgentConfig): Promise<SporeAgent> {
        // Derive Nostr identity from the AirAccount EOA private key
        const identity = await createIdentity(config.privateKeyHex);

        const relays: RelayUrl[] =
            config.relays && config.relays.length > 0 ? config.relays : DEFAULT_RELAYS;

        const pool = new RelayPool({
            relays,
            debug: config.debug ?? false,
            // Allow ws:// in dev/test environments; production requires wss://
            allowInsecure: config.env === 'dev' || config.env === 'test',
        });

        const transport = new NostrTransport(pool, config.debug ?? false);

        return new SporeAgent(identity, pool, transport, config);
    }

    // ─── EventEmitter typed overrides ─────────────────────────────────────────

    /**
     * Register an event handler.
     *
     * Supported events:
     *   'text'           — any text message received
     *   'dm'             — DM (NIP-17 gift-wrapped) received
     *   'group'          — group message received
     *   'message'        — any message (fires before type-specific handlers)
     *   'conversation'   — new conversation discovered
     *   'start'          — agent started
     *   'stop'           — agent stopped
     *   'unhandledError' — error thrown inside a message handler
     */
    on<E extends SporeEventName>(
        event: E,
        handler: SporeAgentEventMap[E]
    ): this {
        return super.on(event, handler as (...args: unknown[]) => void);
    }

    /** Remove a specific event handler */
    off<E extends SporeEventName>(
        event: E,
        handler: SporeAgentEventMap[E]
    ): this {
        return super.off(event, handler as (...args: unknown[]) => void);
    }

    /** Register a one-time event handler */
    once<E extends SporeEventName>(
        event: E,
        handler: SporeAgentEventMap[E]
    ): this {
        return super.once(event, handler as (...args: unknown[]) => void);
    }

    // ─── Lifecycle ─────────────────────────────────────────────────────────────

    /**
     * Start the agent.
     *
     * Establishes relay connections and begins listening for incoming messages.
     * Emits 'start' when ready. This method returns after subscriptions are set up
     * but the agent continues running until stop() is called.
     */
    async start(): Promise<void> {
        if (this.running) return;
        this.running = true;

        if (this.config.debug) {
            console.debug(
                `[SporeAgent] starting — pubkey: ${this.identity.pubkey}, address: ${this.identity.address}`
            );
        }

        // Subscribe to incoming DMs
        const unsubDm = this.transport.subscribeToDms(
            this.identity.pubkey,
            this.identity.privateKeyHex,
            (message, rawEvent) => this.handleIncomingMessage(message)
        );
        this.unsubscribeFns.push(unsubDm);

        // Subscribe to group messages
        const unsubGroup = this.transport.subscribeToGroups(
            this.identity.pubkey,
            [], // all groups
            (message, rawEvent) => this.handleIncomingMessage(message)
        );
        this.unsubscribeFns.push(unsubGroup);

        // M2: Subscribe to bridge payment event kinds (23402–23405) if any bridges registered
        if (this.bridges.size > 0) {
            const bridgeKinds = [...this.bridges.keys()];
            // Subscribe once per kind with a #p filter so only events addressed to us arrive
            for (const kind of bridgeKinds) {
                const unsubBridge = this.pool.subscribe(
                    { kinds: [kind], '#p': [this.identity.pubkey] },
                    (rawEvent) => this.handleBridgeEvent(rawEvent as SignedNostrEvent)
                );
                this.unsubscribeFns.push(unsubBridge);
            }
        }

        // Emit start event
        this.emit('start', {
            address: this.identity.address,
            pubkey: this.identity.pubkey,
        });

        if (this.config.debug) {
            console.debug('[SporeAgent] started, listening for messages');
        }
    }

    /**
     * Stop the agent.
     *
     * Closes all relay subscriptions and WebSocket connections.
     * Emits 'stop' when complete.
     */
    async stop(): Promise<void> {
        if (!this.running) return;
        this.running = false;

        // Close all active subscriptions
        for (const unsub of this.unsubscribeFns) {
            unsub();
        }
        this.unsubscribeFns.length = 0;

        // Close relay pool
        await this.pool.close();

        this.emit('stop');

        if (this.config.debug) {
            console.debug('[SporeAgent] stopped');
        }
    }

    // ─── Identity accessors ────────────────────────────────────────────────────

    /**
     * The Ethereum address derived from the AirAccount EOA private key.
     * Used for on-chain operations (SuperPaymaster, X402, ChannelClient).
     */
    get address(): `0x${string}` {
        return this.identity.address;
    }

    /**
     * The Nostr public key (32-byte hex) derived from the private key.
     * Used for Nostr message routing and subscription.
     */
    get pubkey(): string {
        return this.identity.pubkey;
    }

    /** Whether the agent is currently running */
    get isRunning(): boolean {
        return this.running;
    }

    // ─── M2 Bridge API ─────────────────────────────────────────────────────────

    /**
     * Register an on-chain bridge for a specific Nostr event kind.
     *
     * Bridges handle payment event kinds (23402–23405) by routing the raw
     * Nostr event to the appropriate on-chain settlement logic.
     *
     * @example
     * ```ts
     * agent.registerBridge(new X402Bridge({ x402Client }));
     * ```
     */
    registerBridge<K extends SporeKind>(bridge: SporeEventBridge<K>): this {
        this.bridges.set(bridge.kind, bridge as SporeEventBridge<SporeKind>);
        return this;
    }

    /**
     * Convenience method: enable x402 payment receiving on kind:23402.
     * Equivalent to registerBridge(new X402Bridge(config)).
     *
     * @example
     * ```ts
     * agent.enableX402({ x402Client, maxAmountPerRequest: 10_000_000n });
     * ```
     */
    enableX402(config: X402BridgeConfig): this {
        return this.registerBridge(new X402Bridge(config));
    }

    /**
     * Convenience method: enable channel voucher settlement on kind:23403.
     * Equivalent to registerBridge(new ChannelBridge(config)).
     *
     * @example
     * ```ts
     * agent.enableChannel({ channelClient, lazySettleThreshold: 5_000_000n });
     * ```
     */
    enableChannel(config: ChannelBridgeConfig): this {
        return this.registerBridge(new ChannelBridge(config));
    }

    /**
     * Convenience method: enable gasless UserOp triggering on kind:23404.
     * Equivalent to registerBridge(new UserOpBridge(config)).
     *
     * @example
     * ```ts
     * agent.enableUserOp({ bundlerClient, authMode: 'self_only', selfAddress: '0x...' });
     * ```
     */
    enableUserOp(config: UserOpBridgeConfig): this {
        return this.registerBridge(new UserOpBridge(config));
    }

    // ─── Send API ──────────────────────────────────────────────────────────────

    /**
     * Send a DM to a recipient identified by their Nostr pubkey.
     * This is a lower-level API; prefer using MessageContext/ConversationContext
     * inside event handlers.
     *
     * @param recipientPubkeyHex - Recipient's 32-byte Nostr pubkey (hex)
     * @param text               - UTF-8 text content
     * @returns Nostr event id of the sent gift-wrap
     */
    async sendDm(recipientPubkeyHex: string, text: string): Promise<string> {
        return this.transport.sendDm({
            senderPrivkeyHex: this.identity.privateKeyHex,
            senderPubkeyHex: this.identity.pubkey,
            recipientPubkeyHex,
            content: text,
        });
    }

    /**
     * Send a message to a group conversation.
     *
     * @param groupId      - Group identifier (NIP-29 'h' tag value)
     * @param memberPubkeys - Pubkeys of all group members (excluding self)
     * @param text         - UTF-8 text content
     * @returns Nostr event id
     */
    async sendGroupMessage(
        groupId: string,
        memberPubkeys: string[],
        text: string
    ): Promise<string> {
        return this.transport.sendGroupMessage({
            senderPrivkeyHex: this.identity.privateKeyHex,
            senderPubkeyHex: this.identity.pubkey,
            groupId,
            memberPubkeys,
            content: text,
        });
    }

    // ─── Incoming message pipeline ─────────────────────────────────────────────

    /**
     * Internal handler called for every decoded incoming SporeMessage.
     *
     * Pipeline:
     *   1. Emit 'conversation' if this is a new conversation
     *   2. Build MessageContext
     *   3. Emit 'message' (fires for all message types)
     *   4. Emit type-specific event: 'text' + ('dm' | 'group')
     *   5. On any handler error → emit 'unhandledError'
     */
    private async handleIncomingMessage(message: SporeMessage): Promise<void> {
        // Ignore messages we sent ourselves
        if (message.senderPubkey === this.identity.pubkey) return;

        // F1: Consent check — allowlist takes precedence over blocklist
        if (this.config.allowedSenders) {
            if (!this.config.allowedSenders.has(message.senderPubkey)) return;
        } else if (this.config.blockedSenders?.has(message.senderPubkey)) {
            return;
        }

        // Emit 'conversation' for new conversations
        const conv = message.conversation;
        if (!this.knownConversations.has(conv.id)) {
            this.knownConversations.set(conv.id, conv);
            const convCtx = this.buildConversationContext(conv);
            await this.safeEmit('conversation', convCtx);
        }

        const msgCtx = this.buildMessageContext(message);

        // Emit 'message' for all messages
        await this.safeEmit('message', msgCtx);

        // Emit 'text' for all text messages
        if (message.contentType === 'text') {
            await this.safeEmit('text', msgCtx);
        }

        // Emit type-specific events
        if (conv.type === 'dm') {
            await this.safeEmit('dm', msgCtx);
        } else if (conv.type === 'group') {
            await this.safeEmit('group', msgCtx);
        }
    }

    /**
     * M2: Route a raw Nostr payment event to its registered bridge.
     * Emits 'bridge:error' if the bridge returns failure or throws.
     *
     * @param event - Raw SignedNostrEvent from the relay subscription
     */
    private async handleBridgeEvent(event: SignedNostrEvent): Promise<void> {
        const bridge = this.bridges.get(event.kind);
        if (!bridge) return;

        try {
            const result = await bridge.handle(event);
            if (!result.success) {
                this.emit(
                    'bridge:error',
                    event.kind,
                    event,
                    new Error(result.error ?? 'unknown bridge error')
                );
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            this.emit('bridge:error', event.kind, event, error);
        }
    }

    /**
     * Emit an event safely: catches errors from handlers and re-emits as
     * 'unhandledError' (same pattern as XMTP agent-sdk).
     */
    private async safeEmit(event: string, ctx: MessageContext | ConversationContext): Promise<void> {
        const listeners = this.listeners(event);
        if (listeners.length === 0) return;

        for (const listener of listeners) {
            try {
                await (listener as Function)(ctx);
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                if (event !== 'unhandledError') {
                    this.emit('unhandledError', error, ctx);
                } else {
                    // Prevent infinite loop: log and continue
                    console.error('[SporeAgent] error in unhandledError handler:', error);
                }
            }
        }
    }

    private buildMessageContext(message: SporeMessage): MessageContext {
        return new MessageContext({
            message,
            transport: this.transport,
            selfPrivkeyHex: this.identity.privateKeyHex,
            selfPubkeyHex: this.identity.pubkey,
        });
    }

    private buildConversationContext(conversation: SporeConversation): ConversationContext {
        return new ConversationContext({
            conversation,
            transport: this.transport,
            senderPrivkeyHex: this.identity.privateKeyHex,
            senderPubkeyHex: this.identity.pubkey,
        });
    }
}
