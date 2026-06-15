import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { type Address, size } from 'viem';
import { PaymasterManager } from '../src/PaymasterManager';
import { buildPaymasterData, buildSuperPaymasterData } from '../src/V4/PaymasterUtils';

const PAYMASTER_V4: Address = '0x1111111111111111111111111111111111111111';
const PAYMASTER_SUPER: Address = '0x2222222222222222222222222222222222222222';
const TOKEN: Address = '0x3333333333333333333333333333333333333333';
const OPERATOR: Address = '0x4444444444444444444444444444444444444444';

describe('PaymasterManager', () => {
    // Freeze time so the V4 packer's Date.now()-derived validUntil/validAfter
    // are deterministic and byte-for-byte comparable across calls.
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-14T00:00:00Z'));
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    describe('byte layout parity with existing packers', () => {
        it("type 'v4' matches buildPaymasterData byte-for-byte", () => {
            const mgr = new PaymasterManager();
            const out = mgr.buildPaymasterData({
                type: 'v4',
                paymasterAddress: PAYMASTER_V4,
                token: TOKEN,
                validityWindow: 3600,
                verificationGasLimit: 200000n,
                postOpGasLimit: 100000n
            });
            const expected = buildPaymasterData(PAYMASTER_V4, TOKEN, {
                validityWindow: 3600,
                verificationGasLimit: 200000n,
                postOpGasLimit: 100000n
            });
            expect(out).toBe(expected);
            // V4 layout: [paymaster(20)][verGas(16)][postGas(16)][token(20)][validUntil(6)][validAfter(6)] = 84 bytes
            expect(size(out)).toBe(84);
        });

        it("type 'super' matches buildSuperPaymasterData byte-for-byte", () => {
            const mgr = new PaymasterManager();
            const out = mgr.buildPaymasterData({
                type: 'super',
                paymasterAddress: PAYMASTER_SUPER,
                operator: OPERATOR,
                verificationGasLimit: 80000n,
                postOpGasLimit: 100000n,
                maxRate: 12345n
            });
            const expected = buildSuperPaymasterData(PAYMASTER_SUPER, OPERATOR, {
                verificationGasLimit: 80000n,
                postOpGasLimit: 100000n,
                maxRate: 12345n
            });
            expect(out).toBe(expected);
            // Super layout: [paymaster(20)][verGas(16)][postGas(16)][operator(20)][maxRate(32)] = 104 bytes
            expect(size(out)).toBe(104);
        });

        it('produces distinct lengths for the two types (84 vs 104 bytes)', () => {
            const mgr = new PaymasterManager();
            const v4 = mgr.buildPaymasterData({ type: 'v4', paymasterAddress: PAYMASTER_V4, token: TOKEN });
            const sup = mgr.buildPaymasterData({ type: 'super', paymasterAddress: PAYMASTER_SUPER, operator: OPERATOR });
            expect(size(v4)).toBe(84);
            expect(size(sup)).toBe(104);
            expect(size(v4)).not.toBe(size(sup));
        });
    });

    describe('type dispatch', () => {
        it('resolves type from a registered address when type is omitted', () => {
            const mgr = new PaymasterManager({
                knownPaymasters: { [PAYMASTER_V4]: 'v4', [PAYMASTER_SUPER]: 'super' }
            });
            const v4 = mgr.buildPaymasterData({ paymasterAddress: PAYMASTER_V4, token: TOKEN });
            const sup = mgr.buildPaymasterData({ paymasterAddress: PAYMASTER_SUPER, operator: OPERATOR });
            expect(size(v4)).toBe(84);
            expect(size(sup)).toBe(104);
            expect(mgr.resolveType(PAYMASTER_V4)).toBe('v4');
            expect(mgr.resolveType(PAYMASTER_SUPER)).toBe('super');
        });

        it('resolves registered addresses case-insensitively', () => {
            const mgr = new PaymasterManager();
            mgr.registerPaymaster(PAYMASTER_V4.toUpperCase() as Address, 'v4');
            expect(mgr.resolveType(PAYMASTER_V4.toLowerCase() as Address)).toBe('v4');
        });

        it('throws on a conflicting re-registration (even via case-variant address)', () => {
            const mgr = new PaymasterManager();
            mgr.registerPaymaster(PAYMASTER_V4, 'v4');
            // Re-registering the SAME type is an idempotent no-op...
            expect(() => mgr.registerPaymaster(PAYMASTER_V4.toUpperCase() as Address, 'v4')).not.toThrow();
            // ...but a CONFLICTING type (would later pack a wrong-length blob) must throw.
            expect(() => mgr.registerPaymaster(PAYMASTER_V4.toUpperCase() as Address, 'super'))
                .toThrow(/already registered as 'v4'/);
        });

        it('constructor rejects conflicting known-paymaster seeds', () => {
            // Same address, different case, conflicting types in the seed map.
            expect(() => new PaymasterManager({
                knownPaymasters: {
                    [PAYMASTER_V4.toLowerCase()]: 'v4',
                    [PAYMASTER_V4.toUpperCase()]: 'super',
                } as Record<string, 'v4' | 'super'>,
            })).toThrow(/already registered as 'v4'/);
        });

        it('explicit type takes precedence over registration', () => {
            const mgr = new PaymasterManager({ knownPaymasters: { [PAYMASTER_V4]: 'super' } });
            // Address registered as 'super', but explicit 'v4' should win.
            const out = mgr.buildPaymasterData({ type: 'v4', paymasterAddress: PAYMASTER_V4, token: TOKEN });
            expect(size(out)).toBe(84);
        });

        it('static buildPaymasterData dispatches by explicit type', () => {
            const v4 = PaymasterManager.buildPaymasterData('v4', { paymasterAddress: PAYMASTER_V4, token: TOKEN });
            const sup = PaymasterManager.buildPaymasterData('super', { paymasterAddress: PAYMASTER_SUPER, operator: OPERATOR });
            expect(size(v4)).toBe(84);
            expect(size(sup)).toBe(104);
        });
    });

    describe('error handling', () => {
        it('throws when type cannot be resolved', () => {
            const mgr = new PaymasterManager();
            expect(() => mgr.buildPaymasterData({ paymasterAddress: PAYMASTER_V4, token: TOKEN }))
                .toThrow(/cannot resolve paymaster type/);
        });

        it("throws when type 'v4' is missing token", () => {
            const mgr = new PaymasterManager();
            expect(() => mgr.buildPaymasterData({ type: 'v4', paymasterAddress: PAYMASTER_V4 }))
                .toThrow(/requires `token`/);
        });

        it("throws when type 'super' is missing operator", () => {
            const mgr = new PaymasterManager();
            expect(() => mgr.buildPaymasterData({ type: 'super', paymasterAddress: PAYMASTER_SUPER }))
                .toThrow(/requires `operator`/);
        });
    });
});
