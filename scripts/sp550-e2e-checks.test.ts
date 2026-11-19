import { describe, it, expect, afterEach } from 'vitest';
import { concat, encodeAbiParameters, encodeEventTopics, encodeFunctionData, pad, parseAbi, slice, toHex, type Abi, type Hex } from 'viem';
import { getUserOperationHash } from 'viem/account-abstraction';
import { readFileSync } from 'fs';
import { join } from 'path';
import { encodeSuperPaymasterData, SUPER_PAYMASTER_FLAGS } from '../packages/core/src/superPaymasterData.js';
import { isSpRelayedRenewal, flagsFromPaymasterData, opSigningProblems, renewalConsistencyProblems, tapBundler, type BundlerCall, gasSourceClient, c12TransactionProblems, packedUserOpHashV07, redactUrls, signC12Transaction, type C12SignState } from './sp550-e2e-checks.js';

// PaymasterClient.dummySignature() for a SimpleAccount (no AirAccount prefix).
const DUMMY = ('0x' + 'ff'.repeat(15) + 'f0' + '00'.repeat(16) + '7a' + 'aa'.repeat(31) + '1c') as Hex;
const REAL = ('0x' + '12'.repeat(65)) as Hex;
const A = (n: number) => ('0x' + n.toString(16).padStart(40, '0')) as `0x${string}`;

/** paymasterData as the v0.7 bundler RPC carries it: paymasterAndData without its first 52 bytes. */
const rpcPaymasterData = (flags?: number, withToken = true) => slice(encodeSuperPaymasterData({
    paymaster: A(1), operator: A(2), verificationGasLimit: 100_000n, postOpGasLimit: 200_000n,
    ...(withToken ? { token: A(3) } : {}), ...(flags === undefined ? {} : { flags }),
}), 52);

describe('flagsFromPaymasterData reads the byte the real encoder writes', () => {
    it.each([[SUPER_PAYMASTER_FLAGS.SP_RENEW], [SUPER_PAYMASTER_FLAGS.NONE], [SUPER_PAYMASTER_FLAGS.ACCOUNT_RENEW]])('flags %i round-trips', (f) => {
        expect(flagsFromPaymasterData(rpcPaymasterData(f))).toBe(f);
    });
    it('the 124-byte layout (flags omitted, which SP 5.5 accepts as 0) reads as 0', () => {
        // The SDK encoder always writes the flags byte; a bundler or another client may not.
        const pd = slice(rpcPaymasterData(SUPER_PAYMASTER_FLAGS.SP_RENEW), 0, 72);
        expect((pd.length - 2) / 2).toBe(72);
        expect(flagsFromPaymasterData(pd)).toBe(0);
    });
    it('a 5.4.x layout (no token) is not a 5.5 flags carrier', () => {
        expect(flagsFromPaymasterData(rpcPaymasterData(undefined, false))).toBeUndefined();
    });
    it.each([[undefined], ['0x123'], ['nothex']])('%j is unreadable', (v) => {
        expect(flagsFromPaymasterData(v)).toBeUndefined();
    });
});

const est = (over: Partial<BundlerCall> = {}): BundlerCall => ({ method: 'eth_estimateUserOperationGas', signature: DUMMY, flags: 0, signsBefore: 0, ...over });
const send = (over: Partial<BundlerCall> = {}): BundlerCall => ({ method: 'eth_sendUserOperation', signature: REAL, flags: 0, signsBefore: 1, ...over });

describe('opSigningProblems: placeholder-signature estimation, one signature per op', () => {
    it('the expected op is clean', () => {
        expect(opSigningProblems([est(), send(), { method: 'eth_getUserOperationReceipt', signsBefore: 1 }], 1, DUMMY)).toEqual([]);
    });
    it('no estimation call is a failure, not a pass', () => {
        expect(opSigningProblems([send()], 1, DUMMY)).toEqual([expect.stringMatching(/placeholder-signature estimation was not exercised/)]);
    });
    it('an estimate carrying a real signature fails', () => {
        expect(opSigningProblems([est({ signature: REAL }), send()], 1, DUMMY)).toEqual([expect.stringMatching(/not the placeholder/)]);
    });
    it('an estimate sent after the signer was asked fails', () => {
        expect(opSigningProblems([est({ signsBefore: 1 }), send()], 1, DUMMY)).toEqual([expect.stringMatching(/must not ask the signer/)]);
    });
    it('a retried send (re-signed) fails: two attempts, two signatures', () => {
        const p = opSigningProblems([est(), send(), send({ signsBefore: 2 })], 2, DUMMY);
        expect(p).toContain('2 eth_sendUserOperation attempt(s); one signature per op means exactly 1');
        expect(p).toContain("the user's signer was asked 2 time(s) for this op, expected 1");
    });
    it('a send carrying the placeholder fails', () => {
        expect(opSigningProblems([est(), send({ signature: DUMMY })], 1, DUMMY)).toEqual([expect.stringMatching(/placeholder or no signature/)]);
    });
    it('no send at all fails', () => {
        expect(opSigningProblems([est()], 0, DUMMY)).toEqual([
            '0 eth_sendUserOperation attempt(s); one signature per op means exactly 1',
            "the user's signer was asked 0 time(s) for this op, expected 1",
        ]);
    });
});

