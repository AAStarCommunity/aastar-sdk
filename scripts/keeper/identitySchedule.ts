/**
 * When the signer-identity check runs.
 * Either closed scope is retried on every tick. Both open waits until nextIdentityAt.
 */
export const IDENTITY_INTERVAL_MS = 3_600_000;

export function identityDue(now: number, nextIdentityAt: number, gateOpen: boolean): boolean {
    if (!gateOpen) return true;
    if (!Number.isSafeInteger(now) || !Number.isSafeInteger(nextIdentityAt)) return true;
    return now >= nextIdentityAt;
}

export function scheduledIdentityAt(now: number, intervalMs: number = IDENTITY_INTERVAL_MS): number {
    if (!Number.isSafeInteger(now) || now < 0) throw new Error('identity: now invalid');
    if (!Number.isInteger(intervalMs) || intervalMs < 600_000) throw new Error('identity: interval invalid');
    return now + intervalMs;
}
