// X402Bridge — handles kind:23402 x402 payment events.
// Decodes EIP-3009 authorization from Nostr event tags and settles on-chain
// via an injected X402ClientLike interface.

import type { SporeEventBridge, BridgeResult } from './SporeEventBridge.js';
import { SPORE_KIND_X402 } from './SporeEventBridge.js';
import { parseTagsToObject, validateX402Tags } from '../events/SporeEventTypes.js';
import type { SignedNostrEvent } from '../types.js';
import type { NonceStore } from './NonceStore.js';
import { InMemoryNonceStore } from './NonceStore.js';

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
  /**
   * Maximum seconds into the future that validBefore may be set.
   * Default: 86400 * 7 (7 days). Prevents commitments with multi-year expiry windows.
   */
  maxValidBeforeWindowSeconds?: number;
  /**
   * Nonce store for replay protection.
   * Defaults to InMemoryNonceStore (state lost on restart).
   * In production, inject a persistent store (SQLite, Redis, etc.).
   */
  nonceStore?: NonceStore;
}

// ─── Reject Reason ────────────────────────────────────────────────────────────

/** Possible rejection reasons for a kind:23402 payment event */
export type X402RejectReason =
  | 'amount_exceeds_limit'
  | 'nonce_already_used'
  | 'expired'
  | 'valid_before_too_far'
  | 'payer_not_allowed'
  | 'invalid_signature'
  | 'chain_mismatch'
  | 'missing_tags'
  | 'invalid_tag_format';

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

  private readonly nonceStore: NonceStore;

  constructor(private readonly config: X402BridgeConfig) {
    this.nonceStore = config.nonceStore ?? new InMemoryNonceStore();
  }

  async handle(event: SignedNostrEvent): Promise<BridgeResult> {
    // Step 1: Parse and validate tags
    const tagMap = parseTagsToObject(event.tags);
    if (!validateX402Tags(tagMap)) {
      return { success: false, error: 'missing_tags' };
    }

    const from = tagMap['from']![0] as `0x${string}`;
    const to = tagMap['to']![0] as `0x${string}`;
    const nonce = tagMap['nonce']![0] as `0x${string}`;
    const tokenAddress = tagMap['asset']![0] as `0x${string}`;
    const chainId = Number(tagMap['chain']![0]);
    const sig = tagMap['sig']![0] as `0x${string}`;

    // Validate numeric tag values before BigInt() conversion (throws on non-numeric strings)
    const amountStr = tagMap['amount']![0]!;
    const validBeforeStr = tagMap['valid_before']![0]!;
    if (!/^\d+$/.test(amountStr) || !/^\d+$/.test(validBeforeStr)) {
      return { success: false, error: 'invalid_tag_format' };
    }
    const amount = BigInt(amountStr);
    const validBefore = BigInt(validBeforeStr);

    // Step 2: Policy checks

    // Payer whitelist check (normalize to lowercase for comparison)
    if (this.config.allowedPayers && !this.config.allowedPayers.has(from.toLowerCase())) {
      return { success: false, error: 'payer_not_allowed' };
    }

    // Amount cap check
    if (this.config.maxAmountPerRequest !== undefined && amount > this.config.maxAmountPerRequest) {
      return { success: false, error: 'amount_exceeds_limit' };
    }

    // Expiry check: valid_before must be in the future but within the allowed window
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    if (validBefore <= nowSec) {
      return { success: false, error: 'expired' };
    }
    const maxWindow = BigInt(this.config.maxValidBeforeWindowSeconds ?? 86400 * 7);
    if (validBefore > nowSec + maxWindow) {
      return { success: false, error: 'valid_before_too_far' };
    }

    // Step 3: Atomic nonce claim — prevents TOCTOU replay under concurrent async stores
    const nonceKey = `${chainId}:${nonce}`;
    if (!(await this.nonceStore.claim(nonceKey))) {
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

      // Nonce already claimed atomically in step 3 before settlement
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
