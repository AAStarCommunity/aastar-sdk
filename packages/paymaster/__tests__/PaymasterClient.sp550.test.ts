import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createWalletClient, custom, defineChain, encodeAbiParameters, fallback, HttpRequestError, keccak256, pad, toBytes, type Address, type Hex } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { SUPER_PAYMASTER_FLAGS } from '@aastar/core';
import { PaymasterClient } from '../src/V4/PaymasterClient';
import { getUserOpHashV07 } from '../src/V4/PaymasterUtils';
import { UserOperationNotYetValidError } from '../src/V4/userOpOutcome';
import { SuperPaymasterClient } from '../src/V4/SuperPaymasterClient';
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
type WriteContract = (args: any) => Promise<Hex>;

/**
 * Each submit() runs with its OWN wallet (distinct key → distinct signatures), so signatures and
 * requests can be attributed to the call that produced them. All share one stubbed bundler.
 */
function harness(
    bundler: Bundler,
    opts: {
        signDelayMs?: number;
        writeContract?: WriteContract;
        transport?: { type?: string };
        /** Answers a readContract first; return undefined to fall through to the defaults. */
        readContract?: (functionName: string, args: readonly any[] | undefined, blockNumber?: bigint) => unknown;
        /** handleOps receipt. Default: success. A throw leaves the in-flight slot held. */
        receipt?: (hash: Hex, wait?: { onReplaced?: (response: { reason?: string; transaction?: { hash?: Hex } }) => void }) => unknown;
    } = {},
) {
    const signs: Hex[][] = [];
    const makeWallet = (idx: number) => {
        const base = mnemonicToAccount('test test test test test test test test test test test junk', { addressIndex: 3 + idx });
        signs[idx] = signs[idx] ?? [];
        const account = {
            ...base,
            signMessage: async (args: any) => {
                if (opts.signDelayMs) await new Promise((r) => setTimeout(r, opts.signDelayMs));
                const sig = await base.signMessage(args);
                signs[idx].push(sig);
                return sig;
            },
        };
        return {
            account,
            chain: { id: 11155111 },
            transport: opts.transport ?? { type: 'http' },
            writeContract: opts.writeContract ?? (async () => ('0x' + 'ee'.repeat(32)) as Hex),
        };
    };
    const client = {
        chain: { id: 11155111 },
        getChainId: async () => 11155111,
        estimateFeesPerGas: async () => ({ maxFeePerGas: 2_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n }),
        getGasPrice: async () => 1_000_000_000n,
        getBlockNumber: async () => 1234n,
        waitForTransactionReceipt: async (args: { hash: Hex; onReplaced?: (response: { reason?: string; transaction?: { hash?: Hex } }) => void }) => {
            if (opts.receipt) return opts.receipt(args.hash, args);
            return { status: 'success', transactionHash: args.hash };
        },
        readContract: async ({ functionName, args, blockNumber }: { functionName: string; args?: readonly any[]; blockNumber?: bigint }) => {
            const own = opts.readContract?.(functionName, args, blockNumber);
            if (own !== undefined) return own;
            switch (functionName) {
                case 'getNonce': return 7n;
                case 'version': return 'SuperPaymaster-5.5.0';
                case 'operators': return [10n ** 21n, true, false, TOKEN, 0, 0, 0, 0n, 0n, 0n];
                case 'gasParams': return [{ minPostOpGas: 200_000n, settleGasBound: 0n, cWrap: 0n, cPostop: 0n }];
                default: throw new Error(`stub: unexpected readContract(${functionName})`);
            }
        },
    };
    const calls: { method: string; flags?: number; signature?: Hex }[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body);
        calls.push({ method: body.method, flags: flagsOf(body.params[0]), signature: body.params[0]?.signature });
        const out = await bundler(body.method, body.params[0]);
        return { json: async () => ({ jsonrpc: '2.0', id: 1, ...out }) };
    });
    const submit = (options: Record<string, unknown> = {}, walletIdx = 0) =>
        PaymasterClient.submitGaslessUserOperation(client, makeWallet(walletIdx), SENDER, EP, SP, TOKEN, 'http://bundler.stub', CALLDATA, {
            operator: OPERATOR,
            ...options,
        });
    /** The same flow through SuperPaymasterClient (it used to estimate BEFORE submit reserved the slot). */
    const submitViaSuperClient = (walletIdx = 0) =>
        SuperPaymasterClient.submitGaslessTransaction(client, makeWallet(walletIdx), SENDER, EP, 'http://bundler.stub', {
            token: TOKEN, recipient: OPERATOR, amount: 1n, operator: OPERATOR, paymasterAddress: SP,
        });
    return { submit, submitViaSuperClient, calls, signs };
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

    it('two truly concurrent submissions for one sender: the loser signs nothing and sends nothing', async () => {
        // The slot is taken before anything is signed. Estimation carries only the dummy signature,
        // so every REAL signature the bundler saw must be the winner's.
        const { submit, calls, signs } = harness(okBundler, { signDelayMs: 20 });
        const results = await Promise.allSettled([submit({}, 0), submit({}, 1)]);
        const winner = results.findIndex((r) => r.status === 'fulfilled');
        const loser = results.findIndex((r) => r.status === 'rejected');
        expect(winner).not.toBe(-1);
        expect(loser).not.toBe(-1);
        expect(String((results[loser] as PromiseRejectedResult).reason?.message)).toMatch(/one in-flight sponsored op per sender/);
        expect(signs[loser] ?? []).toHaveLength(0);
        expect(signs[winner].length).toBeGreaterThan(0);
        for (const c of calls.filter((c) => c.method === 'eth_estimateUserOperationGas')) {
            expect(c.signature).toBe(PaymasterClient.dummySignature());
        }
        const signed = calls.filter((c) => c.method === 'eth_sendUserOperation');
        expect(signed.length).toBeGreaterThan(0);
        for (const c of signed) expect(signs[winner]).toContain(c.signature);
        expect(calls.filter((c) => c.method === 'eth_sendUserOperation')).toHaveLength(1);
    });

    it('through SuperPaymasterClient too: the loser signs nothing (estimation runs inside submit)', async () => {
        const { submitViaSuperClient, calls, signs } = harness(okBundler, { signDelayMs: 20 });
        const results = await Promise.allSettled([submitViaSuperClient(0), submitViaSuperClient(1)]);
        const winner = results.findIndex((r) => r.status === 'fulfilled');
        const loser = results.findIndex((r) => r.status === 'rejected');
        expect(winner).not.toBe(-1);
        expect(loser).not.toBe(-1);
        expect(signs[loser] ?? []).toHaveLength(0);
        for (const c of calls.filter((c) => c.method === 'eth_sendUserOperation')) expect(signs[winner]).toContain(c.signature);
    });

    it('tuneEstimate adjusts the bundler estimate; explicit limits still win', async () => {
        const seen: any[] = [];
        const { submit } = harness(async (method, op) => {
            seen.push({ method, op });
            return method === 'eth_estimateUserOperationGas' ? ESTIMATE : { result: OP_HASH };
        });
        await submit({ tuneEstimate: () => ({ verificationGasLimit: 123_456n, callGasLimit: 77_777n }), callGasLimit: 88_888n });
        const sent = seen.find((x) => x.method === 'eth_sendUserOperation')!.op;
        expect(BigInt(sent.verificationGasLimit)).toBe(123_456n); // from tuneEstimate
        expect(BigInt(sent.callGasLimit)).toBe(88_888n); // explicit option beats tuneEstimate
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
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(submit()).rejects.toThrow(/fetch failed/);
        const warned = warn.mock.calls.map((c) => String(c[0])).join('\n');
        expect(warned).toMatch(/only with evidence the op can no longer execute/);
        expect(warned).toMatch(/sender nonce advanced/);
        expect(warned).toMatch(/validity window passed per chain time/);
        expect(warned).not.toMatch(/not included|no receipt found|to clear/);
        drop = false;
        await expect(submit()).rejects.toThrow(/one in-flight sponsored op per sender/);
        SuperPaymasterInflightGuard.release(11155111, EP, SENDER);
        await expect(submit()).resolves.toBe(OP_HASH);
    });

    it('an unconfirmed hold is released only when EntryPoint.getNonce(sender, key) moves past it', async () => {
        const now = vi.spyOn(Date, 'now').mockReturnValue(1);
        let drop = true;
        let epNonce = 7n;
        const epReads: (readonly any[])[] = [];
        const sentNonce: bigint[] = [];
        const estimatedNonce: bigint[] = [];
        const { submit } = harness(async (method, op) => {
            if (method === 'eth_estimateUserOperationGas') estimatedNonce.push(BigInt(op.nonce));
            if (method === 'eth_sendUserOperation') sentNonce.push(BigInt(op.nonce));
            if (method === 'eth_estimateUserOperationGas') return ESTIMATE;
            if (drop) throw new TypeError('fetch failed');
            return { result: OP_HASH };
        }, {
            readContract: (functionName, args) => {
                // Account getNonce() has no args. EntryPoint.getNonce(sender, key) has two.
                if (functionName === 'getNonce' && args?.length === 2) {
                    epReads.push(args);
                    return epNonce;
                }
                return undefined;
            },
        });
        await expect(submit()).rejects.toThrow(/fetch failed/);
        expect(epReads).toHaveLength(0); // nothing held yet, so no EntryPoint read
        drop = false;
        now.mockReturnValue(Number.MAX_SAFE_INTEGER);
        await expect(submit()).rejects.toThrow(/outcome is unknown/);
        await expect(submit()).rejects.toThrow(/SuperPaymasterInflightGuard\.release\(11155111,/);
        expect(epReads.at(-1)?.[0]).toBe(SENDER);
        expect(epReads.at(-1)?.[1]).toBe(0n); // key of nonce 7
        epNonce = 8n;
        await expect(submit()).resolves.toBe(OP_HASH);
        // Account getNonce() in this harness is 7. Both requests must use the EntryPoint nonce.
        expect(estimatedNonce.at(-1)).toBe(8n);
        expect(sentNonce.at(-1)).toBe(8n);
    });

    it('the EntryPoint read uses the held nonce key, not key 0', async () => {
        const key = 2n;
        const seq = 4n;
        const held = (key << 64n) | seq;
        SuperPaymasterInflightGuard.reserve(11155111, EP, SENDER, held);
        let seenKey: bigint | undefined;
        let epNonce = held;
        const sentNonce: bigint[] = [];
        const estimatedNonce: bigint[] = [];
        const { submit } = harness(async (method, op) => {
            if (method === 'eth_estimateUserOperationGas') estimatedNonce.push(BigInt(op.nonce));
            if (method === 'eth_sendUserOperation') sentNonce.push(BigInt(op.nonce));
            return method === 'eth_estimateUserOperationGas' ? ESTIMATE : { result: OP_HASH };
        }, {
            readContract: (functionName, args) => {
                if (functionName === 'getNonce' && args?.length === 2) {
                    seenKey = args[1];
                    return epNonce;
                }
                return undefined;
            },
        });
        await expect(submit()).rejects.toThrow(/outcome is unknown/);
        expect(seenKey).toBe(key);
        epNonce = (key << 64n) | (seq + 1n);
        await expect(submit()).resolves.toBe(OP_HASH);
        expect(estimatedNonce.at(-1)).toBe(epNonce);
        expect(sentNonce.at(-1)).toBe(epNonce);
    });

    async function delayEntryPointNonce(
        answer: bigint,
        during: () => void,
    ): Promise<{ submit: () => Promise<Hex> }> {
        let releaseRead: () => void = () => {};
        const gate = new Promise<void>((resolve) => { releaseRead = resolve; });
        let markStarted: () => void = () => {};
        const started = new Promise<void>((resolve) => { markStarted = resolve; });
        const harnessed = harness(async (method) => (
            method === 'eth_estimateUserOperationGas' ? ESTIMATE : { result: OP_HASH }
        ), {
            readContract: (functionName, args) => {
                if (functionName === 'getNonce' && args?.length === 2) {
                    markStarted();
                    return gate.then(() => answer);
                }
                return undefined;
            },
        });
        const pending = harnessed.submit();
        await started;
        during();
        releaseRead();
        return { submit: () => pending };
    }

    it('a delayed key-2 EntryPoint read does not erase a key-0 hold reserved while it waited', async () => {
        const key = 2n;
        const seq = 4n;
        SuperPaymasterInflightGuard.reserve(11155111, EP, SENDER, (key << 64n) | seq);
        const { submit } = await delayEntryPointNonce((key << 64n) | (seq + 1n), () => {
            SuperPaymasterInflightGuard.release(11155111, EP, SENDER);
            SuperPaymasterInflightGuard.reserve(11155111, EP, SENDER, 7n).record('0xbbbb');
        });
        await expect(submit()).rejects.toThrow(/one in-flight/);
        expect(SuperPaymasterInflightGuard.heldNonce(11155111, EP, SENDER)).toBe(7n);
        expect(() => SuperPaymasterInflightGuard.assertNoneInFlight(11155111, EP, SENDER, 7n)).toThrow(/0xbbbb/);
    });

    it('a delayed same-key EntryPoint read does not erase a newer reservation', async () => {
        SuperPaymasterInflightGuard.reserve(11155111, EP, SENDER, 7n);
        const { submit } = await delayEntryPointNonce(8n, () => {
            SuperPaymasterInflightGuard.release(11155111, EP, SENDER);
            SuperPaymasterInflightGuard.reserve(11155111, EP, SENDER, 7n).record('0xbbbb');
        });
        await expect(submit()).rejects.toThrow(/one in-flight/);
        expect(SuperPaymasterInflightGuard.heldNonce(11155111, EP, SENDER)).toBe(7n);
        expect(() => SuperPaymasterInflightGuard.assertNoneInFlight(11155111, EP, SENDER, 7n)).toThrow(/0xbbbb/);
    });

    it('a JSON-RPC error from eth_sendUserOperation still releases the hold immediately', async () => {
        let reject = true;
        const { submit } = harness(async (method) => {
            if (method === 'eth_estimateUserOperationGas') return ESTIMATE;
            return reject ? { error: { code: -32500, message: 'AA33 reverted' } } : { result: OP_HASH };
        });
        await expect(submit()).rejects.toThrow(/AA33/);
        reject = false;
        await expect(submit()).resolves.toBe(OP_HASH);
    });
});

