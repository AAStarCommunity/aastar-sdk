import { describe, expect, it, vi } from 'vitest';
import { type Hex, encodeFunctionData, decodeFunctionData, pad, stringToHex, toHex } from 'viem';
import {
    decodeLensReasonCode,
    encodeXPNTsV2RenewForSelf,
    getSuperPaymasterGasParams,
    getSuperPaymasterGeneration,
    getXPNTsV2SponsorshipState,
    superPaymasterLensActions,
} from './superPaymasterV550.js';
import { superPaymasterActions } from './superPaymaster.js';
import { SuperPaymasterLensABI, SuperPaymasterV550ABI, xPNTsTokenV2ABI } from '../abis/index.js';

const SP = '0x09df0d2e000000000000000000000000000d4de9' as const;
const LENS = '0x0963000000000000000000000000000000cebef0' as const;
const USER = '0x6503000000000000000000000000000000ef8800' as const;
const TOKEN = '0x2c47000000000000000000000000000000000700' as const;

/** bytes32("NAME") exactly as Solidity's `bytes32("NAME")` literal lays it out (left-aligned). */
const b32 = (s: string) => pad(stringToHex(s), { size: 32, dir: 'right' });

describe('decodeLensReasonCode (SuperPaymasterLens.sol:57-73, :158, :168 @ v5.5.0-rc.4)', () => {
    it('zero is OK', () => {
        expect(decodeLensReasonCode(pad('0x00', { size: 32 }))).toEqual({ code: 'OK' });
    });
    it('plain codes decode to their names', () => {
        for (const name of ['TOKEN_MISMATCH', 'POSTOP_GAS_TOO_LOW', 'VERSION_MISMATCH', 'RATE_COMMITMENT_VIOLATED', 'SPONSORSHIP_PAUSED']) {
            expect(decodeLensReasonCode(b32(name))).toEqual({ code: name });
        }
    });
    it('LOCK_REJECTED | bytes32(lr) carries the xPNTs LockResult in the last byte', () => {
        // DRYRUN_LOCK_REJECTED | bytes32(uint256(4)) = INVALID_RENEWAL
        const v = (BigInt(b32('LOCK_REJECTED')) | 4n);
        expect(decodeLensReasonCode(toHex(v, { size: 32 }))).toEqual({ code: 'LOCK_REJECTED', detail: 'INVALID_RENEWAL' });
        expect(decodeLensReasonCode(b32('LOCK_REJECTED'))).toEqual({ code: 'LOCK_REJECTED' });
    });
    it('CREDIT_REJECTED | bytes32(cr) carries the CreditResult', () => {
        const v = (BigInt(b32('CREDIT_REJECTED')) | 1n); // NO_CREDIT
        expect(decodeLensReasonCode(toHex(v, { size: 32 }))).toEqual({ code: 'CREDIT_REJECTED', detail: 'NO_CREDIT' });
    });
    it('rejects non-bytes32 input', () => {
        expect(() => decodeLensReasonCode('0x00')).toThrow(/bytes32/);
    });
});

describe('getSuperPaymasterGeneration / getSuperPaymasterGasParams', () => {
    it('5.4.2 → v5.4 and the compile-time 200k floor, without calling gasParams()', async () => {
        const readContract = vi.fn(async ({ functionName }: any) => {
            if (functionName === 'version') return 'SuperPaymaster-5.4.2';
            throw new Error(`unexpected ${functionName}`);
        });
        const client = { readContract } as any;
        expect((await getSuperPaymasterGeneration(client, SP)).generation).toBe('v5.4');
        const gp = await getSuperPaymasterGasParams(client, SP);
        expect(gp).toEqual({ minPostOpGas: 200_000n, source: 'constant(MIN_POST_OP_GAS)' });
        expect(readContract.mock.calls.map((c) => c[0].functionName)).toEqual(['version', 'version']);
    });

    it('5.5.0 → reads gasParams().current through the 5.5.0 union ABI', async () => {
        const readContract = vi.fn(async ({ functionName, abi }: any) => {
            if (functionName === 'version') return 'SuperPaymaster-5.5.0';
            if (functionName === 'gasParams') {
                expect(abi).toBe(SuperPaymasterV550ABI);
                return [
                    { minPostOpGas: 210_000, settleGasBound: 1, cWrap: 2, cPostop: 3 },
                    { minPostOpGas: 0, settleGasBound: 0, cWrap: 0, cPostop: 0, eta: 0n },
                ];
            }
            throw new Error(`unexpected ${functionName}`);
        });
        const gp = await getSuperPaymasterGasParams({ readContract } as any, SP);
        expect(gp.minPostOpGas).toBe(210_000n);
        expect(gp.source).toBe('gasParams()');
    });

    it('gasParams exists in the vendored 5.5.0 ABI with the GasParams struct shape (SuperPaymasterStorage.sol:47-52)', () => {
        const fn = (SuperPaymasterV550ABI as any[]).find((e) => e.type === 'function' && e.name === 'gasParams');
        expect(fn.outputs[0].components.map((c: any) => `${c.type} ${c.name}`)).toEqual([
            'uint32 minPostOpGas', 'uint32 settleGasBound', 'uint32 cWrap', 'uint32 cPostop',
        ]);
    });
});

