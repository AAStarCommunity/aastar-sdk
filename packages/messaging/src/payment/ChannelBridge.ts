// ChannelBridge — handles kind:23403 channel voucher events.
// Implements lazy settlement: vouchers accumulate until a threshold is reached,
// then a single on-chain transaction submits the highest cumulative voucher.

import type { SporeEventBridge, BridgeResult } from './SporeEventBridge.js';
import { SPORE_KIND_CHANNEL } from './SporeEventBridge.js';
import { parseTagsToObject } from '../events/SporeEventTypes.js';
import type { SignedNostrEvent } from '../types.js';
import type { VoucherStore, BestVoucher } from './NonceStore.js';
import { InMemoryVoucherStore } from './NonceStore.js';

// ─── Client Interface ─────────────────────────────────────────────────────────

/** On-chain state of a payment channel */
export interface ChannelState {
  channelId: string;
  payer: `0x${string}`;
  payee: `0x${string}`;
  status: 'Open' | 'Closed';
  depositedAmount: bigint;
}

/**
 * Minimal interface for a channel client.
 * The actual implementation lives in @aastar/channel (a peer package).
 */
export interface ChannelClientLike {
  /** Fetch current on-chain state for a payment channel */
  getChannelState(channelId: string): Promise<ChannelState>;

  /**
   * Submit a voucher to the channel contract to settle up to cumulativeAmount.
   * The contract verifies the EIP-712 voucherSig before updating state.
   */
  submitVoucher(params: {
    channelId: string;
    cumulativeAmount: bigint;
    voucherSig: `0x${string}`;
  }): Promise<{ txHash: `0x${string}` }>;
}

// ─── Config ───────────────────────────────────────────────────────────────────

/** Shared configuration fields for ChannelBridge */
interface ChannelBridgeConfigBase {
  /** Injected channel client for on-chain settlement */
  channelClient: ChannelClientLike;
  /**
   * Lazy settle threshold in atomic units.
   * When the gain (cumulativeAmount - lastSettled) reaches this value,
   * the bridge submits a voucher on-chain.
   * Default: 5_000_000n (5 USDC at 6 decimals)
   */
  lazySettleThreshold?: bigint;
  /**
   * Voucher store for pending voucher and settled amount persistence.
   * Defaults to InMemoryVoucherStore (state lost on restart).
   * In production, inject a persistent store (SQLite, Redis, etc.) and
   * call forceSettleAll() on graceful shutdown.
   */
  voucherStore?: VoucherStore;
}

/**
 * Configuration for ChannelBridge.
 *
 * You MUST supply one of:
 *   - `verifyVoucherSig` — an offline EIP-712 verifier that rejects invalid vouchers before
 *     any on-chain call is made. Without this, a spam attacker can force submitVoucher() calls
 *     that burn gas even when the chain rejects them.
 *   - `skipVoucherSigVerification: true` — explicit opt-out (testing only).
 *
 * Production note: implement verifyVoucherSig using ecrecover on the EIP-712 hash of
 * (channelId, cumulativeAmount) signed by the payer's Ethereum key.
 */
export type ChannelBridgeConfig = ChannelBridgeConfigBase &
  (
    | {
        /**
         * Offline EIP-712 voucher signature verifier.
         * Called before accepting a voucher. Rejects invalid signatures early,
         * preventing gas-wasting submitVoucher() calls to the chain.
         *
         * @param channelId        - Channel identifier
         * @param cumulativeAmount - Claimed cumulative amount in the voucher
         * @param sig              - EIP-712 signature over the voucher
         * @param expectedPayer    - Payer address from on-chain channel state
         * @returns true if the signature is valid
         */
        verifyVoucherSig: (
          channelId: string,
          cumulativeAmount: bigint,
          sig: string,
          expectedPayer: `0x${string}`
        ) => Promise<boolean>;
        skipVoucherSigVerification?: never;
      }
    | {
        verifyVoucherSig?: never;
        /**
         * Explicitly opt out of voucher signature verification.
         * ONLY for testing — a production node without sig verification can be
         * forced to waste gas by any attacker who knows the channel ID.
         */
        skipVoucherSigVerification: true;
      }
  );

// ─── ChannelBridge ────────────────────────────────────────────────────────────