describe('PaymasterClient × SP 5.5.0: bundler -32503 is a typed not-yet-valid error', () => {
    const NOT_YET = {
        code: -32503,
        message: 'User operation is not valid yet, validAfter=1794226833, now=1794226774',
    };

    async function capture(submit: () => Promise<unknown>): Promise<UserOperationNotYetValidError> {
        try {
            await submit();
        } catch (error) {
            expect(error).toBeInstanceOf(UserOperationNotYetValidError);
            return error as UserOperationNotYetValidError;
        }
        throw new Error('submit resolved');
    }

    it('send path: fork message carries validAfter, now and seconds to wait, and does not retry', async () => {
        const { submit, calls } = harness(async (method) => {
            if (method === 'eth_estimateUserOperationGas') return ESTIMATE;
            return { error: NOT_YET };
        });
        const err = await capture(submit);
        expect(err.code).toBe(-32503);
        expect(err.validAfter).toBe(1794226833n);
        expect(err.now).toBe(1794226774n);
        expect(err.secondsToWait).toBe(59n);
        expect(err.rpcError).toEqual(NOT_YET);
        expect(err.cause).toBeInstanceOf(Error);
        expect((err.cause as Error).message).toBe(NOT_YET.message);
        expect((err.cause as { code?: number }).code).toBe(-32503);
        expect(calls.filter((c) => c.method === 'eth_sendUserOperation')).toHaveLength(1);
    });

    it('send path: releases the in-flight slot so the next op can be submitted', async () => {
        let limited = true;
        const { submit } = harness(async (method) => {
            if (method === 'eth_estimateUserOperationGas') return ESTIMATE;
            return limited ? { error: NOT_YET } : { result: OP_HASH };
        });
        await expect(submit()).rejects.toBeInstanceOf(UserOperationNotYetValidError);
        limited = false;
        await expect(submit()).resolves.toBe(OP_HASH);
    });

    it('send path: hex validAfter/now in the message, and data fields when the message has none', async () => {
        const validAfter = 1794226833n;
        const now = 1794226774n;
        const { submit } = harness(async (method) => {
            if (method === 'eth_estimateUserOperationGas') return ESTIMATE;
            return {
                error: {
                    code: -32503,
                    message: `User operation is not valid yet, validAfter=0x${validAfter.toString(16)}, now=0x${now.toString(16)}`,
                },
            };
        });
        const hex = await capture(submit);
        expect(hex.validAfter).toBe(validAfter);
        expect(hex.now).toBe(now);
        expect(hex.secondsToWait).toBe(59n);

        const { submit: submitData } = harness(async (method) => {
            if (method === 'eth_estimateUserOperationGas') return ESTIMATE;
            return {
                error: {
                    code: '-32503',
                    message: 'User operation is not valid yet',
                    data: { validAfter: '1794226900', now: 1794226800 },
                },
            };
        });
        const fromData = await capture(submitData);
        expect(fromData.validAfter).toBe(1794226900n);
        expect(fromData.now).toBe(1794226800n);
        expect(fromData.secondsToWait).toBe(100n);
        expect((fromData.cause as { data?: unknown }).data).toEqual({ validAfter: '1794226900', now: 1794226800 });
    });

    it('send path: unknown -32503 shape still throws, with the original body as cause', async () => {
        const rpc = { code: -32503, data: { unexpected: true } };
        const { submit } = harness(async (method) => {
            if (method === 'eth_estimateUserOperationGas') return ESTIMATE;
            return { error: rpc };
        });
        const err = await capture(submit);
        expect(err.validAfter).toBeUndefined();
        expect(err.now).toBeUndefined();
        expect(err.secondsToWait).toBeUndefined();
        expect(err.rpcError).toEqual(rpc);
        expect(err.cause).toBeInstanceOf(Error);
        expect((err.cause as { code?: number; data?: unknown }).code).toBe(-32503);
        expect((err.cause as { data?: unknown }).data).toEqual({ unexpected: true });
        expect((err.cause as Error).message).toContain('-32503');
    });

    it('send path: disagreeing validAfter values are not turned into a wait', async () => {
        const rpc = {
            code: -32503,
            message: 'User operation is not valid yet, validAfter=100, now=40',
            data: { validAfter: '200', now: '40' },
        };
        const { submit } = harness(async (method) => {
            if (method === 'eth_estimateUserOperationGas') return ESTIMATE;
            return { error: rpc };
        });
        const err = await capture(submit);
        expect(err.validAfter).toBeUndefined();
        expect(err.secondsToWait).toBeUndefined();
        expect(err.message).toMatch(/disagree/);
        expect(err.rpcError).toEqual(rpc);
    });

    it('send path: expires-too-soon (-32503) is the same error and does not invent a wait from validUntil', async () => {
        const rpc = {
            code: -32503,
            message: 'UserOperation expires too soon, validUntil=1794230945, now=1794231164',
        };
        const { submit } = harness(async (method) => {
            if (method === 'eth_estimateUserOperationGas') return ESTIMATE;
            return { error: rpc };
        });
        const err = await capture(submit);
        expect(err.validAfter).toBeUndefined();
        expect(err.secondsToWait).toBeUndefined();
        expect(err.now).toBe(1794231164n);
        expect((err.cause as Error).message).toContain('expires too soon');
    });

    it('estimate path: -32503 is thrown before Anvil defaults and before send, and releases the slot', async () => {
        let rejectEstimate = true;
        const { submit, calls } = harness(async (method) => {
            if (method === 'eth_estimateUserOperationGas') return rejectEstimate ? { error: NOT_YET } : ESTIMATE;
            return { result: OP_HASH };
        });
        const err = await capture(submit);
        expect(err.secondsToWait).toBe(59n);
        expect(calls.map((c) => c.method)).toEqual(['eth_estimateUserOperationGas']);
        rejectEstimate = false;
        await expect(submit()).resolves.toBe(OP_HASH);
    });

    it('a different bundler code stays a Bundler Error', async () => {
        const { submit } = harness(async (method) => {
            if (method === 'eth_estimateUserOperationGas') return ESTIMATE;
            return { error: { code: -32500, message: 'AA33 reverted' } };
        });
        try {
            await submit();
            throw new Error('submit resolved');
        } catch (error) {
            expect(error).not.toBeInstanceOf(UserOperationNotYetValidError);
            expect((error as Error).message).toMatch(/Bundler Error/);
        }
    });
});

