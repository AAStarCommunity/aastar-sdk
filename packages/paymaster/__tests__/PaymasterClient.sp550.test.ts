import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createWalletClient, custom, defineChain, fallback, HttpRequestError, type Address, type Hex } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { SUPER_PAYMASTER_FLAGS } from '@aastar/core';
import { PaymasterClient } from '../src/V4/PaymasterClient';
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
function harness(bundler: Bundler, opts: { signDelayMs?: number; writeContract?: WriteContract; transport?: { type?: string } } = {}) {
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
        // The estimation step signs a complete op on the real nonce and sends it to the bundler, so
        // the slot must be taken before it: counting only eth_sendUserOperation would miss a loser
        // that had already handed the bundler a valid signature via eth_estimateUserOperationGas.
        const { submit, calls, signs } = harness(okBundler, { signDelayMs: 20 });
        const results = await Promise.allSettled([submit({}, 0), submit({}, 1)]);
        const winner = results.findIndex((r) => r.status === 'fulfilled');
        const loser = results.findIndex((r) => r.status === 'rejected');
        expect(winner).not.toBe(-1);
        expect(loser).not.toBe(-1);
        expect(String((results[loser] as PromiseRejectedResult).reason?.message)).toMatch(/one in-flight sponsored op per sender/);
        expect(signs[loser] ?? []).toHaveLength(0);
        expect(signs[winner].length).toBeGreaterThan(0);
        // Every signed request the bundler saw carries the winner's signature.
        const signed = calls.filter((c) => c.signature && c.signature !== '0x');
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
        for (const c of calls.filter((c) => c.signature && c.signature !== '0x')) expect(signs[winner]).toContain(c.signature);
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
        await expect(submit()).rejects.toThrow(/fetch failed/);
        drop = false;
        await expect(submit()).rejects.toThrow(/one in-flight sponsored op per sender/);
        SuperPaymasterInflightGuard.release(11155111, EP, SENDER);
        await expect(submit()).resolves.toBe(OP_HASH);
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
});

describe('PaymasterClient × SP 5.5.0: the signed estimation request is an exposure', () => {
    // eth_estimateUserOperationGas carries a real signature over the real nonce, so once it has
    // left, only a parsed JSON-RPC answer tells us the bundler did not keep an executable op.
    it('transport failure during estimation → slot kept', async () => {
        let drop = true;
        const { submit } = harness(async (method) => {
            if (method === 'eth_estimateUserOperationGas' && drop) throw new TypeError('fetch failed');
            return method === 'eth_estimateUserOperationGas' ? ESTIMATE : { result: OP_HASH };
        });
        await expect(submit()).rejects.toThrow(/fetch failed/);
        drop = false;
        await expect(submit()).rejects.toThrow(/one in-flight sponsored op per sender/);
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

    it.each(['eth_estimateUserOperationGas', 'eth_sendUserOperation'])('%s answered with a gateway body → throws, slot kept', async (method) => {
        const { submit, stopGateway } = gatewayHarness(method);
        await expect(submit()).rejects.toThrow(/non-JSON-RPC answer/);
        stopGateway();
        await expect(submit()).rejects.toThrow(/one in-flight sponsored op per sender/);
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