/**
 * ChannelBridge — on-chain bridge for kind:23403 channel voucher events.
 *
 * Lazy settlement design reduces gas costs for micropayments:
 *   - Incoming vouchers are validated and stored in memory
 *   - Only the highest (cumulative) voucher per channel is retained
 *   - Settlement triggers when gain since last on-chain settle >= threshold
 *
 * Processing pipeline:
 *   1. Parse tags (channelId, cumulativeAmount) and content (voucherSig)
 *   2. Verify channel is Open via getChannelState()
 *   3. Monotonicity check: cumulativeAmount must exceed all prior vouchers
 *   4. Update best pending voucher
 *   5. If gain >= threshold, submit on-chain; otherwise store lazily
 *
 * Production note: pendingVouchers should be persisted to SQLite or Redis
 * to survive process restarts.
 */
export class ChannelBridge implements SporeEventBridge<typeof SPORE_KIND_CHANNEL> {
  readonly kind = SPORE_KIND_CHANNEL;

  private readonly store: VoucherStore;

  constructor(private readonly config: ChannelBridgeConfig) {
    this.store = config.voucherStore ?? new InMemoryVoucherStore();
  }

  async handle(event: SignedNostrEvent): Promise<BridgeResult> {
    // Step 1: Parse tags
    const tagMap = parseTagsToObject(event.tags);
    const channelId = tagMap['channel']?.[0];
    const cumulativeStr = tagMap['cumulative']?.[0];

    if (!channelId || !cumulativeStr) {
      return { success: false, error: 'missing_tags' };
    }

    // Parse voucherSig from NIP-44 decrypted content
    let voucherSig: `0x${string}`;
    try {
      const content = JSON.parse(event.content) as { voucherSig: string };
      voucherSig = content.voucherSig as `0x${string}`;
    } catch {
      return { success: false, error: 'invalid_content' };
    }

    const cumulativeAmount = BigInt(cumulativeStr);

    // Step 2: Verify channel is Open on-chain
    let state: ChannelState;
    try {
      state = await this.config.channelClient.getChannelState(channelId);
    } catch (err) {
      return { success: false, error: `channel_fetch_failed: ${err}` };
    }
    if (state.status !== 'Open') {
      return { success: false, error: 'channel_not_open' };
    }

    // Offline voucher signature verification.
    // Prevents spam: an attacker sending fake high-amount vouchers would force
    // expensive on-chain submitVoucher() calls that fail after spending gas.
    // skipVoucherSigVerification is only for testing.
    if ('verifyVoucherSig' in this.config && this.config.verifyVoucherSig) {
      const valid = await this.config.verifyVoucherSig(
        channelId,
        cumulativeAmount,
        voucherSig,
        state.payer
      );
      if (!valid) {
        return { success: false, error: 'invalid_voucher_sig' };
      }
    }

    // Step 3: Monotonicity check — cumulativeAmount must strictly increase
    const best = await this.store.getBest(channelId);
    if (best && cumulativeAmount <= best.cumulativeAmount) {
      return { success: false, error: 'non_monotonic_cumulative' };
    }

    // Step 4: Update best voucher for this channel
    await this.store.setBest(channelId, { cumulativeAmount, sig: voucherSig });

    // Step 5: Lazy settle — check if gain exceeds threshold
    const lastSettled = await this.store.getSettled(channelId);
    const gain = cumulativeAmount - lastSettled;
    const threshold = this.config.lazySettleThreshold ?? 5_000_000n;

    if (gain >= threshold) {
      try {
        const { txHash } = await this.config.channelClient.submitVoucher({
          channelId,
          cumulativeAmount,
          voucherSig,
        });
        await this.store.setSettled(channelId, cumulativeAmount);
        await this.store.deleteBest(channelId);
        return {
          success: true,
          txHash,
          replyContent: { settled: true, txHash },
        };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }

    // Voucher accepted and stored (lazy — not yet settled on-chain)
    return {
      success: true,
      replyContent: { stored: true, pendingGain: gain.toString() },
    };
  }

  /**
   * Force-settle all pending vouchers immediately.
   * Call periodically (e.g. every hour) or on graceful shutdown
   * to ensure no funds are left unredeemed.
   *
   * @returns Map of channelId → txHash for successfully settled channels
   */
  async forceSettleAll(): Promise<Map<string, `0x${string}`>> {
    const results = new Map<string, `0x${string}`>();
    const pending = await this.store.getAllPending();
    for (const [channelId, voucher] of pending) {
      try {
        const { txHash } = await this.config.channelClient.submitVoucher({
          channelId,
          cumulativeAmount: voucher.cumulativeAmount,
          voucherSig: voucher.sig,
        });
        await this.store.setSettled(channelId, voucher.cumulativeAmount);
        await this.store.deleteBest(channelId);
        results.set(channelId, txHash);
      } catch {
        // Continue with other channels even if one fails
      }
    }
    return results;
  }
}
