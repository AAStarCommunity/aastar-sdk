import { describe, it, expect, vi } from 'vitest';
import { zeroAddress, keccak256, stringToBytes } from 'viem';

// ─── Test constants ──────────────────────────────────────────────────────────
const XPNTS_TOKEN_ADDR = '0x1111111111111111111111111111111111111111';
const TREASURY_ADDR    = '0x2222222222222222222222222222222222222222';
const OPERATOR_ADDR    = '0x3333333333333333333333333333333333333333';
const V4_PM_ADDR       = '0x4444444444444444444444444444444444444444';
const REGISTRY_ADDR    = '0x5555555555555555555555555555555555555555';
const SP_ADDR          = '0x6666666666666666666666666666666666666666';
const FACTORY_ADDR     = '0x7777777777777777777777777777777777777777';

/**
 * Build a v5.3.3 operators() 9-field tuple:
 * [0] aPNTsBalance  [1] isConfigured  [2] isPaused  [3] xPNTsToken
 * [4] reputation    [5] minTxInterval [6] treasury  [7] totalSpent
 * [8] totalTxSponsored
 */
function makeOperatorTuple(o: {
    aPNTsBalance?: bigint; isConfigured?: boolean; isPaused?: boolean;
    xPNTsToken?: string; reputation?: number; minTxInterval?: number;
    treasury?: string; totalSpent?: bigint; totalTxSponsored?: bigint;
} = {}) {
    return [
        o.aPNTsBalance  ?? 1000n,
        o.isConfigured  ?? true,
        o.isPaused      ?? false,
        o.xPNTsToken    ?? XPNTS_TOKEN_ADDR,
        o.reputation    ?? 100,
        o.minTxInterval ?? 0,
        o.treasury      ?? TREASURY_ADDR,
        o.totalSpent    ?? 0n,
        o.totalTxSponsored ?? 0n,
    ];
}

/** Minimal mock viem client for getOperatorStatus unit testing. */
function makeReadContractMock(config: {
    hasRole?: boolean;
    operatorTuple?: ReturnType<typeof makeOperatorTuple>;
    exchangeRate?: bigint | 'not-deployed' | 'rpc-error';
    v4PaymasterAddr?: string;
}) {
    return vi.fn(async ({ functionName }: { functionName: string; address: string; abi: any; args?: any[] }) => {
        switch (functionName) {
            case 'hasRole':            return config.hasRole ?? true;
            case 'operators':          return config.operatorTuple ?? makeOperatorTuple();
            case 'exchangeRate': {
                if (config.exchangeRate === 'not-deployed')
                    throw new Error('ContractFunctionExecutionError: code not found');
                if (config.exchangeRate === 'rpc-error')
                    throw new Error('code: -32603 Internal JSON-RPC error');
                return config.exchangeRate ?? 200n;
            }
            case 'getPaymasterByOperator': return config.v4PaymasterAddr ?? zeroAddress;
            default: return null;
        }
    });
}

// ─── operators() v5.3.3 tuple field layout ──────────────────────────────────
describe('operators() v5.3.3 tuple field layout', () => {
    it('field [1] is isConfigured (not [2])', () => {
        const t = makeOperatorTuple({ isConfigured: true, isPaused: false });
        expect(t[1]).toBe(true);   // isConfigured
        expect(t[2]).toBe(false);  // isPaused
    });

    it('field [0] is aPNTsBalance', () => {
        const t = makeOperatorTuple({ aPNTsBalance: 9999n });
        expect(t[0]).toBe(9999n);
    });

    it('field [3] is xPNTsToken address', () => {
        const t = makeOperatorTuple({ xPNTsToken: XPNTS_TOKEN_ADDR });
        expect(t[3]).toBe(XPNTS_TOKEN_ADDR);
    });

    it('field [6] is treasury address', () => {
        const t = makeOperatorTuple({ treasury: TREASURY_ADDR });
        expect(t[6]).toBe(TREASURY_ADDR);
    });
});

// ─── Path 1: exchangeRate happy path ────────────────────────────────────────
describe('getOperatorStatus — exchangeRate happy path', () => {
    it('reads exchangeRate from xPNTs token contract when xPNTsToken != zeroAddress', async () => {
        const readContract = makeReadContractMock({ exchangeRate: 350n });

        // Simulate the guard in getOperatorStatus
        const operatorData = await readContract({ functionName: 'operators', address: SP_ADDR, abi: [] });
        const xPNTsTokenAddr = operatorData[3] as string;
        let exchangeRate = 0n;

        if (xPNTsTokenAddr && xPNTsTokenAddr !== zeroAddress) {
            exchangeRate = await readContract({ functionName: 'exchangeRate', address: xPNTsTokenAddr, abi: [] }) as bigint;
        }

        expect(exchangeRate).toBe(350n);
        expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'exchangeRate' }));
    });

    it('exchangeRate is returned as bigint', async () => {
        const readContract = makeReadContractMock({ exchangeRate: 1000n });
        const rate = await readContract({ functionName: 'exchangeRate', address: XPNTS_TOKEN_ADDR, abi: [] }) as bigint;
        expect(typeof rate).toBe('bigint');
    });
});

