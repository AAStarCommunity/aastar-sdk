// X402Bridge — handles kind:23402 x402 payment events.
// Decodes EIP-3009 authorization from Nostr event tags and settles on-chain
// via an injected X402ClientLike interface.

import type { SporeEventBridge, BridgeResult } from './SporeEventBridge.js';
import { SPORE_KIND_X402 } from './SporeEventBridge.js';
import { parseTagsToObject, validateX402Tags } from '../events/SporeEventTypes.js';
import type { SignedNostrEvent } from '../types.js';

// ─── Client Interface ─────────────────────────────────────────────────────────

/**
 * Minimal interface for an x402 payment client.
 * The actual implementation lives in @aastar/x402 (a peer package).
 * X402Bridge only depends on this interface, keeping @aastar/messaging
 * free of direct blockchain dependencies.
 */
export interface X402ClientLike {
  settlePayment(params: {
    from: `0x${string}`;
    to: `0x${string}`;
    amount: bigint;
    nonce: `0x${string}`;
    validBefore: bigint;
    tokenAddress: `0x${string}`;
    chainId: number;
    sig: `0x${string}`;
  }): Promise<{ txHash: `0x${string}` }>;
}

// ─── Config ───────────────────────────────────────────────────────────────────

/** Configuration for X402Bridge */
export interface X402BridgeConfig {
  /** Injected x402 client for on-chain settlement */
  x402Client: X402ClientLike;
  /** If set, reject payments from any address not in this set (lowercase) */
  allowedPayers?: Set<string>;
  /** Reject payment if amount exceeds this value (atomic units) */
  maxAmountPerRequest?: bigint;
  /** Timeout for the on-chain settlement call in seconds (default: 60) */
  settlementTimeoutSeconds?: number;
}

// ─── Reject Reason ────────────────────────────────────────────────────────────

/** Possible rejection reasons for a kind:23402 payment event */
export type X402RejectReason =
  | 'amount_exceeds_limit'
  | 'nonce_already_used'
  | 'expired'
  | 'payer_not_allowed'
  | 'invalid_signature'
  | 'chain_mismatch'
  | 'missing_tags';

// ─── X402Bridge ───────────────────────────────────────────────────────────────

/**
 * X402Bridge — on-chain bridge for kind:23402 x402 payment events.
 *
 * Processing pipeline:
 *   1. Parse and validate tags (structure check)
 *   2. Policy checks (payer whitelist, amount cap, expiry)
 *   3. Nonce idempotency check (in-memory; production uses persistent store)
 *   4. On-chain settlement via X402ClientLike.settlePayment()
 *   5. Mark nonce as used on success
 *
 * Thread safety note: nonce deduplication uses an in-memory Set. Production
 * deployments should replace this with a persistent store (Redis, SQLite).
 */
export class X402Bridge implements SporeEventBridge<typeof SPORE_KIND_X402> {
  readonly kind = SPORE_KIND_X402;

  // Track used nonces to prevent replay attacks.
  // Key format: "<chainId>:<nonce>"
  private readonly usedNonces = new Set<string>();

  constructor(private readonly config: X402BridgeConfig) {}

  async handle(event: SignedNostrEvent): Promise<BridgeResult> {
    // Step 1: Parse and validate tags
    const tagMap = parseTagsToObject(event.tags);
    if (!validateX402Tags(tagMap)) {
      return { success: false, error: 'missing_tags' };
    }

    const from = tagMap['from']![0] as `0x${string}`;
    const to = tagMap['to']![0] as `0x${string}`;
    const amount = BigInt(tagMap['amount']![0]);
    const nonce = tagMap['nonce']![0] as `0x${string}`;
    const validBefore = BigInt(tagMap['valid_before']![0]);
    const tokenAddress = tagMap['asset']![0] as `0x${string}`;
    const chainId = Number(tagMap['chain']![0]);
    const sig = tagMap['sig']![0] as `0x${string}`;

    // Step 2: Policy checks

    // Payer whitelist check (normalize to lowercase for comparison)
    if (this.config.allowedPayers && !this.config.allowedPayers.has(from.toLowerCase())) {
      return { success: false, error: 'payer_not_allowed' };
    }

    // Amount cap check
    if (this.config.maxAmountPerRequest !== undefined && amount > this.config.maxAmountPerRequest) {
      return { success: false, error: 'amount_exceeds_limit' };
    }

    // Expiry check: valid_before must be in the future
    if (validBefore < BigInt(Math.floor(Date.now() / 1000))) {
      return { success: false, error: 'expired' };
    }

    // Step 3: Nonce idempotency check
    const nonceKey = `${chainId}:${nonce}`;
    if (this.usedNonces.has(nonceKey)) {
      return { success: false, error: 'nonce_already_used' };
    }

    // Step 4: Settle on-chain
    try {
      const { txHash } = await this.config.x402Client.settlePayment({
        from,
        to,
        amount,
        nonce,
        validBefore,
        tokenAddress,
        chainId,
        sig,
      });

      // Step 5: Mark nonce as used only after successful settlement
      this.usedNonces.add(nonceKey);

      return {
        success: true,
        txHash,
        replyContent: { success: true, txHash },
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    }
  }
}
