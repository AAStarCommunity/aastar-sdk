import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Address, Hex } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { SUPER_PAYMASTER_FLAGS } from '@aastar/core';
import { PaymasterClient } from '../src/V4/PaymasterClient';
import { SuperPaymasterInflightGuard } from '../src/SuperPaymaster/v550';

// Offline harness (same stubbing as scripts/cc128/count-signatures.ts): real SDK code, a real
// viem LocalAccount on anvil's public mnemonic, stubbed public client + bundler. No network.
const EP = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address;
const SP = '0x09DF0d2e3722EC0e401fE3819E64278a42ae4DE9' as Address;
const OPERATOR = '0x00000000000000000000000000000000000000a1' as Address;
const TOKEN = '0x00000000000000000000000000000000000000b2' as Address;
const SENDER = '0x00000000000000000000000000000000000000c3' as Address;
const CALLDATA = '0xb61d27f6' as Hex;
const OP_HASH = ('0x' + 'ab'.repeat(32)) as Hex;

/** flags byte = last byte of paymasterData on the 125-byte 5.5.0 layout ([operator][maxRate][token][flags]). */
function flagsOf(userOpJson: any): number | undefined {
    const data: string = (userOpJson.paymasterData ?? '0x').slice(2);
    return data.length === 73 * 2 ? parseInt(data.slice(-2), 16) : undefined;
}

type Bundler = (method: string, userOp: any) => Promise<object>;

function harness(bundler: Bundler, opts: { signDelayMs?: number } = {}) {
    const base = mnemonicToAccount('test test test test test test test test test test test junk', { addressIndex: 3 });
    const account = {
        ...base,
        signMessage: async (args: any) => {
            if (opts.signDelayMs) await new Promise((r) => setTimeout(r, opts.signDelayMs));
            return base.signMessage(args);
        },
    };
    const wallet = { account, chain: { id: 11155111 }, writeContract: async () => ('0x' + 'ee'.repeat(32)) as Hex };
    const client = {
        chain: { id: 11155111 },
        getChainId: async () => 11155111,
        estimateFeesPerGas: async () => ({ maxFeePerGas: 2_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n }),
        getGasPrice: async () => 1_000_000_000n,
        readContract: async ({ functionName }: { functionName: string }) => {
            switch (functionName) {
                case 'getNonce': return 7n;
                case 'version': return 'SuperPaymaster-5.5.0';
                case 'operators': return [10n ** 21n, true, false, TOKEN, 0, 0, 0, 0n, 0n, 0n];
                case 'gasParams': return [{ minPostOpGas: 200_000n, settleGasBound: 0n, cWrap: 0n, cPostop: 0n }];
                default: throw new Error(`stub: unexpected readContract(${functionName})`);
            }
        },
    };
    const calls: { method: string; flags?: number }[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body);
        calls.push({ method: body.method, flags: flagsOf(body.params[0]) });
        const out = await bundler(body.method, body.params[0]);
        return { json: async () => ({ jsonrpc: '2.0', id: 1, ...out }) };
    });
    const submit = (options: Record<string, unknown> = {}) =>
        PaymasterClient.submitGaslessUserOperation(client, wallet, SENDER, EP, SP, TOKEN, 'http://bundler.stub', CALLDATA, {
            operator: OPERATOR,
            ...options,
        });
    return { submit, calls };
}

const ESTIMATE = {
    result: {
        preVerificationGas: '0xc350', verificationGasLimit: '0x30d40', callGasLimit: '0x186a0',
        paymasterVerificationGasLimit: '0x30d40', paymasterPostOpGasLimit: '0x30d40',
    },
};