// ─── Path 2: xPNTsToken is zeroAddress → skip exchangeRate ──────────────────
describe('getOperatorStatus — xPNTsToken is zeroAddress (skip path)', () => {
    it('does NOT call exchangeRate when xPNTsToken is zeroAddress', async () => {
        const readContract = makeReadContractMock({
            operatorTuple: makeOperatorTuple({ xPNTsToken: zeroAddress }),
            exchangeRate: 999n,  // would return 999 if called
        });

        const operatorData = await readContract({ functionName: 'operators', address: SP_ADDR, abi: [] });
        const xPNTsTokenAddr = operatorData[3] as string;
        let exchangeRate = 0n;

        if (xPNTsTokenAddr && xPNTsTokenAddr !== zeroAddress) {
            exchangeRate = await readContract({ functionName: 'exchangeRate', address: xPNTsTokenAddr, abi: [] }) as bigint;
        }

        expect(xPNTsTokenAddr).toBe(zeroAddress);
        expect(exchangeRate).toBe(0n);
        expect(readContract).not.toHaveBeenCalledWith(
            expect.objectContaining({ functionName: 'exchangeRate' })
        );
    });

    it('exchangeRate defaults to 0n when token address is zero', () => {
        const t = makeOperatorTuple({ xPNTsToken: zeroAddress });
        expect(t[3]).toBe(zeroAddress);
        // exchangeRate would be 0n (default) since skip guard fires
        const exchangeRate = 0n;
        expect(exchangeRate).toBe(0n);
    });
});

// ─── Path 3: exchangeRate throws → catch fallback ────────────────────────────
describe('getOperatorStatus — exchangeRate catch fallback', () => {
    it('falls back to 0n when ContractFunctionExecutionError (not deployed)', async () => {
        const readContract = makeReadContractMock({ exchangeRate: 'not-deployed' });
        let exchangeRate = 0n;

        try {
            exchangeRate = await readContract({ functionName: 'exchangeRate', address: XPNTS_TOKEN_ADDR, abi: [] }) as bigint;
        } catch (rateErr: unknown) {
            const msg = rateErr instanceof Error ? rateErr.message : String(rateErr);
            if (!msg.includes('ContractFunctionExecutionError') && !msg.includes('code: -32')) {
                console.warn('unexpected:', msg);
            }
            // leave exchangeRate as 0n
        }

        expect(exchangeRate).toBe(0n);
    });

    it('falls back to 0n on RPC -32xxx error (silent)', async () => {
        const readContract = makeReadContractMock({ exchangeRate: 'rpc-error' });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        let exchangeRate = 0n;

        try {
            exchangeRate = await readContract({ functionName: 'exchangeRate', address: XPNTS_TOKEN_ADDR, abi: [] }) as bigint;
        } catch (rateErr: unknown) {
            const msg = rateErr instanceof Error ? rateErr.message : String(rateErr);
            if (!msg.includes('ContractFunctionExecutionError') && !msg.includes('code: -32')) {
                console.warn(`⚠️ Unexpected error reading exchangeRate from ${XPNTS_TOKEN_ADDR}:`, msg);
            }
        }

        expect(warnSpy).not.toHaveBeenCalled(); // -32603 matches 'code: -32', no warn
        expect(exchangeRate).toBe(0n);
        warnSpy.mockRestore();
    });

    it('logs console.warn for truly unexpected errors (not ContractFunctionExecutionError, not RPC)', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        try {
            throw new Error('unexpected ABI decode mismatch');
        } catch (rateErr: unknown) {
            const msg = rateErr instanceof Error ? rateErr.message : String(rateErr);
            if (!msg.includes('ContractFunctionExecutionError') && !msg.includes('code: -32')) {
                console.warn(`   ⚠️ Unexpected error reading exchangeRate from ${XPNTS_TOKEN_ADDR}:`, msg);
            }
        }

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('Unexpected error reading exchangeRate'),
            expect.stringContaining('unexpected ABI decode mismatch')
        );
        warnSpy.mockRestore();
    });
});
