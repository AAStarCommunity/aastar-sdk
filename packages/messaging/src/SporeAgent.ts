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
import { verifyEvent } from 'nostr-tools';
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
    ListConversationsOptions,
    GetMessagesOptions,
    StreamAllMessagesOptions,
    CreateGroupOptions,
    GroupInfo,
    MlsGroupState,
} from './types.js';
import { KIND_GIFT_WRAP, KIND_GROUP_ADD, KIND_GROUP_REMOVE } from './transport/NostrTransport.js';
import type { Filter } from 'nostr-tools';
import { randomBytes } from 'node:crypto';
import type { SporeEventBridge, SporeKind } from './payment/SporeEventBridge.js';
import { CodecRegistry, type SporeCodec } from './codecs/SporeCodec.js';
import { TextCodec } from './codecs/TextCodec.js';
import {
    SporeIdentityRegistry,
    type IdentityProfile,
    type LinkedDevice,
    type LinkDeviceOptions,
} from './identity/SporeIdentityRegistry.js';
import {
    SporeKeyAgreement,
    KIND_MLS_GROUP_MESSAGE,
} from './keyagreement/SporeKeyAgreement.js';
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

    /** M7: Registered content type codecs keyed by content type id string */
    private readonly codecRegistry = new CodecRegistry([new TextCodec()]);

    /** M8: Identity registry for profile + multi-device operations */
    private readonly identityRegistry: SporeIdentityRegistry;

    /** M9: MLS key agreement primitives */
    private readonly keyAgreement: SporeKeyAgreement;

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
        this.identityRegistry = new SporeIdentityRegistry(pool, config.debug ?? false);
        this.keyAgreement = new SporeKeyAgreement(config.debug ?? false);
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

        if (this.config.debug) {
            console.debug(
                `[SporeAgent] starting — pubkey: ${this.identity.pubkey}, address: ${this.identity.address}`
            );
        }

        // MED-2: Async callbacks wrapped with .catch() to prevent unhandled promise rejections.
        // Subscribe to incoming DMs
        const unsubDm = this.transport.subscribeToDms(
            this.identity.pubkey,
            this.identity.privateKeyHex,
            (message, _rawEvent) => {
                this.handleIncomingMessage(message).catch((err) => {
                    this.emit('unhandledError', err instanceof Error ? err : new Error(String(err)), null);
                });
            }
        );
        this.unsubscribeFns.push(unsubDm);

        // Subscribe to group messages
        const unsubGroup = this.transport.subscribeToGroups(
            this.identity.pubkey,
            [], // all groups
            (message, _rawEvent) => {
                this.handleIncomingMessage(message).catch((err) => {
                    this.emit('unhandledError', err instanceof Error ? err : new Error(String(err)), null);
                });
            }
        );
        this.unsubscribeFns.push(unsubGroup);

        // M2: Subscribe to bridge payment event kinds (23402–23405) if any bridges registered
        if (this.bridges.size > 0) {
            const bridgeKinds = [...this.bridges.keys()];
            // Subscribe once per kind with a #p filter so only events addressed to us arrive
            for (const kind of bridgeKinds) {
                const unsubBridge = this.pool.subscribe(
                    { kinds: [kind], '#p': [this.identity.pubkey] },
                    (rawEvent) => {
                        this.handleBridgeEvent(rawEvent as SignedNostrEvent).catch((err) => {
                            this.emit('bridge:error', kind, rawEvent as SignedNostrEvent, err instanceof Error ? err : new Error(String(err)));
                        });
                    }
                );
                this.unsubscribeFns.push(unsubBridge);
            }
        }

        // MED-1: Set running=true only after all subscriptions are established,
        // so a re-entrant start() call won't see running=true before we're ready.
        this.running = true;

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

    // ─── M7 Codec API ──────────────────────────────────────────────────────────

    /**
     * Register a content type codec.
     *
     * Registered codecs are used to:
     *   1. Decode incoming messages that carry a matching 'ct' tag
     *   2. Encode outgoing content and attach the 'ct' tag automatically
     *
     * Built-in TextCodec is always registered (handles plain text with no 'ct' tag).
     *
     * @example
     * ```ts
     * agent.registerCodec(new ReactionCodec());
     * agent.registerCodec(new RemoteAttachmentCodec());
     * ```
     */
    registerCodec(codec: SporeCodec<unknown>): this {
        this.codecRegistry.register(codec);
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

    // ─── M5: Conversations API ─────────────────────────────────────────────────

    /**
     * List known conversations.
     *
     * Returns conversations discovered during this session (from incoming messages).
     * Results are sorted by createdAt descending (newest first).
     *
     * @param opts - Filter/pagination options
     */
    listConversations(opts?: ListConversationsOptions): SporeConversation[] {
        const type = opts?.type ?? 'all';
        const limit = opts?.limit ?? 100;

        let convs = [...this.knownConversations.values()];
        if (type !== 'all') {
            convs = convs.filter((c) => c.type === type);
        }
        convs.sort((a, b) => b.createdAt - a.createdAt);
        return convs.slice(0, limit);
    }

    /**
     * Fetch historical messages for a known conversation.
     *
     * For DMs: queries kind:1059 gift-wrap events addressed to this agent
     * and decrypts them, returning only messages belonging to the given conversation.
     *
     * For groups: queries kind:11 events filtered by the group id tag.
     *
     * @param convId - Conversation id (from SporeConversation.id)
     * @param opts   - Pagination options (limit, since, until)
     * @returns Decoded messages sorted by sentAt ascending
     */
    async getMessages(convId: string, opts?: GetMessagesOptions): Promise<SporeMessage[]> {
        const conv = this.knownConversations.get(convId);
        if (!conv) return [];

        const limit = opts?.limit ?? 50;
        const base: Filter = { limit };
        if (opts?.since !== undefined) base.since = opts.since;
        if (opts?.until !== undefined) base.until = opts.until;

        let messages: SporeMessage[];

        if (conv.type === 'dm') {
            const filter: Filter = { ...base, kinds: [KIND_GIFT_WRAP], '#p': [this.identity.pubkey] };
            const events = await this.pool.fetchEvents(filter);
            messages = events
                .map((e) => this.transport.decryptDm(e, this.identity.privateKeyHex, this.identity.pubkey))
                .filter((m): m is SporeMessage => m !== null && m.conversation.id === convId);
        } else {
            // Group: convId IS the groupId (set by decodeGroupEvent)
            const filter: Filter = { ...base, kinds: [11], '#h': [convId] };
            const events = await this.pool.fetchEvents(filter);
            messages = events
                .map((e) => this.transport.decodeGroup(e))
                .filter((m): m is SporeMessage => m !== null);
        }

        // Sort by sentAt ascending (chronological order)
        messages.sort((a, b) => a.sentAt - b.sentAt);
        return messages;
    }

    /**
     * Stream all incoming messages as an AsyncIterable.
     *
     * Yields a MessageContext for every message received while the agent is running.
     * The stream ends when the abort signal fires or stop() is called.
     *
     * @example
     * ```ts
     * for await (const ctx of agent.streamAllMessages({ signal })) {
     *   console.log(ctx.message.content);
     * }
     * ```
     *
     * @param opts - Options including optional AbortSignal
     */
    async *streamAllMessages(opts?: StreamAllMessagesOptions): AsyncGenerator<MessageContext> {
        const queue: MessageContext[] = [];
        let notify: (() => void) | null = null;
        let stopped = false;

        const push = (ctx: MessageContext) => {
            queue.push(ctx);
            const fn = notify;
            notify = null;
            fn?.();
        };

        const stop = () => {
            stopped = true;
            const fn = notify;
            notify = null;
            fn?.();
        };

        // Check if signal is already aborted before starting
        if (opts?.signal?.aborted) return;

        this.on('message', push);
        opts?.signal?.addEventListener('abort', stop);

        try {
            while (!stopped) {
                if (queue.length > 0) {
                    yield queue.shift()!;
                } else {
                    await new Promise<void>((resolve) => {
                        notify = resolve;
                    });
                }
            }
        } finally {
            this.off('message', push);
            opts?.signal?.removeEventListener('abort', stop);
        }
    }

    // ─── M6: Group Management ──────────────────────────────────────────────────

    /**
     * Create a new group conversation.
     *
     * Generates a random 32-byte hex groupId, registers it in the local
     * conversation store, and optionally publishes a kind:9000 metadata event
     * to the relay if `opts.topic` is provided.
     *
     * @param opts - Optional topic and initial member pubkeys
     * @returns The newly created SporeConversation
     */
    async createGroup(opts?: CreateGroupOptions): Promise<SporeConversation> {
        const groupId = randomBytes(32).toString('hex');
        const members = [this.identity.pubkey, ...(opts?.initialMembers ?? [])];
        const now = Math.floor(Date.now() / 1000);

        const conv: SporeConversation = {
            id: groupId,
            type: 'group',
            members,
            topic: opts?.topic,
            createdAt: now,
        };

        this.knownConversations.set(groupId, conv);

        // Publish kind:9000 metadata if a topic was provided
        if (opts?.topic) {
            await this.transport.sendGroupMeta({
                senderPrivkeyHex: this.identity.privateKeyHex,
                groupId,
                name: opts.topic,
            });
        }

        // Add initial members via kind:9001 if any
        if (opts?.initialMembers && opts.initialMembers.length > 0) {
            await this.transport.sendGroupMembership({
                senderPrivkeyHex: this.identity.privateKeyHex,
                groupId,
                kind: KIND_GROUP_ADD,
                memberPubkeys: opts.initialMembers,
            });
        }

        if (this.config.debug) {
            console.debug('[SporeAgent] created group:', groupId, 'members:', members.length);
        }

        return conv;
    }

    /**
     * Add a member to a known group conversation.
     *
     * Updates the local member list and publishes a kind:9001 (add member) event
     * to notify other group participants.
     *
     * @param groupId  - Group identifier (from SporeConversation.id)
     * @param pubkeyHex - Nostr pubkey of the member to add
     * @throws If the group is not found in knownConversations
     */
    async addGroupMember(groupId: string, pubkeyHex: string): Promise<void> {
        const conv = this.knownConversations.get(groupId);
        if (!conv || conv.type !== 'group') {
            throw new Error(`SporeAgent.addGroupMember: group '${groupId}' not found`);
        }

        // Idempotent: skip if already a member
        if (conv.members.includes(pubkeyHex)) return;

        conv.members = [...conv.members, pubkeyHex];
        this.knownConversations.set(groupId, conv);

        await this.transport.sendGroupMembership({
            senderPrivkeyHex: this.identity.privateKeyHex,
            groupId,
            kind: KIND_GROUP_ADD,
            memberPubkeys: [pubkeyHex],
        });
    }

    /**
     * Remove a member from a known group conversation.
     *
     * Updates the local member list and publishes a kind:9002 (remove member) event
     * to notify other group participants.
     *
     * @param groupId  - Group identifier (from SporeConversation.id)
     * @param pubkeyHex - Nostr pubkey of the member to remove
     * @throws If the group is not found in knownConversations
     */
    async removeGroupMember(groupId: string, pubkeyHex: string): Promise<void> {
        const conv = this.knownConversations.get(groupId);
        if (!conv || conv.type !== 'group') {
            throw new Error(`SporeAgent.removeGroupMember: group '${groupId}' not found`);
        }

        // Idempotent: skip if already not a member
        if (!conv.members.includes(pubkeyHex)) return;

        conv.members = conv.members.filter((pk) => pk !== pubkeyHex);
        this.knownConversations.set(groupId, conv);

        await this.transport.sendGroupMembership({
            senderPrivkeyHex: this.identity.privateKeyHex,
            groupId,
            kind: KIND_GROUP_REMOVE,
            memberPubkeys: [pubkeyHex],
        });
    }

    /**
     * Get the current state of a known group.
     *
     * Returns the in-memory snapshot. For fresh group state from the relay,
     * call getMessages() to replay management events.
     *
     * @param groupId - Group identifier
     * @returns GroupInfo or null if the group is not known
     */
    getGroupInfo(groupId: string): GroupInfo | null {
        const conv = this.knownConversations.get(groupId);
        if (!conv || conv.type !== 'group') return null;

        return {
            id: conv.id,
            topic: conv.topic,
            members: [...conv.members],
            createdAt: conv.createdAt,
        };
    }

    // ─── M8: Identity Registry + Multi-Device ──────────────────────────────────

    /**
     * Publish this agent's NIP-01 profile metadata (kind:0).
     *
     * Includes the agent's Ethereum address in the "eth_address" field so that
     * other users can discover the Nostr pubkey for a given ETH address.
     *
     * @param profile - Profile fields to publish (eth address is auto-included)
     * @returns Nostr event id
     *
     * @example
     * ```ts
     * await agent.publishProfile({ name: 'Alice', about: 'Building on Spore' });
     * ```
     */
    async publishProfile(profile: Omit<IdentityProfile, 'nostrPubkey' | 'ethAddress'>): Promise<string> {
        return this.identityRegistry.publishProfile(this.identity.privateKeyHex, {
            ...profile,
            ethAddress: this.identity.address,
        });
    }

    /**
     * Fetch the identity profile for any Nostr pubkey.
     *
     * @param nostrPubkey - 64-char hex Nostr pubkey (default: self)
     * @param timeoutMs   - Relay query timeout in ms (default: 5000)
     * @returns IdentityProfile or null if not published
     */
    async fetchProfile(nostrPubkey?: string, timeoutMs = 5000): Promise<IdentityProfile | null> {
        return this.identityRegistry.fetchProfile(nostrPubkey ?? this.identity.pubkey, timeoutMs);
    }

    /**
     * Fetch identity profiles for multiple pubkeys in one relay query.
     *
     * @param nostrPubkeys - Array of 64-char hex pubkeys
     * @param timeoutMs    - Relay query timeout in ms (default: 5000)
     * @returns Map of nostrPubkey → IdentityProfile
     */
    async fetchProfiles(nostrPubkeys: string[], timeoutMs = 5000): Promise<Map<string, IdentityProfile>> {
        return this.identityRegistry.fetchProfiles(nostrPubkeys, timeoutMs);
    }

    /**
     * Link a device pubkey to this identity by publishing a device list (kind:10001).
     *
     * The device list is a replaceable event. Each call to linkDevice() fetches
     * the current list, appends the new device (if not already present), and
     * republishes the full list.
     *
     * @param devicePubkey - Nostr pubkey of the device to link
     * @param opts         - Optional label for the device
     * @returns Nostr event id of the updated device list
     *
     * @example
     * ```ts
     * await agent.linkDevice(devicePubkey, { label: 'iPhone 15' });
     * ```
     */
    async linkDevice(devicePubkey: string, opts?: LinkDeviceOptions): Promise<string> {
        // Fetch current list to avoid overwriting existing devices
        const existing = await this.identityRegistry.fetchDeviceList(this.identity.pubkey);

        // Idempotent: skip if already linked
        if (existing.some((d) => d.pubkey === devicePubkey)) {
            if (this.config.debug) {
                console.debug('[SporeAgent] device already linked:', devicePubkey);
            }
            return '';
        }

        const updated: LinkedDevice[] = [
            ...existing,
            { pubkey: devicePubkey, label: opts?.label },
        ];

        return this.identityRegistry.publishDeviceList(this.identity.privateKeyHex, updated);
    }

    /**
     * Remove a device from the linked device list.
     *
     * Fetches the current list, removes the device, and republishes.
     * No-op if the device is not in the list.
     *
     * @param devicePubkey - Nostr pubkey of the device to unlink
     * @returns Nostr event id (empty string if device was not found)
     */
    async unlinkDevice(devicePubkey: string): Promise<string> {
        const existing = await this.identityRegistry.fetchDeviceList(this.identity.pubkey);
        const filtered = existing.filter((d) => d.pubkey !== devicePubkey);

        if (filtered.length === existing.length) {
            return ''; // not in list, no-op
        }

        return this.identityRegistry.publishDeviceList(this.identity.privateKeyHex, filtered);
    }

    /**
     * Fetch the list of devices linked to this identity.
     *
     * @param primaryPubkey - Primary pubkey to query (default: self)
     * @param timeoutMs     - Relay query timeout in ms (default: 5000)
     * @returns Array of LinkedDevice entries
     */
    async getLinkedDevices(primaryPubkey?: string, timeoutMs = 5000): Promise<LinkedDevice[]> {
        return this.identityRegistry.fetchDeviceList(primaryPubkey ?? this.identity.pubkey, timeoutMs);
    }

    /**
     * Check if a pubkey is a linked device of a given identity.
     *
     * @param primaryPubkey - Primary identity pubkey
     * @param devicePubkey  - Device pubkey to verify
     */
    async isLinkedDevice(primaryPubkey: string, devicePubkey: string): Promise<boolean> {
        return this.identityRegistry.isLinkedDevice(primaryPubkey, devicePubkey);
    }

    // ─── M9: MLS Key Agreement ─────────────────────────────────────────────────

    /**
     * Publish a NIP-104 KeyPackage (kind:443) for this device.
     *
     * Should be called once per device on first use, and periodically to
     * refresh the key package (e.g. every 30 days).
     *
     * @returns Nostr event id of the published KeyPackage
     */
    async publishKeyPackage(): Promise<string> {
        return this.keyAgreement.publishKeyPackage(this.identity.privateKeyHex, this.pool);
    }

    /**
     * Fetch KeyPackages for a set of pubkeys.
     *
     * Used to verify device participation before sending group Welcomes.
     * Events with invalid Schnorr signatures are silently discarded.
     *
     * @param pubkeys   - Device pubkeys to query
     * @param timeoutMs - Relay query timeout (default: 5000ms)
     */
    async fetchKeyPackages(
        pubkeys: string[],
        timeoutMs = 5000
    ): Promise<Map<string, { pubkey: string; eventId: string }>> {
        return this.keyAgreement.fetchKeyPackages(pubkeys, this.pool, timeoutMs);
    }

    /**
     * Create an MLS group and deliver the epoch key to all members via NIP-17 DM.
     *
     * Generates a random epoch-0 key, then NIP-17 DM-encrypts a Welcome to each
     * member.  The Welcome DM is identified by SPORE_MLS_WELCOME_PREFIX in the
     * plaintext.  Members call processWelcome() on receipt.
     *
     * @param memberPubkeys - Nostr pubkeys of all members to invite (excluding self)
     * @param groupId       - Optional group identifier (default: random 32-byte hex)
     * @returns Initial MlsGroupState (caller must persist this)
     */
    async createMlsGroup(memberPubkeys: string[], groupId?: string): Promise<MlsGroupState> {
        const id = groupId ?? randomBytes(32).toString('hex');
        const allMembers = [this.identity.pubkey, ...memberPubkeys];
        const state = this.keyAgreement.createGroup(id, allMembers);

        const welcome = this.keyAgreement.buildWelcomePayload(state);
        const dmContent = this.keyAgreement.encodeWelcomeDmContent(welcome);

        // Deliver Welcome to each member via NIP-17 gift-wrap DM
        for (const memberPubkey of memberPubkeys) {
            await this.transport.sendDm({
                senderPrivkeyHex: this.identity.privateKeyHex,
                senderPubkeyHex: this.identity.pubkey,
                recipientPubkeyHex: memberPubkey,
                content: dmContent,
            });
        }

        if (this.config.debug) {
            console.debug('[SporeAgent] MLS group created:', id, 'members:', allMembers.length);
        }

        return state;
    }

    /**
     * Send an encrypted group message (kind:445) using the current epoch key.
     *
     * Optionally ratchets the epoch key after sending to provide forward secrecy.
     * When ratcheting, all group members must ratchet in sync (after each message
     * or on a scheduled boundary).
     *
     * @param state     - Current MLS group state
     * @param plaintext - UTF-8 message to encrypt and publish
     * @param ratchet   - If true, ratchet the epoch key after sending (default: false)
     * @returns The Nostr event id and the (possibly updated) group state
     */
    async sendMlsMessage(
        state: MlsGroupState,
        plaintext: string,
        ratchet = false
    ): Promise<{ eventId: string; updatedState: MlsGroupState }> {
        const ciphertext = this.keyAgreement.encryptGroupMessage(plaintext, state.epochKey);
        const event = this.keyAgreement.buildGroupMessageEvent(
            this.identity.privateKeyHex,
            state.groupId,
            state.epoch,
            ciphertext
        );

        await this.pool.publish(event);

        const updatedState = ratchet ? this.keyAgreement.ratchetEpoch(state) : state;
        return { eventId: event.id, updatedState };
    }

    /**
     * Decrypt a received kind:445 group message event.
     *
     * Verifies the Schnorr signature before decrypting.
     * Returns null if verification fails or decryption throws.
     *
     * @param event    - Raw kind:445 Nostr event
     * @param epochKey - 32-byte epoch key from MlsGroupState
     * @returns Decrypted plaintext or null on failure
     */
    decryptMlsMessage(event: SignedNostrEvent, epochKey: Uint8Array): string | null {
        try {
            if (event.kind !== KIND_MLS_GROUP_MESSAGE) return null;
            if (!verifyEvent(event)) return null;
            return this.keyAgreement.decryptGroupMessage(event.content, epochKey);
        } catch {
            return null;
        }
    }

    /**
     * Parse an incoming DM content string as a Welcome message.
     *
     * Call this inside an 'message' handler to detect when another user has
     * invited this agent to an MLS group.
     *
     * @param dmContent - Decrypted content of an incoming NIP-17 DM
     * @returns MlsGroupState if the content is a valid Welcome, null otherwise
     *
     * @example
     * ```ts
     * agent.on('message', async (ctx) => {
     *   const groupState = agent.processWelcome(ctx.message.content);
     *   if (groupState) {
     *     console.log('Joined MLS group', groupState.groupId);
     *   }
     * });
     * ```
     */
    processWelcome(dmContent: string): MlsGroupState | null {
        const payload = this.keyAgreement.parseWelcomeDmContent(dmContent);
        if (!payload) return null;
        return this.keyAgreement.processWelcome(payload);
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

        // M7: Decode structured content using registered codec (if any)
        this.decodeMessageContent(message);

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

        // HIGH-8: Verify Nostr event id hash and Schnorr signature before routing to a bridge.
        // Bridge events arrive from external relays that may not enforce NIP-01 validation.
        // An unverified event could carry a spoofed pubkey or tampered payload.
        if (!verifyEvent(event)) {
            if (this.config.debug) {
                console.warn('[SporeAgent] dropped bridge event with invalid id/sig:', event.id);
            }
            return;
        }

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

    /**
     * M7: Attempt to decode message content using the registered codec.
     * Mutates message.decodedContent in place (safe — this object is not shared).
     * Silently ignores decoding errors so malformed payloads don't crash handlers.
     */
    private decodeMessageContent(message: SporeMessage): void {
        if (!message.contentTypeId) return;
        const codec = this.codecRegistry.get(message.contentTypeId);
        if (!codec) return;
        try {
            message.decodedContent = codec.decode(message.content);
        } catch {
            if (this.config.debug) {
                console.warn('[SporeAgent] codec decode failed for', message.contentTypeId);
            }
        }
    }

    /**
     * M7: Send a typed message using a registered codec.
     * Encodes the content, attaches the 'ct' tag, and sends via the appropriate transport.
     *
     * @param conversation - Target conversation
     * @param contentTypeId - Content type id string ("authority/type/version")
     * @param content       - Structured content to encode
     * @returns Nostr event id
     */
    async sendTypedMessage(
        conversation: SporeConversation,
        contentTypeId: string,
        content: unknown
    ): Promise<string> {
        const codec = this.codecRegistry.get(contentTypeId);
        if (!codec) {
            throw new Error(`SporeAgent: no codec registered for content type '${contentTypeId}'`);
        }
        const encoded = codec.encode(content);

        if (conversation.type === 'dm') {
            const recipientPubkey = conversation.members.find((pk) => pk !== this.identity.pubkey);
            if (!recipientPubkey) {
                throw new Error('SporeAgent.sendTypedMessage: cannot determine DM recipient');
            }
            return this.transport.sendDm({
                senderPrivkeyHex: this.identity.privateKeyHex,
                senderPubkeyHex: this.identity.pubkey,
                recipientPubkeyHex: recipientPubkey,
                content: encoded,
                contentTypeId,
            });
        } else {
            return this.transport.sendGroupMessage({
                senderPrivkeyHex: this.identity.privateKeyHex,
                senderPubkeyHex: this.identity.pubkey,
                groupId: conversation.id,
                memberPubkeys: conversation.members.filter((pk) => pk !== this.identity.pubkey),
                content: encoded,
                contentTypeId,
            });
        }
    }

    private buildMessageContext(message: SporeMessage): MessageContext {
        return new MessageContext({
            message,
            transport: this.transport,
            selfPrivkeyHex: this.identity.privateKeyHex,
            selfPubkeyHex: this.identity.pubkey,
            codecRegistry: this.codecRegistry,
            sendTypedMessage: this.sendTypedMessage.bind(this),
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