describe('renewalConsistencyProblems: SP_RENEW chosen by the SDK matches the chain, both ways', () => {
    const renewed = { onChainFlags: 1, sentFlags: 1, renewedInline: true, renewUsedBefore: 0n, renewUsedAfter: 1n };
    const plain = { onChainFlags: 0, sentFlags: 0, renewedInline: false, renewUsedBefore: 0n, renewUsedAfter: 0n };
    it('a renewing op and a plain op are both clean', () => {
        expect(renewalConsistencyProblems(renewed)).toEqual([]);
        expect(renewalConsistencyProblems(plain)).toEqual([]);
    });
    it('SP_RENEW without the inline event fails', () => {
        expect(renewalConsistencyProblems({ ...renewed, renewedInline: false })).toEqual([expect.stringMatching(/no AllowanceRenewed/)]);
    });
    it('SP_RENEW without the K counter moving fails', () => {
        expect(renewalConsistencyProblems({ ...renewed, renewUsedAfter: 0n })).toEqual([expect.stringMatching(/expected \+1/)]);
    });
    it('a renewal on an op without SP_RENEW fails', () => {
        expect(renewalConsistencyProblems({ ...plain, renewedInline: true, renewUsedAfter: 1n })).toHaveLength(2);
    });
    it('sent flags that differ from the bundled op fail', () => {
        expect(renewalConsistencyProblems({ ...plain, sentFlags: 1 })).toEqual([expect.stringMatching(/flags sent 0x1 but the bundled op carried 0x0/)]);
    });
    it('an unreadable sent flags byte fails', () => {
        expect(renewalConsistencyProblems({ ...plain, sentFlags: undefined })).toEqual([expect.stringMatching(/no readable SuperPaymaster flags byte/)]);
    });
});

describe('tapBundler records what left for the bundler, and nothing else', () => {
    const original = globalThis.fetch;
    afterEach(() => { globalThis.fetch = original; });
    it('records method, signature, flags and the signer count at send time; other URLs are untouched', async () => {
        const seen: string[] = [];
        const stub = (async (u: any) => { seen.push(String(u)); return new Response('{}'); }) as typeof fetch;
        globalThis.fetch = stub;
        let signs = 0;
        const sink: BundlerCall[] = [];
        const restore = tapBundler('http://127.0.0.1:4337', () => signs, sink);
        const body = (method: string, signature: Hex, flags: number) => JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: [{ signature, paymasterData: rpcPaymasterData(flags) }, A(9)] });
        await fetch('http://127.0.0.1:4337', { method: 'POST', body: body('eth_estimateUserOperationGas', DUMMY, 1) });
        signs = 1;
        await fetch('http://127.0.0.1:4337', { method: 'POST', body: body('eth_sendUserOperation', REAL, 1) });
        await fetch('http://127.0.0.1:8545', { method: 'POST', body: body('eth_sendUserOperation', REAL, 0) });
        restore();
        expect(globalThis.fetch).toBe(stub);
        expect(seen).toEqual(['http://127.0.0.1:4337', 'http://127.0.0.1:4337', 'http://127.0.0.1:8545']);
        expect(sink).toEqual([
            { method: 'eth_estimateUserOperationGas', signature: DUMMY, flags: 1, signsBefore: 0, gas: expect.any(Object) },
            { method: 'eth_sendUserOperation', signature: REAL, flags: 1, signsBefore: 1, gas: expect.any(Object) },
        ]);
        expect(opSigningProblems(sink, 1, DUMMY)).toEqual([]);
    });
});

