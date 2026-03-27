// SporeTransport — pluggable transport interface for Spore Protocol.
//
// Abstracts away the underlying wire protocol so SporeAgent can run over
// multiple transports without changing application code:
//
//   - NostrTransport  (default) — WebSocket relay pool, NIP-17 gift-wrap
//   - WakuTransport  (M12)     — libp2p peer-to-peer, content-topic routing
//   - (future)        LoraWan, Matrix, ...
//
// Design principle: SporeTransport is a thin adapter. It does NOT own message
// parsing or codec resolution — those remain in SporeAgent. The transport only
// knows how to send opaque strings and subscribe to incoming opaque strings.

import type { SendDmOptions, SendGroupMessageOptions } from './NostrTransport.js';
import type { SporeConversation, SporeMessage } from '../types.js';

// ─── Transport Interface ──────────────────────────────────────────────────────

/**
 * Pluggable transport interface for Spore Protocol.
 * Implement this to add a new wire protocol (Waku, Matrix, etc.)
 * without modifying SporeAgent.
 */
export interface SporeTransport {
  /**
   * Send an encrypted DM to a recipient.
   * @returns The transport-level message ID (event ID, hash, etc.)
   */
  sendDm(opts: SendDmOptions): Promise<string>;

  /**
   * Send a message to a group conversation.
   * @returns The transport-level message ID.
   */
  sendGroupMessage(opts: SendGroupMessageOptions): Promise<string>;

  /**
   * Subscribe to incoming DMs addressed to this pubkey.
   * @param myPubkeyHex - Own pubkey (hex)
   * @param onMessage   - Called for each decrypted incoming message
   * @returns Unsubscribe function
   */
  subscribeToDms(
    myPubkeyHex: string,
    onMessage: (msg: SporeMessage, conv: SporeConversation) => void,
    opts?: { signal?: AbortSignal }
  ): () => void;

  /**
   * Subscribe to incoming group messages for the given group IDs.
   * @param groupIds  - Group IDs to subscribe to
   * @param onMessage - Called for each incoming group message
   * @returns Unsubscribe function
   */
  subscribeToGroups(
    groupIds: string[],
    onMessage: (msg: SporeMessage, conv: SporeConversation) => void
  ): () => void;

  /**
   * Fetch historical messages for a conversation.
   * Returns an empty array if the transport does not support history.
   */
  queryMessages(convId: string, opts?: { limit?: number; since?: number }): Promise<SporeMessage[]>;

  /**
   * Transport identifier for logging and routing.
   * Examples: 'nostr', 'waku', 'matrix'
   */
  readonly name: string;
}
