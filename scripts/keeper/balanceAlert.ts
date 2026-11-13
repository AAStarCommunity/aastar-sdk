/**
 * Low-signer-balance alert for the price loop.
 * The balance is read at most once an hour. Each alert is repeated at most once per 6 hours.
 * A failed read is its own alert and does not count as a low balance.
 */
export const BALANCE_CHECK_MS = 60 * 60 * 1000;
export const BALANCE_ALERT_MS = 6 * 60 * 60 * 1000;

export interface BalanceClock {
    nextCheckAt: number;
    lastLowAt: number;
    lastFailAt: number;
}

/** `prev <= 0` means this alert has never fired. A wall clock near the epoch must still alert. */
function alertDue(now: number, prev: number): boolean {
    if (!Number.isSafeInteger(prev) || prev <= 0) return true;
    return now - prev >= BALANCE_ALERT_MS;
}

export function noteBalance(input: {
    nowMs: number;
    clock: BalanceClock;
    balance: bigint | null;
    thresholdWei: bigint;
}): { clock: BalanceClock; alert: string | null } {
    const clock: BalanceClock = { ...input.clock };
    if (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0) return { clock, alert: null };
    if (!Number.isSafeInteger(clock.nextCheckAt) || input.nowMs < clock.nextCheckAt) return { clock, alert: null };
    clock.nextCheckAt = input.nowMs + BALANCE_CHECK_MS;
    const balance = typeof input.balance === 'bigint' && input.balance >= 0n ? input.balance : null;
    if (balance === null) {
        if (alertDue(input.nowMs, clock.lastFailAt)) {
            clock.lastFailAt = input.nowMs;
            return { clock, alert: 'balance read failed' };
        }
        return { clock, alert: null };
    }
    if (balance < input.thresholdWei && alertDue(input.nowMs, clock.lastLowAt)) {
        clock.lastLowAt = input.nowMs;
        return {
            clock,
            alert: `low signer balance\nbalanceWei=${balance.toString()}\nthresholdWei=${input.thresholdWei.toString()}`,
        };
    }
    return { clock, alert: null };
}
