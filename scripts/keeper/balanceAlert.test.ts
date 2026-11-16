/**
 * Hourly balance read, 6h alert limit. A failed read is not a low balance.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE_ALERT_MS, BALANCE_CHECK_MS, noteBalance, type BalanceClock } from './balanceAlert';

const fresh = (): BalanceClock => ({ nextCheckAt: 0, lastLowAt: 0, lastFailAt: 0 });

describe('signer balance alert', () => {
    it('alerts a low balance at the first hourly check and not again until 6h', () => {
        const first = noteBalance({ nowMs: 1_000, clock: fresh(), balance: 1n, thresholdWei: 10n });
        expect(first.alert).toBe('low signer balance\nbalanceWei=1\nthresholdWei=10');
        expect(first.clock.nextCheckAt).toBe(1_000 + BALANCE_CHECK_MS);

        const skipped = noteBalance({ nowMs: 1_000 + BALANCE_CHECK_MS - 1, clock: first.clock, balance: 1n, thresholdWei: 10n });
        expect(skipped.alert).toBeNull();
        expect(skipped.clock.nextCheckAt).toBe(first.clock.nextCheckAt);

        const hour = noteBalance({ nowMs: 1_000 + BALANCE_CHECK_MS, clock: first.clock, balance: 1n, thresholdWei: 10n });
        expect(hour.alert).toBeNull();

        const six = noteBalance({ nowMs: 1_000 + BALANCE_ALERT_MS, clock: hour.clock, balance: 1n, thresholdWei: 10n });
        expect(six.alert).toContain('low signer balance');
    });

    it('alerts a failed balance read on its own 6h clock', () => {
        const first = noteBalance({ nowMs: 5_000, clock: fresh(), balance: null, thresholdWei: 10n });
        expect(first.alert).toBe('balance read failed');
        const hour = noteBalance({ nowMs: 5_000 + BALANCE_CHECK_MS, clock: first.clock, balance: null, thresholdWei: 10n });
        expect(hour.alert).toBeNull();
        const six = noteBalance({ nowMs: 5_000 + BALANCE_ALERT_MS, clock: hour.clock, balance: null, thresholdWei: 10n });
        expect(six.alert).toBe('balance read failed');
    });

    it('a balance at the threshold is not low, and a negative read is a failed read', () => {
        const at = noteBalance({ nowMs: 1, clock: fresh(), balance: 10n, thresholdWei: 10n });
        expect(at.alert).toBeNull();
        const bad = noteBalance({ nowMs: 1, clock: fresh(), balance: -1n, thresholdWei: 10n });
        expect(bad.alert).toBe('balance read failed');
    });
});
