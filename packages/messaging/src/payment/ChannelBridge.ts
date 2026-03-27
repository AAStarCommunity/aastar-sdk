// ChannelBridge — handles kind:23403 channel voucher events.
// Implements lazy settlement: vouchers accumulate until a threshold is reached,
// then a single on-chain transaction submits the highest cumulative voucher.

import type { SporeEventBridge, BridgeResult } from './SporeEventBridge.js';
import { SPORE_KIND_CHANNEL } from './SporeEventBridge.js';
import type { SignedNostrEvent } from '../types.js';

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

/** Configuration for ChannelBridge */
export interface ChannelBridgeConfig {
  /** Injected channel client for on-chain settlement */
  channelClient: ChannelClientLike;
  /**
   * Lazy settle threshold in atomic units.
   * When the gain (cumulativeAmount - lastSettled) reaches this value,
   * the bridge submits a voucher on-chain.
   * Default: 5_000_000n (5 USDC at 6 decimals)
   */
  lazySettleThreshold?: bigint;
}

// ─── Internal State ───────────────────────────────────────────────────────────

/** Best (highest cumulative) pending voucher for a channel */
interface BestVoucher {
  cumulativeAmount: bigint;
  sig: `0x${string}`;
}

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

  // channelId → best (highest cumulative) unsubmitted voucher
  private readonly pendingVouchers = new Map<string, BestVoucher>();
  // channelId → last settled cumulative amount (after successful submitVoucher)
  private readonly settledAmounts = new Map<string, bigint>();

  constructor(private readonly config: ChannelBridgeConfig) {}

  async handle(event: SignedNostrEvent): Promise<BridgeResult> {
    // Step 1: Parse tags
    const tagMap = new Map(event.tags.map(([k, ...v]) => [k, v]));
    const channelId = tagMap.get('channel')?.[0];
    const cumulativeStr = tagMap.get('cumulative')?.[0];

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

    // Step 3: Monotonicity check — cumulativeAmount must strictly increase
    const best = this.pendingVouchers.get(channelId);
    if (best && cumulativeAmount <= best.cumulativeAmount) {
      return { success: false, error: 'non_monotonic_cumulative' };
    }

    // Step 4: Update best voucher for this channel
    this.pendingVouchers.set(channelId, { cumulativeAmount, sig: voucherSig });

    // Step 5: Lazy settle — check if gain exceeds threshold
    const lastSettled = this.settledAmounts.get(channelId) ?? 0n;
    const gain = cumulativeAmount - lastSettled;
    const threshold = this.config.lazySettleThreshold ?? 5_000_000n;

    if (gain >= threshold) {
      try {
        const { txHash } = await this.config.channelClient.submitVoucher({
          channelId,
          cumulativeAmount,
          voucherSig,
        });
        this.settledAmounts.set(channelId, cumulativeAmount);
        this.pendingVouchers.delete(channelId);
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
    for (const [channelId, voucher] of this.pendingVouchers) {
      try {
        const { txHash } = await this.config.channelClient.submitVoucher({
          channelId,
          cumulativeAmount: voucher.cumulativeAmount,
          voucherSig: voucher.sig,
        });
        this.settledAmounts.set(channelId, voucher.cumulativeAmount);
        this.pendingVouchers.delete(channelId);
        results.set(channelId, txHash);
      } catch {
        // Continue with other channels even if one fails
      }
    }
    return results;
  }
}