beforeEach(() => {
    SuperPaymasterInflightGuard.clearAll();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('PaymasterClient × SP 5.5.0: estimation carries superPaymasterFlags', () => {
    it('cap exhausted, SP_RENEW valid: estimation succeeds because it is sent with the same flags', async () => {
        // A bundler simulating the chain: with the cap used up, validation only passes when the
        // op asks SP to renew inline (Tok._lockDecision → INVALID_RENEWAL / INSUFFICIENT otherwise).
        const { submit, calls } = harness(async (method, op) => {
            if (flagsOf(op) !== SUPER_PAYMASTER_FLAGS.SP_RENEW) {
                return { error: { code: -32500, message: 'AA34 signature error' } };
            }
            return method === 'eth_estimateUserOperationGas' ? ESTIMATE : { result: OP_HASH };
        });
        await expect(submit({ superPaymasterFlags: SUPER_PAYMASTER_FLAGS.SP_RENEW })).resolves.toBe(OP_HASH);
        expect(calls.map((c) => [c.method, c.flags])).toEqual([
            ['eth_estimateUserOperationGas', SUPER_PAYMASTER_FLAGS.SP_RENEW],
            ['eth_sendUserOperation', SUPER_PAYMASTER_FLAGS.SP_RENEW],
        ]);
    });

    it('no flags requested: estimation and submission both carry flags = 0', async () => {
        const { submit, calls } = harness(async (method) => (method === 'eth_estimateUserOperationGas' ? ESTIMATE : { result: OP_HASH }));
        await submit();
        expect(calls.map((c) => c.flags)).toEqual([0, 0]);
    });
});

describe('PaymasterClient × SP 5.5.0: single in-flight op per sender', () => {
    const okBundler: Bundler = async (method) => (method === 'eth_estimateUserOperationGas' ? ESTIMATE : { result: OP_HASH });

    it('two truly concurrent submissions for one sender: exactly one reaches the bundler', async () => {
        // The slow signer keeps both calls suspended between the guard check and the send; with a
        // check-then-record-after-send guard both would pass.
        const { submit, calls } = harness(okBundler, { signDelayMs: 20 });
        const results = await Promise.allSettled([submit(), submit()]);
        const fulfilled = results.filter((r) => r.status === 'fulfilled');
        const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        expect(String(rejected[0].reason?.message)).toMatch(/one in-flight sponsored op per sender/);
        expect(calls.filter((c) => c.method === 'eth_sendUserOperation')).toHaveLength(1);
    });

    it('an explicit failure releases the slot: the next submission is allowed', async () => {
        let reject = true;
        const { submit } = harness(async (method) => {
            if (method === 'eth_estimateUserOperationGas') return ESTIMATE;
            return reject ? { error: { code: -32500, message: 'AA33 reverted' } } : { result: OP_HASH };
        });
        await expect(submit()).rejects.toThrow(/AA33/);
        reject = false;
        await expect(submit()).resolves.toBe(OP_HASH);
    });

    it('a transport error during eth_sendUserOperation is ambiguous: the slot is kept', async () => {
        let drop = true;
        const { submit } = harness(async (method) => {
            if (method === 'eth_estimateUserOperationGas') return ESTIMATE;
            if (drop) throw new TypeError('fetch failed');
            return { result: OP_HASH };
        });
        await expect(submit()).rejects.toThrow(/fetch failed/);
        drop = false;
        await expect(submit()).rejects.toThrow(/one in-flight sponsored op per sender/);
        SuperPaymasterInflightGuard.release(11155111, EP, SENDER);
        await expect(submit()).resolves.toBe(OP_HASH);
    });
});

describe('SuperPaymasterInflightGuard.reserve', () => {
    it('release() only drops its own reservation, not a later record()', () => {
        const release = SuperPaymasterInflightGuard.reserve(31337, EP, SENDER, 5n);
        SuperPaymasterInflightGuard.record(31337, EP, SENDER, 5n, '0xabc');
        release();
        expect(() => SuperPaymasterInflightGuard.assertNoneInFlight(31337, EP, SENDER, 5n)).toThrow(/one in-flight/);
    });
});
