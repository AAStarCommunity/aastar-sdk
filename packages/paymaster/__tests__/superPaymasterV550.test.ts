import { describe, it, expect, beforeEach, vi } from 'vitest';
import { type Address, size } from 'viem';
import { getSuperPaymasterMiddleware } from '../src/SuperPaymaster/index';
import { resolveSuperPaymasterSponsorship, SuperPaymasterInflightGuard, atLeast } from '../src/SuperPaymaster/v550';

const SP: Address = '0x2222222222222222222222222222222222222222';
const OPERATOR: Address = '0x4444444444444444444444444444444444444444';
const TOKEN: Address = '0x3333333333333333333333333333333333333333';
const SENDER: Address = '0x5555555555555555555555555555555555555555';
const EP: Address = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

/** operators() tuple in the REAL order (aPNTsBalance, isConfigured, isPaused, xPNTsToken, ...). */
const operatorsTuple = [10n ** 21n, true, false, TOKEN, 0, 0, OPERATOR, 0n, 0n] as const;

function mockClient(version: string, minPostOpGas = 200_000) {
    return {
        readContract: vi.fn(async ({ functionName }: any) => {
            if (functionName === 'version') return version;
            if (functionName === 'operators') return operatorsTuple;
            if (functionName === 'gasParams') return [{ minPostOpGas, settleGasBound: 0, cWrap: 0, cPostop: 0 }, {}];
            throw new Error(`unexpected read ${functionName}`);
        }),
    } as any;
}

describe('resolveSuperPaymasterSponsorship', () => {
    it('5.5.0: token from operators()[3], postOp floor from gasParams(), 250k verification floor', async () => {
        const ctx = await resolveSuperPaymasterSponsorship(mockClient('SuperPaymaster-5.5.0', 230_000), SP, OPERATOR);
        expect(ctx.generation).toBe('v5.5');
        expect(ctx.token).toBe(TOKEN);
        expect(ctx.isConfigured).toBe(true);
        expect(ctx.minPostOpGas).toBe(230_000n);
        expect(ctx.verificationGasFloor).toBe(250_000n);
    });
    it('5.4.2: no gasParams() call, 200k postOp floor, no verification floor', async () => {
        const client = mockClient('SuperPaymaster-5.4.2');
        const ctx = await resolveSuperPaymasterSponsorship(client, SP, OPERATOR);
        expect(ctx.generation).toBe('v5.4');
        expect(ctx.minPostOpGas).toBe(200_000n);
        expect(ctx.verificationGasFloor).toBe(0n);
        expect(client.readContract.mock.calls.map((c: any) => c[0].functionName)).not.toContain('gasParams');
    });
    it('atLeast only raises', () => {
        expect(atLeast(100n, 200n)).toBe(200n);
        expect(atLeast(300n, 200n)).toBe(300n);
        expect(atLeast(undefined, 200n)).toBe(200n);
    });
});

describe('SuperPaymasterInflightGuard (spec §3.2 F1: one in-flight op per sender)', () => {
    beforeEach(() => SuperPaymasterInflightGuard.clearAll());

    it('blocks a second op while the recorded nonce is not consumed', () => {
        SuperPaymasterInflightGuard.record(31337, EP, SENDER, 5n, '0xabc');
        expect(() => SuperPaymasterInflightGuard.assertNoneInFlight(31337, EP, SENDER, 5n)).toThrow(/one in-flight/);
    });
    it('clears once the on-chain nonce has moved past it', () => {
        SuperPaymasterInflightGuard.record(31337, EP, SENDER, 5n);
        expect(() => SuperPaymasterInflightGuard.assertNoneInFlight(31337, EP, SENDER, 6n)).not.toThrow();
        // and the record is gone
        expect(() => SuperPaymasterInflightGuard.assertNoneInFlight(31337, EP, SENDER, 5n)).not.toThrow();
    });
    it('is keyed per chain / entryPoint / sender (case-insensitive)', () => {
        SuperPaymasterInflightGuard.record(31337, EP, SENDER, 1n);
        expect(() => SuperPaymasterInflightGuard.assertNoneInFlight(11155111, EP, SENDER, 1n)).not.toThrow();
        expect(() => SuperPaymasterInflightGuard.assertNoneInFlight(31337, EP, OPERATOR, 1n)).not.toThrow();
        expect(() => SuperPaymasterInflightGuard.assertNoneInFlight(31337, EP, SENDER.toUpperCase().replace('0X', '0x') as Address, 1n)).toThrow();
    });
});

describe('getSuperPaymasterMiddleware', () => {
    it('emits the 5.5.0 layout when token is configured, legacy 104 bytes otherwise', async () => {
        const withToken = await getSuperPaymasterMiddleware({ paymasterAddress: SP, operator: OPERATOR, token: TOKEN })
            .sponsorUserOperation({ userOperation: {} });
        expect(size(withToken.paymasterAndData)).toBe(125);
        const legacy = await getSuperPaymasterMiddleware({ paymasterAddress: SP, operator: OPERATOR })
            .sponsorUserOperation({ userOperation: {} });
        expect(size(legacy.paymasterAndData)).toBe(104);
    });
    it('default postOpGasLimit is 200k (was 10k, below MIN_POST_OP_GAS on 5.4.2 and 5.5.0)', async () => {
        const r = await getSuperPaymasterMiddleware({ paymasterAddress: SP, operator: OPERATOR }).sponsorUserOperation({ userOperation: {} });
        expect(BigInt('0x' + r.paymasterAndData.slice(2 + 36 * 2, 2 + 52 * 2))).toBe(200_000n);
    });
});