describe('PaymasterClient × SP 5.5.0: direct handleOps fallback keeps the slot unless the node refused', () => {
    // Bundler without eth_sendUserOperation → the SDK broadcasts handleOps from the wallet itself.
    const noSendBundler: Bundler = async (method) =>
        method === 'eth_estimateUserOperationGas' ? ESTIMATE : { error: { code: -32601, message: 'Method not found' } };
    const fail = (code: number | undefined, message: string) => async (): Promise<Hex> => {
        throw Object.assign(new Error(message), code === undefined ? {} : { code });
    };

    it.each([
        ['timeout without a code (broadcast may have happened)', fail(undefined, 'The request took too long to respond.')],
        ['-32603 from an RPC proxy', fail(-32603, 'upstream request timeout')],
        ['-32000 already known (it IS in the mempool)', fail(-32000, 'already known')],
        // A node / bundler can report these on its OWN internal retry while the original is in
        // flight or already mined — so they say nothing about whether this tx was broadcast.
        ['-32000 nonce too low', fail(-32000, 'nonce too low')],
        ['-32000 replacement underpriced', fail(-32000, 'replacement underpriced')],
        ['-32000 replacement transaction underpriced', fail(-32000, 'replacement transaction underpriced')],
        ['-32000 with an unrecognised message (default: keep)', fail(-32000, 'some node-specific failure')],
    ])('ambiguous: %s → slot kept', async (_name, writeContract) => {
        const { submit } = harness(noSendBundler, { writeContract });
        await expect(submit()).rejects.toThrow();
        await expect(submit()).rejects.toThrow(/one in-flight sponsored op per sender/);
    });

    it.each([
        ['-32000 insufficient funds', fail(-32000, 'insufficient funds for gas * price + value')],
        ['-32000 intrinsic gas too low', fail(-32000, 'intrinsic gas too low')],
        ['-32000 exceeds block gas limit', fail(-32000, 'exceeds block gas limit')],
        ['-32000 tx fee exceeds the configured cap', fail(-32000, 'tx fee (1.20 ether) exceeds the configured cap (1.00 ether)')],
        ['3 execution reverted (gas estimation, before signing)', fail(3, 'execution reverted')],
        ['4001 user rejected', fail(4001, 'User rejected the request.')],
    ])('explicit: %s → slot released', async (_name, writeContract) => {
        let first = true;
        const { submit } = harness(noSendBundler, {
            writeContract: async () => {
                if (first) { first = false; return writeContract(); }
                return ('0x' + 'ee'.repeat(32)) as Hex;
            },
        });
        await expect(submit()).rejects.toThrow();
        await expect(submit()).resolves.toBe('0x' + 'ee'.repeat(32));
    });

    const TX = ('0x' + 'cd'.repeat(32)) as Hex;

    it.each([
        ['reverted', 'reverted'],
        ['0', 0],
        ['0n', 0n],
    ])('handleOps receipt status %s releases the hold and throws', async (_name, status) => {
        let reverted = true;
        const { submit } = harness(noSendBundler, {
            writeContract: async () => TX,
            receipt: () => {
                if (!reverted) return { status: 'success', transactionHash: TX };
                reverted = false;
                return { status };
            },
        });
        await expect(submit()).rejects.toThrow(/direct handleOps reverted/);
        await expect(submit()).resolves.toBe(TX);
    });

    it('handleOps receipt success records the hold (a second op is rejected with the tx hash)', async () => {
        const { submit } = harness(noSendBundler, { writeContract: async () => TX });
        await expect(submit()).resolves.toBe(TX);
        await expect(submit()).rejects.toThrow(new RegExp(TX));
    });

    const MINED = ('0x' + 'ab'.repeat(32)) as Hex;
    const CANCEL = ('0x' + '11'.repeat(32)) as Hex;

    it('handleOps repriced records and returns the mined hash', async () => {
        const { submit } = harness(noSendBundler, {
            writeContract: async () => TX,
            receipt: (_hash, wait) => {
                wait?.onReplaced?.({ reason: 'repriced', transaction: { hash: MINED } });
                return { status: 'success', transactionHash: MINED };
            },
        });
        await expect(submit()).resolves.toBe(MINED);
        await expect(submit()).rejects.toThrow(new RegExp(MINED));
    });

    it.each([
        ['cancelled', 'cancelled', CANCEL],
        ['replaced', 'replaced', MINED],
    ] as const)('handleOps %s releases the hold and does not record the original hash', async (reason, expected, mined) => {
        let once = true;
        const { submit } = harness(noSendBundler, {
            writeContract: async () => TX,
            receipt: (hash, wait) => {
                if (!once) return { status: 'success', transactionHash: hash };
                once = false;
                wait?.onReplaced?.({ reason, transaction: { hash: mined } });
                return { status: 'success', transactionHash: mined };
            },
        });
        await expect(submit()).rejects.toThrow(new RegExp(`direct handleOps ${expected}`));
        await expect(submit()).resolves.toBe(TX);
    });

    /** EntryPoint UserOperationEvent log. topic1 is the op hash; `success` is the op's own flag. */
    function userOpEventLog(userOpHash: Hex, success: boolean) {
        return {
            address: EP,
            topics: [
                keccak256(toBytes('UserOperationEvent(bytes32,address,address,uint256,bool,uint256,uint256)')),
                userOpHash,
                pad(SENDER, { size: 32 }),
                pad(SP, { size: 32 }),
            ] as Hex[],
            data: encodeAbiParameters(
                [{ type: 'uint256' }, { type: 'bool' }, { type: 'uint256' }, { type: 'uint256' }],
                [7n, success, 1n, 1n],
            ),
        };
    }

    it('handleOps replaced with a different beneficiary still records the mined hash when UserOperationEvent succeeds', async () => {
        let packed: any;
        const { submit } = harness(noSendBundler, {
            writeContract: async (req) => {
                packed = req.args[0][0];
                return TX;
            },
            receipt: (_hash, wait) => {
                const userOpHash = getUserOpHashV07(packed, EP, 11155111n);
                wait?.onReplaced?.({ reason: 'replaced', transaction: { hash: MINED } });
                return { status: 'success', transactionHash: MINED, logs: [userOpEventLog(userOpHash, true)] };
            },
        });
        await expect(submit()).resolves.toBe(MINED);
        await expect(submit()).rejects.toThrow(new RegExp(MINED));
    });

    it('handleOps replaced whose UserOperationEvent failed was included and keeps the slot', async () => {
        let packed: any;
        const { submit } = harness(noSendBundler, {
            writeContract: async (req) => {
                packed = req.args[0][0];
                return TX;
            },
            receipt: (_hash, wait) => {
                const userOpHash = getUserOpHashV07(packed, EP, 11155111n);
                wait?.onReplaced?.({ reason: 'replaced', transaction: { hash: MINED } });
                return { status: 'success', transactionHash: MINED, logs: [userOpEventLog(userOpHash, false)] };
            },
        });
        await expect(submit()).rejects.toThrow(/userOp failed/);
        await expect(submit()).rejects.toThrow(new RegExp(MINED));
    });

    it('handleOps replaced with another op\'s UserOperationEvent releases the hold', async () => {
        let once = true;
        const other = ('0x' + '22'.repeat(32)) as Hex;
        const { submit } = harness(noSendBundler, {
            writeContract: async () => TX,
            receipt: (hash, wait) => {
                if (!once) return { status: 'success', transactionHash: hash };
                once = false;
                wait?.onReplaced?.({ reason: 'replaced', transaction: { hash: MINED } });
                return { status: 'success', transactionHash: MINED, logs: [userOpEventLog(other, true)] };
            },
        });
        await expect(submit()).rejects.toThrow(/direct handleOps replaced/);
        await expect(submit()).resolves.toBe(TX);
    });

    it('a successful receipt for a different hash without repriced is not this handleOps', async () => {
        let once = true;
        const { submit } = harness(noSendBundler, {
            writeContract: async () => TX,
            receipt: (hash) => {
                if (!once) return { status: 'success', transactionHash: hash };
                once = false;
                return { status: 'success', transactionHash: CANCEL };
            },
        });
        await expect(submit()).rejects.toThrow(/direct handleOps replaced/);
        await expect(submit()).resolves.toBe(TX);
    });

    it('handleOps receipt wait throwing is ambiguous: the hold stays', async () => {
        const { submit } = harness(noSendBundler, {
            writeContract: async () => TX,
            receipt: () => { throw new Error('receipt timeout'); },
        });
        await expect(submit()).rejects.toThrow(/receipt timeout/);
        await expect(submit()).rejects.toThrow(/one in-flight/);
    });
});

