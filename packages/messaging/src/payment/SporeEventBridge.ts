// SporeEventBridge — base interface and constants for M2 on-chain bridge layer.
// Each bridge handles one specific Nostr event kind and settles it on-chain.

import type { SignedNostrEvent } from '../types.js';

// Re-export SignedNostrEvent for convenience in bridge files
export type { SignedNostrEvent };

// ─── Spore Payment Event Kind Constants ──────────────────────────────────────

/** kind:23402 — x402 EIP-3009 payment request */
export const SPORE_KIND_X402 = 23402 as const;

/** kind:23403 — channel micropayment voucher */
export const SPORE_KIND_CHANNEL = 23403 as const;

/** kind:23404 — gasless ERC-4337 UserOp trigger */
export const SPORE_KIND_USEROP = 23404 as const;

/** kind:23405 — pay-per-store storage commitment (M3) */
export const SPORE_KIND_STORAGE = 23405 as const;

/** Union of all Spore payment event kinds */
export type SporeKind =
  | typeof SPORE_KIND_X402
  | typeof SPORE_KIND_CHANNEL
  | typeof SPORE_KIND_USEROP
  | typeof SPORE_KIND_STORAGE;

// ─── Bridge Result ────────────────────────────────────────────────────────────

/**
 * Result returned by SporeEventBridge.handle().
 * On success, txHash is the on-chain transaction hash (or userOpHash for bundler).
 * replyContent is forwarded as the Nostr reply event content when the bridge
 * sends a confirmation message back.
 */
export interface BridgeResult {
  success: boolean;
  txHash?: string;
  error?: string;
  replyContent?: Record<string, unknown>;
}

// ─── SporeEventBridge Interface ───────────────────────────────────────────────

/**
 * SporeEventBridge<K> — generic interface for all M2 on-chain bridges.
 *
 * A bridge handles events of a single Nostr kind K, translating them into
 * on-chain actions. Bridges are registered with SporeAgent.registerBridge()
 * and are invoked when a matching event arrives.
 *
 * Design principle: zero direct blockchain dependencies in @aastar/messaging.
 * All on-chain interactions happen through injected client interfaces
 * (X402ClientLike, ChannelClientLike, BundlerClientLike).
 */
export interface SporeEventBridge<K extends SporeKind> {
  /** The Nostr event kind this bridge handles */
  readonly kind: K;

  /**
   * Handle an incoming Nostr event of kind K.
   * Returns a BridgeResult indicating success or failure.
   * Must not throw — all errors should be captured in the result.
   */
  handle(event: SignedNostrEvent): Promise<BridgeResult>;
}
