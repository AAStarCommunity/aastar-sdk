/**
 * The three identity-gate branches. The clock is a number, not Date.now.
 */
import { describe, expect, it } from 'vitest';
import { decideIdentityGate, IDENTITY_GRACE_MS } from './identityGate';

const T0 = 1_700_000_000_000;
const SIX_H = 6 * 60 * 60 * 1000;

describe('identity gate scopes', () => {
    it('confirmed privileged signer closes price and pause and says price updates stopped', () => {
        const decision = decideIdentityGate({
            nowMs: T0,
            lastOkAt: T0 - 1_000,
            previousKey: 'open',
            verdict: { ok: false, kind: 'privileged', problems: ['signer equals deployer'] },
        });
        expect(decision.price).toBe(false);
        expect(decision.pause).toBe(false);
        expect(decision.alert).toContain('price updates have also stopped');
        expect(decision.alert ?? '').not.toContain('pause only');
        expect(IDENTITY_GRACE_MS).toBe(SIX_H);
    });

    it('identity read failure stops pause only and price runs until 6h after the last good check then everything closes', () => {
        const within = decideIdentityGate({
            nowMs: T0 + SIX_H - 1,
            lastOkAt: T0,
            previousKey: 'open',
            verdict: { ok: false, kind: 'read-failed', problems: ['read failed: SP.owner'] },
        });
        expect(within.price).toBe(true);
        expect(within.pause).toBe(false);
        expect(within.lastOkAt).toBe(T0);
        expect(within.alert).toContain('pause only; price updates continue');

        const expired = decideIdentityGate({
            nowMs: T0 + SIX_H,
            lastOkAt: T0,
            previousKey: within.key,
            verdict: { ok: false, kind: 'read-failed', problems: ['read failed: SP.owner'] },
        });
        expect(expired.price).toBe(false);
        expect(expired.pause).toBe(false);
        expect(expired.alert).toContain('price updates have also stopped');

        const never = decideIdentityGate({
            nowMs: T0,
            lastOkAt: 0,
            previousKey: '',
            verdict: { ok: false, kind: 'read-failed', problems: ['read failed: SP.owner'] },
        });
        expect(never.price).toBe(false);
        expect(never.pause).toBe(false);
        expect(never.alert).toContain('price updates have also stopped');
    });

    it('SP rc.8 identity mismatch stops pause only, price unaffected', () => {
        const decision = decideIdentityGate({
            nowMs: T0 + SIX_H + 3_600_000,
            lastOkAt: T0,
            previousKey: 'open',
            verdict: { ok: false, kind: 'sp-mismatch', problems: ['superpaymaster codehash mismatch'] },
        });
        expect(decision.price).toBe(true);
        expect(decision.pause).toBe(false);
        expect(decision.lastOkAt).toBe(T0);
        expect(decision.alert).toContain('pause only; price updates continue');
        expect(decision.alert ?? '').not.toContain('price updates have also stopped');
    });

    it('alerts only on state change and on recovery', () => {
        const boot = decideIdentityGate({
            nowMs: T0,
            lastOkAt: 0,
            previousKey: '',
            verdict: { ok: true },
        });
        expect(boot.alert).toBeNull();
        expect(boot.price).toBe(true);
        expect(boot.pause).toBe(true);

        const first = decideIdentityGate({
            nowMs: T0 + 1_000,
            lastOkAt: boot.lastOkAt,
            previousKey: boot.key,
            verdict: { ok: false, kind: 'sp-mismatch', problems: ['REGISTRY mismatch'] },
        });
        expect(first.alert).toContain('pause only; price updates continue');
        const again = decideIdentityGate({
            nowMs: T0 + 3_600_000,
            lastOkAt: first.lastOkAt,
            previousKey: first.key,
            verdict: { ok: false, kind: 'sp-mismatch', problems: ['REGISTRY mismatch'] },
        });
        expect(again.alert).toBeNull();
        expect(again.price).toBe(true);
        expect(again.pause).toBe(false);

        const recovered = decideIdentityGate({
            nowMs: T0 + 7_200_000,
            lastOkAt: again.lastOkAt,
            previousKey: again.key,
            verdict: { ok: true },
        });
        expect(recovered.price).toBe(true);
        expect(recovered.pause).toBe(true);
        expect(recovered.alert).toContain('signer identity recovered; price and pause resumed');
    });
});