describe('PaymasterClient: estimation asks the signer nothing', () => {
    // DSR request 2: a real signature at estimation time is a second wallet prompt for a KMS or
    // passkey signer. The estimation op carries a dummy in the real signature's shape instead.
    it('one op = one signMessage, and the estimation op carries the dummy, not a signature', async () => {
        const { submit, calls, signs } = harness(async (method) => (method === 'eth_estimateUserOperationGas' ? ESTIMATE : { result: OP_HASH }));
        await submit();
        expect(signs[0]).toHaveLength(1);
        expect(calls.map((c) => c.method)).toEqual(['eth_estimateUserOperationGas', 'eth_sendUserOperation']);
        expect(calls[0].signature).toBe(PaymasterClient.dummySignature());
        expect(calls[1].signature).toBe(signs[0][0]);
    });

    it('airAccountSig: the dummy has the same [0x02] prefix and length as the real signature', async () => {
        const { submit, calls, signs } = harness(async (method) => (method === 'eth_estimateUserOperationGas' ? ESTIMATE : { result: OP_HASH }));
        await submit({ airAccountSig: true });
        expect(calls[0].signature).toBe(PaymasterClient.dummySignature(true));
        expect(calls[0].signature!.slice(0, 4)).toBe('0x02');
        expect(calls[0].signature!.length).toBe(calls[1].signature!.length);
        expect(signs[0]).toHaveLength(1);
    });

    it('the dummy is a recoverable low-s ECDSA signature (so accounts return SIG_VALIDATION_FAILED, not revert)', async () => {
        const { recoverAddress, keccak256, toHex } = await import('viem');
        const sig = PaymasterClient.dummySignature();
        expect(sig.length).toBe(2 + 65 * 2);
        const s = BigInt('0x' + sig.slice(66, 130));
        expect(s <= 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0n).toBe(true);
        for (let i = 0; i < 4; i++) {
            await expect(recoverAddress({ hash: keccak256(toHex(i)), signature: sig })).resolves.toMatch(/^0x[0-9a-fA-F]{40}$/);
        }
    });

    it('submit and estimate share one resolveSuperPaymasterSponsorship (a mid-op upgrade cannot disagree)', async () => {
        // The second version() read would observe 5.4.2. Estimation must keep the first
        // read's 5.5.0 layout (73-byte paymasterData → flags byte 0), not re-resolve.
        let versionReads = 0;
        const { submit, calls } = harness(async (method) => (method === 'eth_estimateUserOperationGas' ? ESTIMATE : { result: OP_HASH }), {
            readContract: (functionName) => {
                if (functionName !== 'version') return undefined;
                versionReads += 1;
                return versionReads === 1 ? 'SuperPaymaster-5.5.0' : 'SuperPaymaster-5.4.2';
            },
        });
        await expect(submit()).resolves.toBe(OP_HASH);
        expect(versionReads).toBe(1);
        expect(calls.map((c) => [c.method, c.flags])).toEqual([
            ['eth_estimateUserOperationGas', 0],
            ['eth_sendUserOperation', 0],
        ]);
    });

    it('transport failure during estimation → slot released (the request held no executable op)', async () => {
        let drop = true;
        const { submit } = harness(async (method) => {
            if (method === 'eth_estimateUserOperationGas' && drop) throw new TypeError('fetch failed');
            return method === 'eth_estimateUserOperationGas' ? ESTIMATE : { result: OP_HASH };
        });
        await expect(submit()).rejects.toThrow(/fetch failed/);
        drop = false;
        await expect(submit()).resolves.toBe(OP_HASH);
    });

    it('estimation answered with a JSON-RPC error → slot released', async () => {
        let reject = true;
        const { submit } = harness(async (method) => {
            if (method === 'eth_estimateUserOperationGas' && reject) return { error: { code: -32500, message: 'AA23 reverted' } };
            return method === 'eth_estimateUserOperationGas' ? ESTIMATE : { result: OP_HASH };
        });
        await expect(submit()).rejects.toThrow(/Estimation Error/);
        reject = false;
        await expect(submit()).resolves.toBe(OP_HASH);
    });
});