describe('isSpRelayedRenewal decodes AllowanceRenewed with the SHIPPED xPNTsTokenV2 ABI', () => {
    // Caught on the rc.4 fork: the harness read `args.inline`, which the event does not have, so a
    // real on-chain renewal (autoRenewUsed 0 -> 1) was reported as missing. The field is `bySP`.
    const abi = JSON.parse(readFileSync(join(__dirname, '../packages/core/src/abis/xPNTsTokenV2.full.json'), 'utf8')).abi as Abi;
    const TOKEN = A(0x50), USER = A(0x51), SP = A(0x52);
    const log = (bySP: boolean, o: { address?: string; user?: `0x${string}` } = {}) => ({
        address: o.address ?? TOKEN,
        topics: encodeEventTopics({ abi, eventName: 'AllowanceRenewed', args: { user: o.user ?? USER, spender: SP } } as any) as Hex[],
        data: encodeAbiParameters([{ type: 'bool' }], [bySP]),
    });
    it('the event in the shipped ABI has the fields this check reads', () => {
        const ev = (abi as any[]).find((e) => e.type === 'event' && e.name === 'AllowanceRenewed');
        expect(ev.inputs.map((i: any) => `${i.name}:${i.type}`)).toEqual(['user:address', 'spender:address', 'bySP:bool']);
    });
    it('bySP=true for this user, this SP, from this token -> a relayed renewal', () => {
        expect(isSpRelayedRenewal(log(true), abi, { token: TOKEN, user: USER, sp: SP })).toBe(true);
    });
    it.each([
        ['bySP=false (renewForSelf)', log(false)],
        ['another token', log(true, { address: A(0x99) })],
        ['another user', log(true, { user: A(0x98) })],
        ['not this event', { address: TOKEN, topics: [('0x' + '00'.repeat(32)) as Hex], data: '0x' as Hex }],
    ])('%s -> not', (_n, l) => {
        expect(isSpRelayedRenewal(l as any, abi, { token: TOKEN, user: USER, sp: SP })).toBe(false);
    });
});

describe('gasSourceClient: only a client version or method-not-found is a usable gas source (Codex r4)', () => {
    it('a client version is recorded', () => expect(gasSourceClient({ jsonrpc: '2.0', id: 1, result: 'alto/0.0.1' })).toBe('alto/0.0.1'));
    it('"error": null beside a result is no error (Grok r5)', () => expect(gasSourceClient({ jsonrpc: '2.0', id: 1, result: 'alto/0.0.1', error: null })).toBe('alto/0.0.1'));
    it('method-not-found (-32601) is recorded as not reported', () => expect(gasSourceClient({ jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'x' } })).toBe('not reported: no web3_clientVersion'));
    it.each([
        ['an auth error', { jsonrpc: '2.0', id: 1, error: { code: -32001, message: 'unauthorized' } }],
        ['a rate limit', { jsonrpc: '2.0', id: 1, error: { code: 429, message: 'rate limited' } }],
        ['an internal error', { jsonrpc: '2.0', id: 1, error: { code: -32603, message: 'internal' } }],
        ['an error without a code', { jsonrpc: '2.0', id: 1, error: {} }],
        ['a non-string result', { jsonrpc: '2.0', id: 1, result: 42 }],
        ['an empty result', { jsonrpc: '2.0', id: 1, result: '' }],
        ['no jsonrpc field', { result: 'alto' }],
        ['not an object', 'ok'],
    ])('%s is not', (_n, reply) => expect(gasSourceClient(reply)).toBeUndefined());
});

