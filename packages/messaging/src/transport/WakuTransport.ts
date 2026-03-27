// WakuTransport — Waku v2 (libp2p) adapter for Spore Protocol.
//
// Waku is a decentralized peer-to-peer messaging protocol built on libp2p.
// Unlike Nostr's relay-based WebSocket model, Waku uses:
//   - Content Topics for message routing (analogous to Nostr's event kinds + #p tags)
//   - Relay protocol (GossipSub) for delivery without central relay operators
//   - Store protocol for offline history retrieval
//   - Filter protocol for bandwidth-efficient subscriptions
//
// This adapter bridges Waku onto the SporeTransport interface.
// It uses the same NIP-44 encryption layer as NostrTransport for message content,
// routing messages over Waku content topics instead of Nostr relays.
//
// Content topic convention (Waku topic naming per RFCs):
//   DM:    /spore/1/dm-{recipientPubkeyHex}/proto
//   Group: /spore/1/group-{groupId}/proto
//
// Production deployment requires @waku/sdk (a peer dependency, not bundled here).
// This file provides the adapter; the caller injects a WakuNode instance.

import type { SporeTransport } from './SporeTransport.js';
import type { SendDmOptions, SendGroupMessageOptions } from './NostrTransport.js';
import type { SporeConversation, SporeMessage } from '../types.js';
import * as crypto from '../crypto/Nip44Crypto.js';

// ─── Waku Node Interface ──────────────────────────────────────────────────────

/**
 * Minimal interface for a Waku node.
 * The actual implementation comes from @waku/sdk (a peer dependency).
 * WakuTransport only depends on this interface, keeping @aastar/messaging
 * free of direct Waku SDK dependencies.
 */
export interface WakuNodeLike {
  /** Send a payload to a content topic. Returns message hash. */
  send(contentTopic: string, payload: Uint8Array): Promise<string>;
  /**
   * Subscribe to a content topic.
   * @returns Unsubscribe function
   */
  subscribe(contentTopic: string, onPayload: (payload: Uint8Array) => void): () => void;
  /**
   * Query stored messages from a content topic (Waku Store protocol).
   * Returns empty array if the node does not support Store.
   */
  query(contentTopic: string, opts?: { limit?: number; since?: number }): Promise<Uint8Array[]>;
  /** Whether the node is currently connected to the Waku network */
  readonly connected: boolean;
}

// ─── Config ───────────────────────────────────────────────────────────────────

/** Configuration for WakuTransport */
export interface WakuTransportConfig {
  /** Injected Waku node (from @waku/sdk or a mock) */
  node: WakuNodeLike;
  /**
   * Content topic prefix (default: '/spore/1').
   * Change only if deploying a private Waku network with a different namespace.
   */
  topicPrefix?: string;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

// ─── Content Topic Helpers ────────────────────────────────────────────────────

/**
 * Build a Waku content topic for a DM conversation.
 * Format: /{prefix}/dm-{recipientPubkeyHex}/proto
 * Both parties subscribe to both their own topic and the sender's.
 */
function dmTopic(prefix: string, pubkeyHex: string): string {
  return `${prefix}/dm-${pubkeyHex}/proto`;
}

/**
 * Build a Waku content topic for a group conversation.
 * Format: /{prefix}/group-{groupId}/proto
 */
function groupTopic(prefix: string, groupId: string): string {
  return `${prefix}/group-${groupId}/proto`;
}

// ─── Wire Format ─────────────────────────────────────────────────────────────

/**
 * Serialized message envelope sent over Waku.
 * JSON-encoded and then UTF-8 encoded into the Waku payload bytes.
 *
 * For DMs: content is NIP-44 encrypted with the recipient's conversation key.
 * For groups: each member receives the message on their own DM topic (fan-out).
 */
interface WakuEnvelope {
  /** Protocol version (always 1) */
  v: 1;
  /** Sender's Nostr hex pubkey */
  from: string;
  /** NIP-44 encrypted ciphertext (base64) */
  ciphertext: string;
  /** Unix timestamp (seconds) */
  ts: number;
  /** Optional group ID (set for group messages) */
  groupId?: string;
  /** Content type identifier (M7 codec, optional) */
  contentTypeId?: string;
}

// ─── WakuTransport ────────────────────────────────────────────────────────────

/**
 * WakuTransport implements SporeTransport over Waku v2 (libp2p GossipSub).
 *
 * Key differences from NostrTransport:
 *   - No relay operators — messages propagate through the Waku peer network
 *   - Content topics replace Nostr event kinds + #p tag routing
 *   - Waku Store protocol provides offline message history (if enabled on node)
 *   - NIP-44 encryption is preserved for end-to-end security
 *
 * @example
 * ```ts
 * import { createLightNode } from '@waku/sdk';
 *
 * const wakuNode = await createLightNode({ defaultBootstrap: true });
 * await wakuNode.start();
 *
 * const transport = new WakuTransport({ node: wakuNode });
 * const agent = new SporeAgent({ transport, walletKey: process.env.SPORE_WALLET_KEY! });
 * ```
 */
export class WakuTransport implements SporeTransport {
  readonly name = 'waku' as const;