describe('PaymasterClient × SP 5.5.0: a parseable but non-JSON-RPC answer is not an answer', () => {
    // e.g. a gateway's {"message": "..."}: it proves nothing about whether the bundler got the op.
    function gatewayHarness(failOn: string) {
        let gateway = true;
        const h = harness(async (method) => (method === 'eth_estimateUserOperationGas' ? ESTIMATE : { result: OP_HASH }));
        const real = (globalThis as any).fetch;
        vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
            if (gateway && JSON.parse(init.body).method === failOn) {
                await real(url, init); // still recorded as sent
                return { json: async () => ({ message: 'Internal server error' }) };
            }
            return real(url, init);
        });
        return { ...h, stopGateway: () => { gateway = false; } };
    }

    it('eth_sendUserOperation answered with a gateway body → throws, slot kept', async () => {
        const { submit, stopGateway } = gatewayHarness('eth_sendUserOperation');
        await expect(submit()).rejects.toThrow(/non-JSON-RPC answer/);
        stopGateway();
        await expect(submit()).rejects.toThrow(/one in-flight sponsored op per sender/);
    });

    it('eth_estimateUserOperationGas answered with a gateway body → throws, slot released (dummy signature only)', async () => {
        const { submit, stopGateway } = gatewayHarness('eth_estimateUserOperationGas');
        await expect(submit()).rejects.toThrow(/non-JSON-RPC answer/);
        stopGateway();
        await expect(submit()).resolves.toBe(OP_HASH);
    });
});

