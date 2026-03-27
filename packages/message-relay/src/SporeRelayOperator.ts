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

export class SporeRelayOperator {
  private pending: PendingVoucher[] = [];

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
   * M3 (current): logs settlement details to console.
   * M2+ (future): will call ChannelClient.batchSettle(vouchers) on-chain.
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

    for (const voucher of this.pending) {
      console.log(
        `  eventId=${voucher.eventId}` +
        ` from=${voucher.commitment.from}` +
        ` amount=${formatUsdc(voucher.commitment.amount)} USDC` +
        ` nonce=${voucher.commitment.nonce}`
      );
    }

    // TODO (M2+): await channelClient.batchSettle(this.pending);

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
