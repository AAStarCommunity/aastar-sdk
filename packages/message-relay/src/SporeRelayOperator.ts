// SporeRelayOperator: tracks accepted payment commitments and manages settlement

import type { PaymentCommitment } from './middleware/PaymentValidator.js';

export interface PendingVoucher {
  commitment: PaymentCommitment;
  acceptedAt: number; // Unix timestamp (seconds)
  eventId: string;    // The Nostr event ID this commitment was attached to
}

export interface PendingStats {
  count: number;
  totalUsdc: bigint;
}

/**
 * Injectable interface for on-chain batch settlement.
 * Production implementations connect to ChannelClient or a custom settlement contract.
 * If not provided, settleNow() logs vouchers but does not submit on-chain.
 */
export interface SettlementClientLike {
  /**
   * Submit a batch of accepted payment commitments on-chain.
   * @returns txHash of the settlement transaction
   */
  batchSettle(vouchers: PendingVoucher[]): Promise<{ txHash: `0x${string}` }>;
}

export interface SporeRelayOperatorConfig {
  /**
   * Optional on-chain settlement client.
   * If omitted, settleNow() logs and clears vouchers without on-chain submission.
   */
  settlementClient?: SettlementClientLike;
}

export class SporeRelayOperator {
  private pending: PendingVoucher[] = [];
  private readonly settlementClient?: SettlementClientLike;

  constructor(config: SporeRelayOperatorConfig = {}) {
    this.settlementClient = config.settlementClient;
  }

  /**
   * Called when a kind:23405 payment commitment is accepted by the relay.
   * Adds the voucher to the pending settlement queue.
   */
  onCommitmentAccepted(voucher: PendingVoucher): void {
    this.pending.push(voucher);
  }

  /**
   * Batch-settle all pending vouchers.
   *
   * If a settlementClient was injected, calls batchSettle() on-chain.
   * Otherwise, logs voucher details to console (dev/offline mode).
   *
   * @returns settled voucher count
   */
  async settleNow(): Promise<number> {
    if (this.pending.length === 0) {
      console.log('[SporeRelayOperator] No pending vouchers to settle.');
      return 0;
    }

    const stats = this.getPendingStats();
    console.log(
      `[SporeRelayOperator] Settling ${stats.count} voucher(s), ` +
      `total ${formatUsdc(stats.totalUsdc)} USDC`
    );

    if (this.settlementClient) {
      try {
        const { txHash } = await this.settlementClient.batchSettle(this.pending);
        console.log(`[SporeRelayOperator] On-chain settlement submitted: ${txHash}`);
      } catch (err) {
        // Log but do NOT clear pending — will retry on next settleNow() call
        console.error(`[SporeRelayOperator] Settlement failed: ${err}`);
        return 0;
      }
    } else {
      // No settlement client — log only (dev/testing mode)
      for (const voucher of this.pending) {
        console.log(
          `  [dry-run] eventId=${voucher.eventId}` +
          ` from=${voucher.commitment.from}` +
          ` amount=${formatUsdc(voucher.commitment.amount)} USDC` +
          ` nonce=${voucher.commitment.nonce}`
        );
      }
    }

    const settled = this.pending.length;
    this.pending = [];
    return settled;
  }

  /**
   * Returns aggregate stats about pending (unsettled) vouchers.
   */
  getPendingStats(): PendingStats {
    return {
      count: this.pending.length,
      totalUsdc: this.pending.reduce((sum, v) => sum + v.commitment.amount, 0n),
    };
  }

  /**
   * Returns a copy of all pending vouchers (for inspection / testing).
   */
  getPendingVouchers(): PendingVoucher[] {
    return [...this.pending];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Format 6-decimal USDC integer as human-readable string (e.g. 1000000n → "1.000000") */
function formatUsdc(amount: bigint): string {
  const whole = amount / 1_000_000n;
  const frac = amount % 1_000_000n;
  return `${whole}.${frac.toString().padStart(6, '0')}`;
}