describe('PaymasterClient × SP 5.5.0: fallback classification on REAL viem errors', () => {
    // The same fallback, but writeContract is a real viem WalletClient whose node answers
    // eth_sendRawTransaction with an error — so the SDK sees viem's actual wrapper chain
    // (ContractFunctionExecutionError → TransactionExecutionError → … → the RPC error), whose
    // top-level message prints the tx including `nonce`. Hand-built Errors cannot show that.
    const noSendBundler: Bundler = async (method) =>
        method === 'eth_estimateUserOperationGas' ? ESTIMATE : { error: { code: -32601, message: 'Method not found' } };
    const chain = defineChain({
        id: 11155111, name: 'stub', nativeCurrency: { name: 'E', symbol: 'E', decimals: 18 },
        rpcUrls: { default: { http: ['http://node.stub'] } },
    });
    const TX = ('0x' + 'dd'.repeat(32)) as Hex;
    /** A stub node: reads succeed; `send(n)` answers the n-th eth_sendRawTransaction it receives. */
    function node(send: (n: number) => Hex) {
        let sends = 0;
        return custom({
            async request({ method }: { method: string }) {
                switch (method) {
                    case 'eth_chainId': return '0xaa36a7';
                    case 'eth_getTransactionCount': return '0x7';
                    case 'eth_estimateGas': return '0x5208';
                    case 'eth_gasPrice': case 'eth_maxPriorityFeePerGas': return '0x3b9aca00';
                    case 'eth_getBlockByNumber': return { baseFeePerGas: '0x3b9aca00', number: '0x1' };
                    case 'eth_sendRawTransaction': return send(sends++);
                    default: throw new Error(`stub node: unexpected ${method}`);
                }
            },
        });
    }
    const nodeError = (code: number, message: string) => Object.assign(new Error(message), { code });
    /** The harness wallet signs; its writeContract (and transport type) is a real viem WalletClient's. */
    function viemWallet(transport: Parameters<typeof createWalletClient>[0]['transport']) {
        const real = createWalletClient({
            account: mnemonicToAccount('test test test test test test test test test test test junk', { addressIndex: 9 }),
            chain,
            transport,
        });
        const writeContract: WriteContract = ({ address, abi, functionName, args }) => real.writeContract({ address, abi, functionName, args });
        // The stub node is a custom() transport (no network); the guard is told it sits behind a
        // single http endpoint, which is what these cases model. custom/fallback are tested below.
        return { writeContract, transport: { type: 'http' } };
    }
    /** First broadcast fails with the node error; later ones return TX. */
    function viemWriteContract(code: number, message: string, opts: { http503?: boolean } = {}) {
        return viemWallet(node((n) => {
            if (n > 0) return TX;
            if (opts.http503) throw new HttpRequestError({ url: 'http://node.stub', status: 503, body: {}, details: message });
            throw nodeError(code, message);
        }));
    }

    it('the wrapper really prints `nonce` (so a top-level match would misread every failure)', async () => {
        const err = await viemWriteContract(-32000, 'insufficient funds for gas * price + value').writeContract({
            address: EP, abi: (await import('@aastar/core')).EntryPointABI, functionName: 'handleOps', args: [[], SENDER],
        }).catch((e) => e);
        expect(err.name).toBe('ContractFunctionExecutionError');
        expect(err.message).toMatch(/nonce/i);
    });

    it.each([
        ['insufficient funds', -32000, 'insufficient funds for gas * price + value'],
        ['intrinsic gas too low', -32000, 'intrinsic gas too low'],
    ])('explicit (%s) → slot released', async (_n, code, message) => {
        const { submit } = harness(noSendBundler, viemWriteContract(code, message));
        await expect(submit()).rejects.toThrow();
        await expect(submit()).resolves.toBe(TX);
    });

    it.each([
        ['nonce too low', -32000, 'nonce too low'],
        ['already known', -32000, 'already known'],
        ['-32603 upstream timeout', -32603, 'upstream request timeout'],
        // Rejection WORDS without rejection provenance: viem drops the -32603 code, and a proxy's
        // 503 body can quote an earlier node error after it forwarded the tx.
        ['-32603 whose text says insufficient funds', -32603, 'upstream timeout; last error: insufficient funds for gas * price + value'],
        ['HTTP 503 whose body says insufficient funds', 0, 'upstream timeout; last error: insufficient funds for gas * price + value', { http503: true }],
    ])('ambiguous (%s) → slot kept', async (_n, code, message, opts?: { http503?: boolean }) => {
        const { submit } = harness(noSendBundler, viemWriteContract(code, message, opts));
        await expect(submit()).rejects.toThrow();
        await expect(submit()).rejects.toThrow(/one in-flight sponsored op per sender/);
    });
});

describe('PaymasterClient × SP 5.5.0: fallback transports cannot prove a refusal', () => {
    const noSendBundler: Bundler = async (method) =>
        method === 'eth_estimateUserOperationGas' ? ESTIMATE : { error: { code: -32601, message: 'Method not found' } };
    const chain = defineChain({
        id: 11155111, name: 'stub', nativeCurrency: { name: 'E', symbol: 'E', decimals: 18 },
        rpcUrls: { default: { http: ['http://node.stub'] } },
    });
    const reads = (method: string) => {
        switch (method) {
            case 'eth_chainId': return '0xaa36a7';
            case 'eth_getTransactionCount': return '0x7';
            case 'eth_estimateGas': return '0x5208';
            case 'eth_gasPrice': case 'eth_maxPriorityFeePerGas': return '0x3b9aca00';
            case 'eth_getBlockByNumber': return { baseFeePerGas: '0x3b9aca00', number: '0x1' };
            default: throw new Error(`stub node: unexpected ${method}`);
        }
    };

    it('endpoint 1 takes the tx then 503s, endpoint 2 refuses it: the slot is kept', async () => {
        const first = custom({
            async request({ method }: { method: string }) {
                if (method === 'eth_sendRawTransaction') {
                    throw new HttpRequestError({ url: 'http://one.stub', status: 503, body: {}, details: 'Service Unavailable' });
                }
                return reads(method);
            },
        });
        const second = custom({
            async request({ method }: { method: string }) {
                if (method === 'eth_sendRawTransaction') {
                    throw Object.assign(new Error('insufficient funds for gas * price + value'), { code: -32000 });
                }
                return reads(method);
            },
        });
        const real = createWalletClient({
            account: mnemonicToAccount('test test test test test test test test test test test junk', { addressIndex: 9 }),
            chain,
            transport: fallback([first, second], { retryCount: 0 }),
        });
        const { submit } = harness(noSendBundler, {
            transport: real.transport,
            writeContract: ({ address, abi, functionName, args }) => real.writeContract({ address, abi, functionName, args }),
        });
        await expect(submit()).rejects.toThrow(/insufficient funds|exceeds the balance/i);
        await expect(submit()).rejects.toThrow(/one in-flight sponsored op per sender/);
    });

    const first503 = custom({
        async request({ method }: { method: string }) {
            if (method === 'eth_sendRawTransaction') {
                throw new HttpRequestError({ url: 'http://one.stub', status: 503, body: {}, details: 'Service Unavailable' });
            }
            return reads(method);
        },
    });
    const thenFails = (code: number, message: string) => custom({
        async request({ method }: { method: string }) {
            if (method === 'eth_sendRawTransaction') throw Object.assign(new Error(message), { code });
            return reads(method);
        },
    });
    const walletOver = (transport: any) => {
        const real = createWalletClient({
            account: mnemonicToAccount('test test test test test test test test test test test junk', { addressIndex: 9 }),
            chain,
            transport,
        });
        return {
            transport: real.transport,
            writeContract: (({ address, abi, functionName, args }) => real.writeContract({ address, abi, functionName, args })) as WriteContract,
        };
    };

    it('endpoint 1 503s, then the user rejects on endpoint 2 (4001): the slot is kept', async () => {
        const { submit } = harness(noSendBundler, walletOver(fallback([first503, thenFails(4001, 'User rejected the request.')], { retryCount: 0 })));
        await expect(submit()).rejects.toThrow(/rejected/i);
        await expect(submit()).rejects.toThrow(/one in-flight sponsored op per sender/);
    });

    it('a custom() transport wrapping a fallback (503, then insufficient funds): the slot is kept', async () => {
        const inner = createWalletClient({
            chain,
            transport: fallback([first503, thenFails(-32000, 'insufficient funds for gas * price + value')], { retryCount: 0 }),
        });
        const wrapped = custom({ request: (args: any) => inner.request(args) });
        const { submit } = harness(noSendBundler, walletOver(wrapped));
        await expect(submit()).rejects.toThrow(/insufficient funds|exceeds the balance/i);
        await expect(submit()).rejects.toThrow(/one in-flight sponsored op per sender/);
    });

    it.each([
        ['fallback', { type: 'fallback' }],
        ['custom', { type: 'custom' }],
        ['unknown transport', {}],
    ])('%s: neither a node refusal nor a user rejection releases the slot', async (_n, transport) => {
        for (const [code, message] of [[-32000, 'insufficient funds for gas * price + value'], [4001, 'User rejected the request.']] as const) {
            SuperPaymasterInflightGuard.clearAll();
            const { submit } = harness(noSendBundler, {
                transport,
                writeContract: async () => { throw Object.assign(new Error(message), { code }); },
            });
            await expect(submit()).rejects.toThrow();
            await expect(submit()).rejects.toThrow(/one in-flight sponsored op per sender/);
        }
    });

    it('http: a user rejection (4001) releases the slot', async () => {
        let first = true;
        const { submit } = harness(noSendBundler, {
            transport: { type: 'http' },
            writeContract: async () => {
                if (first) { first = false; throw Object.assign(new Error('User rejected the request.'), { code: 4001 }); }
                return ('0x' + 'ee'.repeat(32)) as Hex;
            },
        });
        await expect(submit()).rejects.toThrow();
        await expect(submit()).resolves.toBe('0x' + 'ee'.repeat(32));
    });
});

