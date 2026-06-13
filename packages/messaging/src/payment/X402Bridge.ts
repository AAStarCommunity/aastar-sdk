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

/**
 * Parameters passed to an offline EIP-3009 authorization verifier.
 * Mirror of the on-chain `TransferWithAuthorization` fields.
 */
export interface X402AuthorizationParams {
  from: `0x${string}`;
  to: `0x${string}`;
  amount: bigint;
  nonce: `0x${string}`;
  validBefore: bigint;
  tokenAddress: `0x${string}`;
  chainId: number;
  sig: `0x${string}`;
}

/** Shared configuration fields for X402Bridge */
interface X402BridgeConfigBase {
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
   * Default: 86400 (24 hours). Prevents attackers from pre-signing authorizations
   * with multi-day expiry windows that could be replayed long after intent.
   */
  maxValidBeforeWindowSeconds?: number;
  /**
   * Nonce store for replay protection.
   * Defaults to InMemoryNonceStore (state lost on restart).
   * In production, inject a persistent store (SQLite, Redis, etc.).
   */
  nonceStore?: NonceStore;
}

/**
 * Configuration for X402Bridge.
 *
 * You MUST supply one of:
 *   - `verifyAuthorization` — an offline EIP-3009 signature verifier that rejects invalid
 *     authorizations BEFORE any nonce is claimed or on-chain settlement is attempted. Without
 *     it, an attacker can spam invalid-signature events that burn nonce keys and force
 *     reverting settlePayment() calls that still cost the operator gas.
 *   - `skipSignatureVerification: true` — explicit opt-out (testing only).
 *
 * @aastar/messaging is intentionally free of blockchain dependencies, so the EIP-712 domain
 * (token name/version) needed to recover the signer is not available here. Implement
 * `verifyAuthorization` in the consuming layer (e.g. via @aastar/x402, which owns the domain).
 */
export type X402BridgeConfig = X402BridgeConfigBase &
  (
    | {
        /**
         * Offline EIP-3009 authorization verifier. Called before claiming a nonce or
         * settling on-chain. Returns true if the signature recovers to `from`.
         */
        verifyAuthorization: (params: X402AuthorizationParams) => Promise<boolean>;
        skipSignatureVerification?: never;
      }
    | {
        verifyAuthorization?: never;
        /**
         * Explicitly opt out of offline signature verification.
         * ONLY for testing — a production node without verification can be forced to
         * burn nonces and operator gas by any attacker spamming invalid signatures.
         */
        skipSignatureVerification: true;
      }
  );

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
 *   2.5 Offline EIP-3009 signature verification (reject invalid sigs before any state change)
 *   3. Atomic nonce claim, keyed per (chainId, tokenAddress, from, nonce)
 *   4. On-chain settlement via X402ClientLike.settlePayment()
 *
 * Thread safety note: nonce deduplication uses an in-memory Set. Production
 * deployments should replace this with a persistent store (Redis, SQLite).
 */
export class X402Bridge implements SporeEventBridge<typeof SPORE_KIND_X402> {
  readonly kind = SPORE_KIND_X402;

  private readonly nonceStore: NonceStore;

  constructor(private readonly config: X402BridgeConfig) {
    // Runtime guard: the discriminated union enforces this at compile time, but configs
    // built dynamically (JSON, DI containers, `as any`) can bypass the type. Fail fast so a
    // production node can never silently run without offline signature verification.
    if (!config.skipSignatureVerification && !config.verifyAuthorization) {
      throw new Error(
        'X402Bridge: verifyAuthorization is required (or set skipSignatureVerification: true ' +
          'for tests). Without offline signature verification, invalid-signature spam can burn ' +
          'nonce keys and waste operator gas on reverting settlement calls.'
      );
    }
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
    const maxWindow = BigInt(this.config.maxValidBeforeWindowSeconds ?? 86400);
    if (validBefore > nowSec + maxWindow) {
      return { success: false, error: 'valid_before_too_far' };
    }

    // Step 2.5: Offline EIP-3009 signature verification.
    // Runs BEFORE claiming a nonce or touching the chain, so invalid-signature spam cannot
    // burn nonce keys or force reverting (gas-wasting) settlePayment() calls. Verification is
    // delegated to an injected verifier because @aastar/messaging has no chain deps / EIP-712
    // domain. skipSignatureVerification is testing-only (enforced in the constructor).
    if (this.config.verifyAuthorization) {
      // Fail closed: a verifier that throws (e.g. malformed signature/recovery) is treated as
      // an invalid signature, never propagated — handle() always resolves to a BridgeResult.
      let sigValid = false;
      try {
        sigValid = await this.config.verifyAuthorization({
          from,
          to,
          amount,
          nonce,
          validBefore,
          tokenAddress,
          chainId,
          sig,
        });
      } catch {
        sigValid = false;
      }
      if (!sigValid) {
        return { success: false, error: 'invalid_signature' };
      }
    }

    // Step 3: Atomic nonce claim — prevents TOCTOU replay under concurrent async stores.
    // Keyed by (chainId, tokenAddress, from, nonce) to match on-chain EIP-3009 semantics:
    // authorizationState is scoped per token contract AND per authorizer, so a coarser key
    // (e.g. chainId:nonce) would let one (token, payer) burn the same key for another —
    // cross-account / cross-token nonce burning.
    const nonceKey = `${chainId}:${tokenAddress.toLowerCase()}:${from.toLowerCase()}:${nonce}`;
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