describe('superPaymasterLensActions.dryRunValidation', () => {
    it('calls the LENS with (sp, userOp, maxCost) and decodes the reason', async () => {
        const readContract = vi.fn(async (req: any) => {
            // Encode through the real ABI to prove the argument order the lens declares.
            const data = encodeFunctionData({ abi: SuperPaymasterLensABI, functionName: 'dryRunValidation', args: req.args });
            const decoded = decodeFunctionData({ abi: SuperPaymasterLensABI, data });
            expect((decoded.args![0] as string).toLowerCase()).toBe(SP);
            expect(req.address).toBe(LENS);
            return [false, b32('TOKEN_MISMATCH')];
        });
        const userOp = {
            sender: USER, nonce: 0n, initCode: '0x' as Hex, callData: '0x' as Hex,
            accountGasLimits: pad('0x00', { size: 32 }), preVerificationGas: 0n, gasFees: pad('0x00', { size: 32 }),
            paymasterAndData: '0x' as Hex, signature: '0x' as Hex,
        };
        const res = await superPaymasterLensActions(LENS)({ readContract } as any).dryRunValidation({ superPaymaster: SP, userOp, maxCost: 1n });
        expect(res.ok).toBe(false);
        expect(res.reason).toEqual({ code: 'TOKEN_MISMATCH' });
    });
});

describe('superPaymasterActions — functions removed in 5.5.0 fail with an actionable error', () => {
    it('dryRunValidation on a 5.5.0 proxy points at the Lens', async () => {
        const readContract = vi.fn(async ({ functionName }: any) => {
            if (functionName === 'version') return 'SuperPaymaster-5.5.0';
            throw new Error('execution reverted');
        });
        const sp = superPaymasterActions(SP)({ readContract } as any);
        await expect(sp.dryRunValidation({ userOp: {} as any, maxCost: 1n })).rejects.toThrow(/removed in SuperPaymaster-5.5.0: use SuperPaymasterLens/);
        await expect(sp.pendingDebts({ token: TOKEN, user: USER })).rejects.toThrow(/removed in SuperPaymaster-5.5.0/);
    });
    it('on 5.4.2 the original error is kept', async () => {
        const readContract = vi.fn(async ({ functionName }: any) => {
            if (functionName === 'version') return 'SuperPaymaster-5.4.2';
            throw new Error('some rpc failure');
        });
        const sp = superPaymasterActions(SP)({ readContract } as any);
        await expect(sp.pendingDebts({ token: TOKEN, user: USER })).rejects.not.toThrow(/removed in/);
    });
});

describe('xPNTs v2 reads', () => {
    it('remainingAPNTs = min(autoCap-used, userTotalCap-used), saturating (xPNTsV2Base.sol:275-285)', async () => {
        const values: Record<string, unknown> = {
            balanceOf: 1000n, lockedOf: 10n, autoAllowance: [5000n, 4900n], userTotal: [5000n, 4000n],
            renewalMode: 0, debts: 0n, creditReservedOf: 0n, effectiveCreditCap: 0n,
        };
        const readContract = vi.fn(async ({ functionName, abi, address }: any) => {
            expect(abi).toBe(xPNTsTokenV2ABI);
            expect(address).toBe(TOKEN);
            return values[functionName];
        });
        const st = await getXPNTsV2SponsorshipState({ readContract } as any, { token: TOKEN, user: USER, superPaymaster: SP });
        expect(st.remainingAPNTs).toBe(100n);
        values.autoAllowance = [100n, 200n]; // used > cap after a cap decrease → 0, not negative
        expect((await getXPNTsV2SponsorshipState({ readContract } as any, { token: TOKEN, user: USER, superPaymaster: SP })).remainingAPNTs).toBe(0n);
    });
    it('renewForSelf calldata targets the SP argument', () => {
        const data = encodeXPNTsV2RenewForSelf(SP);
        const d = decodeFunctionData({ abi: xPNTsTokenV2ABI, data });
        expect(d.functionName).toBe('renewForSelf');
        expect((d.args![0] as string).toLowerCase()).toBe(SP);
    });
});