describe('SuperPaymasterInflightGuard.record', () => {
    it('a late answer for nonce N does not overwrite a newer reservation for N+1', () => {
        SuperPaymasterInflightGuard.reserve(31337, EP, SENDER, 7n);
        // The chain consumed 7 (current nonce 8); a second call reserves 8.
        SuperPaymasterInflightGuard.reserve(31337, EP, SENDER, 8n);
        // The first call's send answer arrives only now.
        SuperPaymasterInflightGuard.record(31337, EP, SENDER, 7n, '0x07');
        // A third call at nonce 8 must still be rejected (it would sign nonce 8 a second time).
        expect(() => SuperPaymasterInflightGuard.reserve(31337, EP, SENDER, 8n)).toThrow(/one in-flight/);
    });

    it('a record for the same or a higher nonce still replaces the entry', () => {
        SuperPaymasterInflightGuard.reserve(31337, EP, SENDER, 8n);
        SuperPaymasterInflightGuard.record(31337, EP, SENDER, 8n, '0x08');
        expect(() => SuperPaymasterInflightGuard.assertNoneInFlight(31337, EP, SENDER, 8n)).toThrow(/\(0x08\)/);
        SuperPaymasterInflightGuard.record(31337, EP, SENDER, 9n, '0x09');
        expect(() => SuperPaymasterInflightGuard.assertNoneInFlight(31337, EP, SENDER, 9n)).toThrow(/\(0x09\)/);
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

describe('PaymasterClient × SP 5.5.0: inline renewal (SP_RENEW) decided per op', () => {
    // A model of the chain: SuperPaymaster's a0 (SuperPaymaster.sol:305-310 at v5.5.0-rc.4) and the
    // token's _lockDecision (xPNTsTokenV2.sol:190-214), written here independently of the SDK. The
    // bundler stub applies the lock exactly as validation would, so an SDK whose flag or a0 is wrong
    // gets AA34 instead of a receipt.
    // Deliberately non-round, so both divisions leave a remainder: a floor instead of a ceiling in
    // the SDK's a0 is off by one and the boundary test below fails.
    const PRICE = 301_234_567_891n; // $3012.34567891
    const DECIMALS = 8;
    const APNTS_PRICE_USD = 21_300_000_000_000_007n; // ~$0.0213
    const FEE_BPS = 1037n;
    const BUFFER_BPS = 1000n;
    const K = 1;
    const ceil = (a: bigint, b: bigint) => (a + b - 1n) / b;
    const a0Of = (op: any) => {
        const maxCost = (BigInt(op.verificationGasLimit) + BigInt(op.callGasLimit) + BigInt(op.paymasterVerificationGasLimit)
            + BigInt(op.paymasterPostOpGasLimit) + BigInt(op.preVerificationGas)) * BigInt(op.maxFeePerGas);
        const base = ceil(maxCost * PRICE * 10n ** 18n, 10n ** BigInt(DECIMALS) * APNTS_PRICE_USD);
        return ceil(base * (10_000n + FEE_BPS + BUFFER_BPS), 10_000n);
    };
    const LOCK = { OK: 0, INSUFFICIENT: 1, INVALID_RENEWAL: 4 };

    function chain(init: { cap: bigint; used: bigint; balanceShort?: boolean; renewalMode?: number }) {
        const tok = { cap: init.cap, used: init.used, autoRenewUsed: 0, renewalMode: init.renewalMode ?? 0, lockedOf: 0n, credit: 0n };
        const decide = (a0: bigint, spRenew: boolean) => {
            if (spRenew && (tok.renewalMode !== 0 || tok.autoRenewUsed >= K || tok.lockedOf !== 0n || tok.credit !== 0n)) return LOCK.INVALID_RENEWAL;
            const used = spRenew ? 0n : tok.used;
            if (tok.cap - used < a0) return LOCK.INSUFFICIENT;
            if (init.balanceShort) return LOCK.INSUFFICIENT;
            return LOCK.OK;
        };
        const previews: { a0: bigint; spRenew: boolean }[] = [];
        const blocks = new Set<bigint | undefined>();
        const readContract = (fn: string, args: readonly any[] | undefined, blockNumber?: bigint) => {
            if (['cachedPrice', 'aPNTsPriceUSD', 'protocolFeeBPS', 'previewLock'].includes(fn)) blocks.add(blockNumber);
            switch (fn) {
                case 'cachedPrice': return { price: PRICE, updatedAt: 0n, roundId: 0n, decimals: DECIMALS };
                case 'aPNTsPriceUSD': return APNTS_PRICE_USD;
                case 'protocolFeeBPS': return FEE_BPS;
                case 'previewLock': {
                    const [spender, user, , a0, spRenew] = args!;
                    // previewLock evaluates as if `spender` called tryLockForGas: it must be SP itself.
                    if (spender !== SP || user !== SENDER) throw new Error(`previewLock(${spender}, ${user}): wrong spender/user`);
                    previews.push({ a0, spRenew });
                    return [decide(a0, spRenew), 0n];
                }
                default: return undefined;
            }
        };
        const sent: { flags?: number; a0: bigint }[] = [];
        const bundler: Bundler = async (method, op) => {
            const spRenew = flagsOf(op) === SUPER_PAYMASTER_FLAGS.SP_RENEW;
            const a0 = a0Of(op);
            // No credit in this model: anything but OK is SP's sigFail.
            if (decide(a0, spRenew) !== LOCK.OK) return { error: { code: -32500, message: 'AA34 signature error' } };
            if (method === 'eth_estimateUserOperationGas') return ESTIMATE;
            if (spRenew) { tok.autoRenewUsed += 1; tok.used = 0n; }
            tok.used += a0;
            sent.push({ flags: flagsOf(op), a0 });
            return { result: OP_HASH };
        };
        /** The user's own renewForSelf(sp): resets the epoch and the K counter (xPNTsV2Base.sol:300-307). */
        const renewForSelf = () => { tok.used = 0n; tok.autoRenewUsed = 0; };
        const exhaust = () => { tok.used = tok.cap; };
        return { tok, readContract, bundler, sent, previews, blocks, renewForSelf, exhaust };
    }
    const CAP = 10n ** 30n; // large: room for several ops; `exhaust()` empties it

    /** Each op mines before the next one: drop the in-flight record the way a receipt would. */
    const mined = () => SuperPaymasterInflightGuard.release(11155111, EP, SENDER);

    it('exhausted epoch → inline renewal; K used → no flag, refused; explicit renewal → plain ops again', async () => {
        const c = chain({ cap: CAP, used: 0n });
        const { submit, calls } = harness(c.bundler, { readContract: c.readContract });

        // 1. Room left: no flag (renewing now would waste the single K).
        await expect(submit()).resolves.toBe(OP_HASH); mined();
        expect(c.sent.at(-1)!.flags).toBe(0);
        expect(c.tok.autoRenewUsed).toBe(0);

        // 2. Epoch exhausted: SP_RENEW on both estimation and submission; K is spent once.
        c.exhaust();
        await expect(submit()).resolves.toBe(OP_HASH); mined();
        expect(calls.slice(-2).map((x) => [x.method, x.flags])).toEqual([
            ['eth_estimateUserOperationGas', SUPER_PAYMASTER_FLAGS.SP_RENEW],
            ['eth_sendUserOperation', SUPER_PAYMASTER_FLAGS.SP_RENEW],
        ]);
        expect(c.tok.autoRenewUsed).toBe(1);

        // 3. Right after the renewal there is room again: no flag.
        await expect(submit()).resolves.toBe(OP_HASH); mined();
        expect(c.sent.at(-1)!.flags).toBe(0);

        // 4. Exhausted again with K used: the flag would be INVALID_RENEWAL, so it is not sent; with
        //    no credit the op is refused (estimation AA34) and nothing is signed for it.
        c.exhaust();
        const sentBefore = c.sent.length;
        await expect(submit()).rejects.toThrow(/AA34/);
        expect(calls.at(-1)!.flags).toBe(0);
        expect(c.sent.length).toBe(sentBefore);

        // 5. The user's explicit renewForSelf restores the epoch: plain op, K counter back at 0.
        c.renewForSelf();
        await expect(submit()).resolves.toBe(OP_HASH); mined();
        expect(c.sent.at(-1)!.flags).toBe(0);

        // 6. And the next exhaustion can be renewed inline again.
        c.exhaust();
        await expect(submit()).resolves.toBe(OP_HASH); mined();
        expect(c.sent.at(-1)!.flags).toBe(SUPER_PAYMASTER_FLAGS.SP_RENEW);
        expect(c.sent.map((x) => x.flags)).toEqual([0, SUPER_PAYMASTER_FLAGS.SP_RENEW, 0, 0, SUPER_PAYMASTER_FLAGS.SP_RENEW]);
    });

    it('the a0 the SDK previews is the a0 SP reserves for the submitted op', async () => {
        const c = chain({ cap: CAP, used: 0n });
        const { submit } = harness(c.bundler, { readContract: c.readContract });
        await submit();
        // Last preview before the send is the final op's (the estimation op's limits are larger).
        expect(c.previews.at(-1)!.a0).toBe(c.sent[0].a0);
        expect(c.previews[0].a0).toBeGreaterThan(c.sent[0].a0);
        // Price, fee and both previews read at one pinned block, never `latest`.
        expect([...c.blocks]).toEqual([1234n]);
    });

    it('remaining allowance between the final a0 and a0 + 1: decided on the exact a0, not a margin', async () => {
        // Find the final op's a0, then leave exactly that much: no flag. One less: flag.
        const probe = chain({ cap: CAP, used: 0n });
        await harness(probe.bundler, { readContract: probe.readContract }).submit();
        const a0 = probe.sent[0].a0;
        SuperPaymasterInflightGuard.clearAll();

        const exact = chain({ cap: CAP, used: CAP - a0 });
        // Estimation needs its own (larger) a0, so it renews; the submission does not need to.
        await harness(exact.bundler, { readContract: exact.readContract }).submit();
        expect(exact.sent[0].flags).toBe(0);
        SuperPaymasterInflightGuard.clearAll();

        const short = chain({ cap: CAP, used: CAP - a0 + 1n });
        await harness(short.bundler, { readContract: short.readContract }).submit();
        expect(short.sent[0].flags).toBe(SUPER_PAYMASTER_FLAGS.SP_RENEW);
    });

    it('explicit gas limits (no estimation): an exhausted epoch is renewed on the final op', async () => {
        const c = chain({ cap: CAP, used: CAP });
        const { submit, calls } = harness(c.bundler, { readContract: c.readContract });
        await expect(submit({ verificationGasLimit: 200_000n, callGasLimit: 100_000n, preVerificationGas: 60_000n })).resolves.toBe(OP_HASH);
        expect(calls.map((x) => [x.method, x.flags])).toEqual([['eth_sendUserOperation', SUPER_PAYMASTER_FLAGS.SP_RENEW]]);
    });

    it('known limit: a cap below the ESTIMATION op\'s a0 fails estimation, with or without the renewal', async () => {
        // The estimation op reserves for its own oversized limits (VGL 250k, CGL 500k, PM 300k/300k).
        // With the cap between the final a0 and that, no flag makes the estimation op fit; this is
        // independent of renewal (a fresh epoch with such a cap fails the same way). Explicit limits
        // (previous test) avoid it.
        const probe = chain({ cap: CAP, used: 0n });
        await harness(probe.bundler, { readContract: probe.readContract }).submit();
        const [aEst, aFinal] = [probe.previews[0].a0, probe.sent[0].a0];
        SuperPaymasterInflightGuard.clearAll();
        const cap = (aEst + aFinal) / 2n;
        const c = chain({ cap, used: cap });
        const { submit, calls } = harness(c.bundler, { readContract: c.readContract });
        await expect(submit()).rejects.toThrow(/AA34/);
        expect(calls.map((x) => x.method)).toEqual(['eth_estimateUserOperationGas']);
    });

    it('balance (not allowance) short: no flag — a renewal cannot fix it', async () => {
        const c = chain({ cap: CAP, used: CAP, balanceShort: true });
        const { submit, calls } = harness(c.bundler, { readContract: c.readContract });
        await expect(submit()).rejects.toThrow(/AA34/);
        expect(calls.every((x) => x.flags === 0)).toBe(true);
        expect(c.tok.autoRenewUsed).toBe(0);
    });

    it('renewalMode is not MODE_SP_K: no flag', async () => {
        const c = chain({ cap: CAP, used: CAP, renewalMode: 1 });
        const { submit, calls } = harness(c.bundler, { readContract: c.readContract });
        await expect(submit()).rejects.toThrow(/AA34/);
        expect(calls.every((x) => x.flags === 0)).toBe(true);
    });

    it('superPaymasterAutoRenew: false → never sets the flag', async () => {
        const c = chain({ cap: CAP, used: CAP });
        const { submit, calls } = harness(c.bundler, { readContract: c.readContract });
        await expect(submit({ superPaymasterAutoRenew: false })).rejects.toThrow(/AA34/);
        expect(calls.every((x) => x.flags === 0)).toBe(true);
        expect(c.previews).toHaveLength(0);
    });

    it('an explicit superPaymasterFlags wins: no previewLock reads', async () => {
        const c = chain({ cap: CAP, used: 0n });
        const { submit } = harness(c.bundler, { readContract: c.readContract });
        await submit({ superPaymasterFlags: 0 });
        expect(c.previews).toHaveLength(0);
    });

    it('a fee bump after "replacement underpriced" re-decides on the larger a0', async () => {
        let underpriced = true;
        const c = chain({ cap: CAP, used: 0n });
        const bundler: Bundler = async (method, op) => {
            if (method === 'eth_sendUserOperation' && underpriced) {
                underpriced = false;
                return { error: { code: -32602, message: 'replacement underpriced' } };
            }
            return c.bundler(method, op);
        };
        const { submit } = harness(bundler, { readContract: c.readContract });
        await submit();
        const finals = c.previews.filter((p) => !p.spRenew).map((p) => p.a0);
        // estimation, first sign, re-sign after the 15% bump
        expect(finals).toHaveLength(3);
        expect(finals[2]).toBeGreaterThan(finals[1]);
        expect(c.sent[0].a0).toBe(finals[2]);
    });
});