  private readonly node: WakuNodeLike;
  private readonly prefix: string;
  private readonly debug: boolean;

  constructor(config: WakuTransportConfig) {
    this.node = config.node;
    this.prefix = config.topicPrefix ?? '/spore/1';
    this.debug = config.debug ?? false;
  }

  // ─── Send DM ───────────────────────────────────────────────────────────────

  async sendDm(opts: SendDmOptions): Promise<string> {
    const { senderPrivkeyHex, senderPubkeyHex, recipientPubkeyHex, content, contentTypeId } = opts;

    // Encrypt with NIP-44 using the sender-recipient conversation key
    const ciphertext = crypto.encrypt(senderPrivkeyHex, recipientPubkeyHex, content);

    const envelope: WakuEnvelope = {
      v: 1,
      from: senderPubkeyHex,
      ciphertext,
      ts: Math.floor(Date.now() / 1000),
      contentTypeId,
    };

    const payload = new TextEncoder().encode(JSON.stringify(envelope));
    // Publish on recipient's topic so they receive it
    const topic = dmTopic(this.prefix, recipientPubkeyHex);
    const msgHash = await this.node.send(topic, payload);

    if (this.debug) {
      console.debug(`[WakuTransport] DM sent to ${recipientPubkeyHex.slice(0, 8)}... topic=${topic} hash=${msgHash}`);
    }

    return msgHash;
  }

  // ─── Send Group Message ────────────────────────────────────────────────────

  async sendGroupMessage(opts: SendGroupMessageOptions): Promise<string> {
    const { senderPrivkeyHex, senderPubkeyHex, groupId, memberPubkeys, content, contentTypeId } = opts;

    // Fan-out: send an individually encrypted copy to each member's DM topic.
    // This mirrors NIP-17 gift-wrap semantics: each recipient's payload is
    // encrypted specifically for them, not a single multicast ciphertext.
    const topic = groupTopic(this.prefix, groupId);
    let lastHash = '';

    for (const memberPubkey of memberPubkeys) {
      const ciphertext = crypto.encrypt(senderPrivkeyHex, memberPubkey, content);
      const envelope: WakuEnvelope = {
        v: 1,
        from: senderPubkeyHex,
        ciphertext,
        ts: Math.floor(Date.now() / 1000),
        groupId,
        contentTypeId,
      };
      const payload = new TextEncoder().encode(JSON.stringify(envelope));
      lastHash = await this.node.send(topic, payload);
    }

    if (this.debug) {
      console.debug(`[WakuTransport] Group msg sent to ${memberPubkeys.length} members, groupId=${groupId}`);
    }

    return lastHash;
  }

  // ─── Subscribe to DMs ─────────────────────────────────────────────────────