describe('C12 transaction guard (Daybreak #468 M2): checked before the key signs, nothing signed on refusal', () => {
    const EP = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as const;
    const SP = A(0x5b), SENDER = A(0xacc), EOA = A(0xe0a), CHAIN = 11155111;
    const u = {
        sender: SENDER, nonce: 7n, callData: '0xb61d27f6' as Hex, callGasLimit: 100_000n, verificationGasLimit: 200_000n, preVerificationGas: 50_000n,
        maxFeePerGas: 3_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n, paymaster: SP, paymasterVerificationGasLimit: 300_000n,
        paymasterPostOpGasLimit: 500_000n, paymasterData: ('0x' + 'cd'.repeat(72)) as Hex, signature: REAL,
    };
    const packed = {
        sender: u.sender, nonce: u.nonce, initCode: '0x' as Hex, callData: u.callData,
        accountGasLimits: concat([pad(toHex(u.verificationGasLimit), { size: 16 }), pad(toHex(u.callGasLimit), { size: 16 })]),
        preVerificationGas: u.preVerificationGas, gasFees: concat([pad(toHex(u.maxPriorityFeePerGas), { size: 16 }), pad(toHex(u.maxFeePerGas), { size: 16 })]),
        paymasterAndData: concat([u.paymaster, pad(toHex(u.paymasterVerificationGasLimit), { size: 16 }), pad(toHex(u.paymasterPostOpGasLimit), { size: 16 }), u.paymasterData]),
        signature: u.signature,
    };
    const HASH = getUserOperationHash({ chainId: CHAIN, entryPointAddress: EP, entryPointVersion: '0.7', userOperation: u as any });
    const HANDLE = parseAbi(['function handleOps((address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature)[] ops, address beneficiary)']);
    const data = (ops = [packed], ben: `0x${string}` = EOA) => encodeFunctionData({ abi: HANDLE, functionName: 'handleOps', args: [ops as any, ben] });
    const good = () => ({ chainId: CHAIN, to: EP, value: 0n, data: data(), gas: 1_000_000n, maxFeePerGas: 3_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n });
    const expectOf = () => ({ chainId: CHAIN, entryPoint: EP, sender: SENDER, nonce: 7n, paymaster: SP, beneficiary: EOA, maxGas: 1_500_000n, maxFeePerGas: 5_000_000_000n });
    const state = (over: Partial<C12SignState> = {}): C12SignState => ({ allowTx: true, expect: expectOf(), lastSignedHash: HASH, signs: 1, txSigns: 0, signBudget: 2, ...over });

    it('the off-chain hash of the packed op equals viem\'s v0.7 getUserOperationHash', () => {
        expect(packedUserOpHashV07(packed, EP, CHAIN)).toBe(HASH);
    });
    it('the expected handleOps passes and is signed exactly once', async () => {
        expect(c12TransactionProblems(good(), { ...expectOf(), userOpHash: HASH })).toEqual([]);
        let n = 0; const st = state();
        await expect(signC12Transaction(async () => { n++; return '0xsig'; }, good(), st)).resolves.toBe('0xsig');
        expect(n).toBe(1); expect(st.txSigns).toBe(1);
        await expect(signC12Transaction(async () => { n++; return '0xsig'; }, good(), st)).rejects.toThrow(/exactly one transaction/);
        expect(n).toBe(1);
    });
    const otherOp = { ...packed, callData: '0xdeadbeef' as Hex };
    const cases: [string, any, RegExp, Partial<C12SignState>?][] = [
        ['another destination', { ...good(), to: A(0xbad) }, /is not the EntryPoint/],
        ['a value', { ...good(), value: 1n }, /value 1 is not 0/],
        ['another chain', { ...good(), chainId: 10 }, /chainId 10 is not 11155111/],
        ['other calldata (a transfer)', { ...good(), data: encodeFunctionData({ abi: parseAbi(['function transfer(address,uint256)']), functionName: 'transfer', args: [A(1), 1n] }) }, /does not decode as handleOps/],
        ['a second op in the bundle', { ...good(), data: data([packed, packed]) }, /carries 2 ops/],
        ['an op other than the signed one', { ...good(), data: data([otherOp]) }, /not the op whose hash was signed/],
        ['another beneficiary', { ...good(), data: data([packed], A(0xbe)) }, /beneficiary/],
        ['trailing bytes after the call', { ...good(), data: (data() + 'ab') as Hex }, /canonical|decode/],
        ['gas above the cap', { ...good(), gas: 1_500_001n }, /gas 1500001 is not within the cap/],
        ['a fee above the cap', { ...good(), maxFeePerGas: 5_000_000_001n }, /maxFeePerGas 5000000001 is not within the cap/],
        ['no arming (outside C12)', good(), /outside C12/, { allowTx: false }],
        ['no op signed first', good(), /no UserOperation was signed/, { lastSignedHash: undefined }],
        ['a budget already spent', good(), /budget exhausted/, { signs: 2 }],
    ];
    for (const [name, tx, why, over] of cases) {
        it(`refuses ${name} and the key is never called`, async () => {
            let n = 0;
            await expect(signC12Transaction(async () => { n++; return '0xsig'; }, tx, state(over))).rejects.toThrow(why);
            expect(n).toBe(0);
        });
    }
});

describe('redactUrls (Daybreak #468 L1): no configured URL survives into output', () => {
    const RPC = 'https://eth-sepolia.g.alchemy.com/v2/SECRETKEY123', RPC2 = 'https://eth-sepolia.g.alchemy.com/v2/SECRETKEY123456';
    it('replaces each URL by scheme + host, longest first, in a viem-style error text', () => {
        const text = `HTTP request failed.\n\nURL: ${RPC2}\nRequest body: {}\nalso ${RPC}/ and ${RPC}`;
        const out = redactUrls(text, [RPC, RPC2]);
        expect(out).not.toMatch(/SECRETKEY/);
        expect(out).toContain('https://eth-sepolia.g.alchemy.com/…');
    });
    it('the wrong-chain refusal names only the host (sp550-live-e2e.ts prints new URL(rpc).host)', () => {
        const src = readFileSync(join(__dirname, 'sp550-live-e2e.ts'), 'utf8');
        expect(src).not.toMatch(/refuse\(`\$\{rpcUrls\[0\]\}/);
        expect(src).toMatch(/installUrlRedaction\(\[\.\.\.rpcUrls, cfg\.bundlerUrl/);
    });
});