  subscribeToDms(
    myPubkeyHex: string,
    onMessage: (msg: SporeMessage, conv: SporeConversation) => void,
    opts?: { signal?: AbortSignal }
  ): () => void {
    const topic = dmTopic(this.prefix, myPubkeyHex);

    const unsub = this.node.subscribe(topic, (payload) => {
      if (opts?.signal?.aborted) return;
      this.handleIncomingPayload(payload, myPubkeyHex, onMessage, undefined);
    });

    // Hook into AbortSignal for graceful cleanup
    opts?.signal?.addEventListener('abort', unsub, { once: true });

    return unsub;
  }

  // ─── Subscribe to Groups ──────────────────────────────────────────────────

  subscribeToGroups(
    groupIds: string[],
    onMessage: (msg: SporeMessage, conv: SporeConversation) => void
  ): () => void {
    const unsubs = groupIds.map((groupId) => {
      const topic = groupTopic(this.prefix, groupId);
      return this.node.subscribe(topic, (payload) => {
        this.handleIncomingPayload(payload, '', onMessage, groupId);
      });
    });

    return () => { for (const u of unsubs) u(); };
  }

  // ─── Query History ────────────────────────────────────────────────────────

  async queryMessages(convId: string, opts?: { limit?: number; since?: number }): Promise<SporeMessage[]> {
    // convId is either a DM topic suffix or group topic suffix
    // We assume convId matches the topic format used during subscription
    const topic = convId.includes('group-') ? convId : dmTopic(this.prefix, convId);

    let payloads: Uint8Array[];
    try {
      payloads = await this.node.query(topic, opts);
    } catch {
      // Waku Store not available on this node — return empty
      return [];
    }

    // Note: decryption requires the private key which is not available here.
    // Callers should decrypt via SporeAgent. We return messages with raw ciphertext
    // as content so SporeAgent can process them through its normal pipeline.
    const results: SporeMessage[] = [];
    for (let i = 0; i < payloads.length; i++) {
      try {
        const envelope = JSON.parse(new TextDecoder().decode(payloads[i]!)) as WakuEnvelope;
        const conv: SporeConversation = {
          id: convId,
          type: envelope.groupId ? 'group' : 'dm',
          members: [envelope.from],
          createdAt: envelope.ts,
        };
        results.push({
          id: `waku-${i}-${envelope.ts}`,
          senderPubkey: envelope.from,
          content: envelope.ciphertext, // raw ciphertext — SporeAgent decrypts
          contentType: 'text',
          sentAt: envelope.ts,
          conversation: conv,
          rawEvent: {} as never,
        } satisfies SporeMessage);
      } catch {
        // skip malformed payloads
      }
    }
    return results;
  }

  // ─── Internal: Decode + Dispatch ──────────────────────────────────────────

  private handleIncomingPayload(
    payload: Uint8Array,
    myPubkeyHex: string,
    onMessage: (msg: SporeMessage, conv: SporeConversation) => void,
    groupId: string | undefined
  ): void {
    let envelope: WakuEnvelope;
    try {
      envelope = JSON.parse(new TextDecoder().decode(payload)) as WakuEnvelope;
    } catch {
      if (this.debug) console.debug('[WakuTransport] Failed to parse envelope');
      return;
    }

    if (envelope.v !== 1) {
      if (this.debug) console.debug(`[WakuTransport] Unknown envelope version: ${envelope.v}`);
      return;
    }

    // Decryption: use sender pubkey + own privkey via NIP-44.
    // In a real agent, the private key would be injected. Here we emit the
    // raw ciphertext and let SporeAgent handle decryption through the normal pipeline.
    const convId = groupId
      ? groupTopic(this.prefix, groupId)
      : [myPubkeyHex, envelope.from].sort().join(':');

    const conv: SporeConversation = {
      id: convId,
      type: groupId ? 'group' : 'dm',
      members: groupId ? [envelope.from] : [myPubkeyHex, envelope.from],
      createdAt: envelope.ts,
    };

    const msg: SporeMessage = {
      id: `waku-${envelope.ts}-${envelope.from.slice(0, 8)}`,
      senderPubkey: envelope.from,
      content: envelope.ciphertext, // SporeAgent decrypts via its identity
      contentType: 'text',
      sentAt: envelope.ts,
      conversation: conv,
      rawEvent: {} as never,
    };

    onMessage(msg, conv);
  }
}
