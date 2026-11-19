import { describe, it, expect, afterEach } from 'vitest';
import { createHash } from 'crypto';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { concat, createWalletClient, custom, getAddress, encodeAbiParameters, encodeEventTopics, encodeFunctionData, pad, parseAbi, parseTransaction, slice, toHex, type Abi, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { superPaymasterLock } from '../packages/paymaster/src/SuperPaymaster/v550.js';
import { getUserOperationHash } from 'viem/account-abstraction';
import { readFileSync } from 'fs';
import { join } from 'path';
import { encodeSuperPaymasterData, SUPER_PAYMASTER_FLAGS } from '../packages/core/src/superPaymasterData.js';
import { isSpRelayedRenewal, flagsFromPaymasterData, opSigningProblems, renewalConsistencyProblems, tapBundler, type BundlerCall, gasSourceClient, CostApprovals, checkoutContains, guardedSignMessage, headFreshnessProblem, MAX_BLOCKS_SINCE_CHECK, readPlanFile, readPricingAt, livePlanGateProblems, maxCostDigitsProblem, parsePlanJson, sdkLivePlanProblems, signTimeCostProblems, c12TransactionProblems, gasParamsDiff, gasParamsOf, packedUserOpHashV07, redactUrls, signC12Transaction, snapshotChanges, type C12SignState } from './sp550-e2e-checks.js';

// This file spawns git (checkoutContains): every top-level describe carries an explicit timeout.
const SPAWN_VERDICT_TIMEOUT_MS = 30_000;

// PaymasterClient.dummySignature() for a SimpleAccount (no AirAccount prefix).
const DUMMY = ('0x' + 'ff'.repeat(15) + 'f0' + '00'.repeat(16) + '7a' + 'aa'.repeat(31) + '1c') as Hex;
const REAL = ('0x' + '12'.repeat(65)) as Hex;
const A = (n: number) => ('0x' + n.toString(16).padStart(40, '0')) as `0x${string}`;

/** paymasterData as the v0.7 bundler RPC carries it: paymasterAndData without its first 52 bytes. */
const rpcPaymasterData = (flags?: number, withToken = true) => slice(encodeSuperPaymasterData({
    paymaster: A(1), operator: A(2), verificationGasLimit: 100_000n, postOpGasLimit: 200_000n,
    ...(withToken ? { token: A(3) } : {}), ...(flags === undefined ? {} : { flags }),
}), 52);

describe('flagsFromPaymasterData reads the byte the real encoder writes', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
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

describe('opSigningProblems: placeholder-signature estimation, one signature per op', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
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

describe('renewalConsistencyProblems: SP_RENEW chosen by the SDK matches the chain, both ways', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
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

describe('tapBundler records what left for the bundler, and nothing else', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    const original = globalThis.fetch;
    afterEach(() => { globalThis.fetch = original; }, SPAWN_VERDICT_TIMEOUT_MS);
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

describe('isSpRelayedRenewal decodes AllowanceRenewed with the SHIPPED xPNTsTokenV2 ABI', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
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

describe('gasSourceClient: only a client version or method-not-found is a usable gas source (Codex r4)', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
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

describe('C12 transaction guard (Daybreak #468 M2): checked before the key signs, nothing signed on refusal', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
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
    const good = () => ({ type: 'eip1559', chainId: CHAIN, to: EP, value: 0n, data: data(), gas: 1_000_000n, maxFeePerGas: 3_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n, nonce: 3 });
    const expectOf = () => ({ chainId: CHAIN, entryPoint: EP, sender: SENDER, nonce: 7n, paymaster: SP, beneficiary: EOA, maxGas: 1_500_000n, maxFeePerGas: 5_000_000_000n, txNonce: 3 });
    const state = (over: Partial<C12SignState> = {}): C12SignState => ({ allowTx: true, expect: expectOf(), lastSignedHash: HASH, lastSignature: REAL, signs: 1, txSigns: 0, signBudget: 2, txNonceNow: async () => 3, costAtKey: async () => {}, fresh: async () => {}, ...over });

    it('the off-chain hash of the packed op equals viem\'s v0.7 getUserOperationHash', () => {
        expect(packedUserOpHashV07(packed, EP, CHAIN)).toBe(HASH);
    });
    it('the expected handleOps passes and is signed exactly once', async () => {
        expect(c12TransactionProblems(good(), { ...expectOf(), userOpHash: HASH, userOpSignature: REAL })).toEqual([]);
        let n = 0; const st = state();
        await expect(signC12Transaction(async () => { n++; return '0xsig'; }, good(), st)).resolves.toBe('0xsig');
        expect(n).toBe(1); expect(st.txSigns).toBe(1);
        await expect(signC12Transaction(async () => { n++; return '0xsig'; }, good(), st)).rejects.toThrow(/exactly one transaction/);
        expect(n).toBe(1);
    });
    it('C12\'s transaction is held to the plan again at its own re-check (pricing moved since the UserOp): refused, nothing signed (Codex cost-cap r2 H2)', async () => {
        let n = 0, order: string[] = [];
        const st = state({ beforeSign: async () => { order.push('recheck'); }, txNonceNow: async () => { order.push('nonce'); return 3; }, costAtKey: async () => { order.push('cost'); throw new Error('exchangeRate != plan'); } });
        await expect(signC12Transaction(async () => { n++; return '0xsig'; }, good(), st)).rejects.toThrow('exchangeRate != plan');
        expect(n).toBe(0);
        expect(order).toEqual(['recheck', 'nonce', 'cost']);
        await expect(signC12Transaction(async () => { n++; return '0xsig'; }, good(), state({ costAtKey: undefined }))).rejects.toThrow(/no plan pricing check is wired/);
        expect(n).toBe(0);
    });
    it('an armed C12 without a nonce re-read wired (txNonceNow) is refused, nothing signed (fail closed, DSR)', async () => {
        let n = 0;
        await expect(signC12Transaction(async () => { n++; return '0xsig'; }, good(), state({ txNonceNow: undefined }))).rejects.toThrow(/no pending-nonce re-read is wired/);
        expect(n).toBe(0);
    });
    it('the EOA pending nonce re-read at the boundary: unchanged signs, moved is refused with no signature', async () => {
        let n = 0;
        await expect(signC12Transaction(async () => { n++; return '0xsig'; }, good(), state({ txNonceNow: async () => 3 }))).resolves.toBe('0xsig');
        expect(n).toBe(1);
        await expect(signC12Transaction(async () => { n++; return '0xsig'; }, good(), state({ txNonceNow: async () => 4 }))).rejects.toThrow(/pending nonce moved 3 -> 4/);
        expect(n).toBe(1);
    });
    it('two concurrent transaction signatures: exactly one signs (the slot is taken before any await)', async () => {
        let n = 0;
        const st = state({ beforeSign: () => new Promise((ok) => setTimeout(ok, 20)) });
        const r = await Promise.allSettled([0, 1].map(() => signC12Transaction(async () => { n++; return '0xsig'; }, good(), st)));
        expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
        expect(n).toBe(1);
    });
    it('the request viem prepares for writeContract(handleOps) passes the guard as is (no rewrite after signTransaction)', async () => {
        const key = ('0x' + '5a'.repeat(31) + '02') as Hex;
        const acct = privateKeyToAccount(key);
        let seen: any; let raw: Hex | undefined;
        const account = { ...acct, signTransaction: async (t: any, o?: any) => { seen = t; return acct.signTransaction(t, o); } };
        const transport = custom({ async request({ method, params }: any) {
            switch (method) {
                case 'eth_chainId': return toHex(CHAIN);
                case 'eth_getTransactionCount': return '0x3';
                case 'eth_estimateGas': return toHex(900_000n);
                case 'eth_maxPriorityFeePerGas': return toHex(1_000_000_000n);
                case 'eth_getBlockByNumber': return { baseFeePerGas: toHex(1_000_000_000n), number: '0x10', timestamp: '0x1', hash: '0x' + '11'.repeat(32), transactions: [] };
                case 'eth_sendRawTransaction': raw = params[0]; return '0x' + '22'.repeat(32);
                default: throw new Error(`unexpected ${method}`);
            }
        } });
        const w = createWalletClient({ account: account as any, chain: { ...sepolia }, transport });
        await w.writeContract({ address: EP, abi: HANDLE, functionName: 'handleOps', args: [[packed as any], acct.address], gas: 1_000_000n, maxFeePerGas: 3_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n } as any);
        expect(c12TransactionProblems(seen, { ...expectOf(), beneficiary: acct.address, userOpHash: HASH, userOpSignature: REAL })).toEqual([]);
        // What was broadcast is what was checked.
        const tx = parseTransaction(raw!);
        expect(tx.to?.toLowerCase()).toBe(EP.toLowerCase());
        expect(tx.data).toBe(seen.data);
        expect(tx.maxFeePerGas).toBe(seen.maxFeePerGas);
        expect(tx.gas).toBe(seen.gas);
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
        ['a legacy transaction whose gasPrice is uncapped', { ...good(), type: 'legacy', maxFeePerGas: 0n, maxPriorityFeePerGas: 0n, gasPrice: 10n ** 12n }, /type "legacy" is not eip1559|gasPrice/],
        ['blob fields (charged outside the cap)', { ...good(), type: 'eip4844', blobVersionedHashes: ['0x01' + '00'.repeat(31)], maxFeePerBlobGas: 10n ** 18n }, /eip1559|blobVersionedHashes|maxFeePerBlobGas/],
        ['an authorization list', { ...good(), authorizationList: [] }, /authorizationList/],
        ['a non-empty access list', { ...good(), accessList: [{ address: A(1), storageKeys: [] }] }, /accessList/],
        ['the same op with other signature bytes (the hash omits the signature)', { ...good(), data: data([{ ...packed, signature: ('0x' + '34'.repeat(65)) as Hex }]) }, /signature is not the bytes/],
        ['another outer nonce (would replace a pending tx)', { ...good(), nonce: 2 }, /nonce 2 is not the EOA's pending nonce 3/],
        ['an `input` field', { ...good(), input: data() }, /unrecognised transaction field\(s\) input/],
        ['an unknown field', { ...good(), foo: 1 }, /unrecognised transaction field\(s\) foo/],
        ['a `from` that is not the EOA', { ...good(), from: A(0xf00) }, /from is not the user's EOA/],
        ['a nonce manager', { ...good(), nonceManager: {} }, /nonceManager is not part of/],
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

describe('redactUrls (Daybreak #468 L1): no configured URL survives into output', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
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

describe('gasParams snapshot helpers (Daybreak #468 M1)', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    const T = { minPostOpGas: 500_000n, settleGasBound: 450_000n, cWrap: 5_000n, cPostop: 450_000n };
    it('gasParamsOf reads the tuple by name or by index; gasParamsDiff names every differing field', () => {
        expect(gasParamsOf({ minPostOpGas: 500000, settleGasBound: 450000, cWrap: 5000, cPostop: 450000 })).toEqual(T);
        expect(gasParamsOf([500000, 450000, 5000, 450000])).toEqual(T);
        expect(gasParamsDiff(T, T)).toEqual([]);
        for (const k of Object.keys(T) as (keyof typeof T)[]) expect(gasParamsDiff({ ...T, [k]: T[k] + 1n }, T), k).toEqual([`${k} ${T[k] + 1n} != ${T[k]}`]);
    });
    it('snapshotChanges flags a gasParams (or any wiring) change between the gate and a signature, ignoring the block number', () => {
        const g = { blockNumber: 1n, gpMinPostOpGas: 500_000n, gpPending: '[0,0]', impl: '0xAbc' };
        expect(snapshotChanges(g, { ...g, blockNumber: 9n, impl: '0xabc' })).toEqual([]);
        expect(snapshotChanges(g, { ...g, gpMinPostOpGas: 600_000n })).toEqual(['gpMinPostOpGas 500000 -> 600000']);
        expect(snapshotChanges(g, { ...g, gpPending: '[1,2]' })).toEqual(['gpPending [0,0] -> [1,2]']);
    });
});

describe('redactUrls: normalized forms and fragments', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('a host-cased / default-port URL as viem prints it, and the secret path alone, are both scrubbed', () => {
        const cfg = 'https://RPC.example:443/v2/SECRETKEY99';
        expect(redactUrls('URL: https://rpc.example/v2/SECRETKEY99', [cfg])).not.toMatch(/SECRETKEY99/);
        expect(redactUrls('request to /v2/SECRETKEY99 failed', [cfg])).not.toMatch(/SECRETKEY99/);
        expect(redactUrls('https://u:p4ssw0rd@rpc.example/', ['https://u:p4ssw0rd@rpc.example/'])).not.toMatch(/p4ssw0rd/);
    });
});

describe('per-op cost cap against SP\'s frozen plan (DSR)', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    const ACCT = A(0xacc);
    const lock = superPaymasterLock;
    // SP's shared vector as a plan: maxCost 1234567890123457, priceCap 3500e8, aPNTs 29999999999999999, fee 137, rate 1.333…
    const sdkLive = { maxCostPerOpWei: '1234567890123457', priceCap: '350000000000', priceDecimals: 8, aPNTsPriceUSD: '29999999999999999', protocolFeeBPS: 137,
        validationBufferBPS: 1000, exchangeRate: '1333333333333333333', a0: '144032920514403321468', Amax: '160409463576890979119', Xmax: '213879284769187972106', status: 'cleared', priceHeadroomBPS: 0 };
    const OP = A(0x0e), X = A(0x0f), S1 = A(0x51), S2 = A(0x52);
    const phaseC = { priceCap: '350000000000', priceDecimals: 8, aPNTsPriceUSD: '29999999999999999', protocolFeeBPS: 137, exchangeRate: '1333333333333333333', addresses: { X } };
    // plans is keyed by SP's three-arm accounts S; this run's account is an extraEndUser.
    const bundle = (over: any = {}, pc: any = phaseC, extra: any = { users: [{ address: ACCT, xAmount: '1000' }] }) => ({
        shared: { sdkLive: { ...sdkLive, ...over }, extraEndUsers: extra.users },
        plans: { [S1]: { phaseC, deploymentContext: { operator: OP } }, [S2]: { phaseC: pc, deploymentContext: { operator: extra.op ?? OP } } },
    });
    const W = { opMaxCostWei: 1234567890123457n, account: ACCT, lock, validationBufferBPS: 1000n };
    it('SP\'s vector plan is accepted and parsed', () => {
        const r = sdkLivePlanProblems(bundle(), W);
        expect(r.problems).toEqual([]);
        expect(r.plan).toMatchObject({ Xmax: 213879284769187972106n, maxCostPerOpWei: 1234567890123457n, operator: getAddress(OP), X: getAddress(X), xAmount: 1000n });
    });
    it.each([
        ['a cost cap other than config.opMaxCostWei', bundle({ maxCostPerOpWei: '1234567890123458' }), /config.opMaxCostWei .* != plan/],
        ['a buffer other than SP\'s 1000', bundle({ validationBufferBPS: 999 }), /validationBufferBPS 999/],
        ['an Xmax that is not the formula on its own fields', bundle({ Xmax: '213879284769187972107' }), /are not the formula on its own fields/],
        ['any plan\'s phaseC pricing differs from sdkLive', bundle({}, { ...phaseC, aPNTsPriceUSD: '1' }), /phaseC.aPNTsPriceUSD 1 != shared.sdkLive.aPNTsPriceUSD/],
        ['no sdkLive at all', { shared: {}, plans: {} }, /shared.sdkLive is missing/],
        ['a non-integer field', bundle({ priceCap: '3.5e11' }), /priceCap is not a non-negative integer/],
        ['no plans', { shared: { sdkLive, extraEndUsers: [{ address: ACCT, xAmount: '1' }] }, plans: {} }, /plans is empty/],
        ['this account is not an extraEndUser', bundle({}, phaseC, { users: [{ address: A(0x99), xAmount: '1' }] }), /is not in shared.extraEndUsers/],
        ['plans naming two operators', bundle({}, phaseC, { users: [{ address: ACCT, xAmount: '1' }], op: A(0x77) }), /do not name one operator/],
        ['plans naming two X tokens', bundle({}, { ...phaseC, addresses: { X: A(0x78) } }), /do not name one X token/],
    ])('refused: %s', (_n, b, why) => {
        expect(sdkLivePlanProblems(b, W).problems).toContainEqual(expect.stringMatching(why as RegExp));
    });
    const plan = sdkLivePlanProblems(bundle(), W).plan!;
    const now = { ethUsdPrice: 350000000000n, priceDecimals: 8n, aPNTsPriceUSD: 29999999999999999n, protocolFeeBPS: 137n, exchangeRate: 1333333333333333333n };
    it('at the plan\'s worst case the op locks exactly Xmax and passes; a cheaper price passes too', () => {
        expect(signTimeCostProblems(1234567890123457n, now, plan, lock)).toEqual([]);
        expect(signTimeCostProblems(1234567890123457n, { ...now, ethUsdPrice: 300000000000n }, plan, lock)).toEqual([]);
    });
    it.each([
        ['ETH/USD above priceCap', { ethUsdPrice: 350000000001n }, /not within the plan's headroom/],
        ['other price decimals', { priceDecimals: 18n }, /decimals 18 != plan priceDecimals 8/],
        ['aPNTsPriceUSD changed (either way)', { aPNTsPriceUSD: 30000000000000000n }, /aPNTsPriceUSD .* != plan/],
        ['protocolFeeBPS changed', { protocolFeeBPS: 138n }, /protocolFeeBPS 138 != plan 137/],
        ['exchangeRate changed', { exchangeRate: 1n }, /exchangeRate 1 != plan/],
    ])('refused at signing: %s', (_n, over, why) => {
        expect(signTimeCostProblems(1234567890123457n, { ...now, ...(over as any) }, plan, lock)).toContainEqual(expect.stringMatching(why as RegExp));
    });
    it('an op above the plan\'s per-op cost is refused even if the lock would fit', () => {
        expect(signTimeCostProblems(1234567890123458n, { ...now, ethUsdPrice: 1n }, plan, lock)).toContainEqual(expect.stringMatching(/op maxCost .* > plan maxCostPerOpWei/));
    });
    it('the headroom is applied in integers: with 500 bps, priceCap x 0.95 passes and one unit above it is refused', () => {
        const h = { ...plan, priceHeadroomBPS: 500n };
        const edge = (350000000000n * 9_500n) / 10_000n; // 332500000000, exact
        expect(signTimeCostProblems(1234567890123457n, { ...now, ethUsdPrice: edge }, h, lock)).toEqual([]);
        expect(signTimeCostProblems(1234567890123457n, { ...now, ethUsdPrice: edge + 1n }, h, lock)).toContainEqual(expect.stringMatching(/not within the plan's headroom/));
    });
    it('the lock is bounded at priceCap, not today\'s price: a cheap price today does not let an op through whose worst-case lock exceeds Xmax', () => {
        const tight = { ...plan, Xmax: plan.Xmax - 1n };
        expect(signTimeCostProblems(1234567890123457n, { ...now, ethUsdPrice: 100000000000n }, tight, lock)).toContainEqual(expect.stringMatching(/at the plan's priceCap, above the plan's Xmax_sdk/));
    });
    it.each([[undefined], ['500'], [true], [-1], [10000], [0.5]])('priceHeadroomBPS %j is refused, never defaulted', (h) => {
        expect(sdkLivePlanProblems(bundle({ priceHeadroomBPS: h }), W).problems).toContainEqual(expect.stringMatching(/priceHeadroomBPS must be a JSON integer 0..9999/));
    });
    it('the lock above Xmax is refused (a plan whose Xmax is below what the op would lock)', () => {
        const tight = { ...plan, Xmax: plan.Xmax - 1n };
        expect(signTimeCostProblems(1234567890123457n, now, tight, lock)).toContainEqual(expect.stringMatching(/would lock .* above the plan's Xmax_sdk/));
    });
    it('CostApprovals: an approved hash yields its maxCost once; an unapproved one never (fail closed)', () => {
        const c = new CostApprovals();
        const h = ('0x' + 'ab'.repeat(32)) as Hex;
        expect(c.take(h)).toBeUndefined();
        expect(c.take(undefined)).toBeUndefined();
        c.approve(h, 7n);
        expect(c.take(h.toUpperCase().replace('0X', '0x') as Hex)).toBe(7n);
        expect(c.take(h)).toBeUndefined();
    });
});

describe('guardedSignMessage: the key boundary, driven with a counting key (DSR + Codex cost-cap H2 / M)', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    const H = ('0x' + 'cd'.repeat(32)) as Hex;
    const arg = { message: { raw: H } };
    const setup = (over: any = {}) => {
        const order: string[] = [];
        let keyUses = 0, used = 0;
        const approvals = new CostApprovals();
        const io: any = {
            approvals, budget: () => ({ used, limit: 1 }), takeSlot: () => { used++; order.push('slot'); },
            beforeSign: async () => { order.push('recheck'); }, costAtKey: async (m: bigint) => { order.push(`cost ${m}`); }, fresh: async () => { order.push('fresh'); },
            sign: async () => { keyUses++; order.push('key'); return '0xsig' as Hex; }, ...over,
        };
        return { io, approvals, order, keys: () => keyUses };
    };
    it('approved: re-check, then the pricing check AT the key with the approved maxCost, then the key — in that order', async () => {
        const t = setup();
        t.approvals.approve(H, 123n);
        await expect(guardedSignMessage(arg, t.io)).resolves.toBe('0xsig');
        expect(t.order).toEqual(['slot', 'recheck', 'cost 123', 'fresh', 'key']);
    });
    it.each([
        ['nothing approved this hash (a path without the hook)', (t: any) => {}, /no cost check approved/],
        ['the pricing moved by the key\'s block (costAtKey refuses)', (t: any) => { t.approvals.approve(H, 1n); t.io.costAtKey = async () => { throw new Error('cachedPrice above priceCap'); }; }, /above priceCap/],
        ['no wiring re-check wired (the pricing block would be stale)', (t: any) => { t.approvals.approve(H, 1n); t.io.beforeSign = undefined; }, /no wiring re-check/],
        ['the budget is spent', (t: any) => { t.approvals.approve(H, 1n); t.io.budget = () => ({ used: 1, limit: 1 }); }, /budget exhausted/],
        ['the wiring re-check refuses', (t: any) => { t.approvals.approve(H, 1n); t.io.beforeSign = async () => { throw new Error('SP changed'); }; }, /SP changed/],
        ['the head moved too far since the check (fresh refuses)', (t: any) => { t.approvals.approve(H, 1n); t.io.fresh = async () => { throw new Error('the head moved to 12'); }; }, /head moved/],
        ['no head-freshness check wired', (t: any) => { t.approvals.approve(H, 1n); t.io.fresh = undefined; }, /no head-freshness check/],
    ])('refused, key never used: %s', async (_n, arrange, why) => {
        const t = setup();
        (arrange as any)(t);
        await expect(guardedSignMessage(arg, t.io)).rejects.toThrow(why as RegExp);
        expect(t.keys()).toBe(0);
    });
    it('the key gets a fresh { message: { raw } } built from the approved hash, not the caller\'s object', async () => {
        const t = setup();
        t.approvals.approve(H, 1n);
        let got: any;
        t.io.sign = async (x: any) => { got = x; return '0xsig' as Hex; };
        const callerArg: any = { message: { raw: H }, extra: 'ignored' };
        await guardedSignMessage(callerArg, t.io);
        expect(got).toEqual({ message: { raw: H } });
        expect(got).not.toBe(callerArg);
    });
    it('an approval is used once: a second signature of the same hash is refused', async () => {
        const t = setup({ budget: () => ({ used: 0, limit: 9 }) });
        t.approvals.approve(H, 1n);
        await guardedSignMessage(arg, t.io);
        await expect(guardedSignMessage(arg, t.io)).rejects.toThrow(/no cost check approved/);
        expect(t.keys()).toBe(1);
    });
});

describe('the live plan gate and the lossless plan parse (DSR / SP)', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    const P: any = { status: 'cleared', sdkCostCapCommit: 'a'.repeat(40), operator: getAddress(A(0x0e)), X: getAddress(A(0x0f)) };
    const W = { mode: 'live', operator: A(0x0e), token: A(0x0f), isAncestor: () => true };
    it('a cleared plan for this operator / X, whose commit this checkout contains, passes', () => {
        expect(livePlanGateProblems(P, W)).toEqual([]);
    });
    it.each([
        ['a provisional status', { ...P, status: 'provisional: live cells not cleared to run until the SDK pre-sign cost cap merges' }, W, /not "cleared"/],
        ['a status that only starts with cleared', { ...P, status: 'cleared?' }, W, /not "cleared"/],
        ['no sdkCostCapCommit', { ...P, sdkCostCapCommit: undefined }, W, /names no sdkCostCapCommit/],
        ['an upper-case commit', { ...P, sdkCostCapCommit: 'A'.repeat(40) }, W, /names no sdkCostCapCommit/],
        ['a commit this checkout lacks', P, { ...W, isAncestor: () => false }, /does not contain the plan's sdkCostCapCommit/],
        ['another operator', P, { ...W, operator: A(0x77) }, /operator .* is not this run's/],
        ['another X token', P, { ...W, token: A(0x78) }, /X token .* is not the operator's xPNTs/],
    ])('refused: %s', (_n, plan, w, why) => {
        expect(livePlanGateProblems(plan as any, w as any)).toContainEqual(expect.stringMatching(why as RegExp));
    });
    it('fork mode skips only the live clearance (status / commit), not operator / X', () => {
        expect(livePlanGateProblems({ ...P, status: 'provisional' }, { ...W, mode: 'fork', isAncestor: () => false })).toEqual([]);
        expect(livePlanGateProblems(P, { ...W, mode: 'fork', operator: A(0x77) })).toContainEqual(expect.stringMatching(/operator/));
    });
    // SP's second vector (sdk-cost-vector.json unsafeIntegerVector): maxCost = 2^53 + 1, a set low bit above the safe range.
    const V2 = '{"maxCostPerOpWei":9007199254740993,"a0":1050839913053115885028,"Amax":1170320411167255161156,"Xmax":1560427214889673547818}';
    it('the plan parser reads 2^53 + 1 and the large results digit for digit as BigInt; the lock formula reproduces them', () => {
        const v = parsePlanJson(V2);
        expect(v.maxCostPerOpWei).toBe(9007199254740993n);
        expect(v.a0.toString()).toBe('1050839913053115885028');
        expect(v.Amax.toString()).toBe('1170320411167255161156');
        expect(v.Xmax.toString()).toBe('1560427214889673547818');
        expect(superPaymasterLock({ maxCost: v.maxCostPerOpWei, ethUsdPrice: 350000000000n, priceDecimals: 8n, aPNTsPriceUSD: 29999999999999999n, protocolFeeBPS: 137n, exchangeRate: 1333333333333333333n }))
            .toEqual({ a0: v.a0, Amax: v.Amax, X: v.Xmax });
    });
    it('control: a plain JSON.parse loses it (so the test above guards the failure)', () => {
        expect(BigInt(JSON.parse(V2).maxCostPerOpWei)).not.toBe(9007199254740993n);
    });
    it('a plan field that arrives as an unsafe number (a lossy parse) is refused', () => {
        const lossy = JSON.parse(V2);
        const r = sdkLivePlanProblems({ shared: { sdkLive: { ...lossy } }, plans: {} }, { opMaxCostWei: 1n, account: A(1), lock: superPaymasterLock, validationBufferBPS: 1000n });
        expect(r.problems).toContainEqual(expect.stringMatching(/arrived as an unsafe number .* \(a lossy parse\)/));
    });
    it('a whole bundle emitted with JSON-number integers (as SP emits it) parses losslessly and passes the plan check', () => {
        const acct = A(0xacc), op = A(0x0e), x = A(0x0f), S = A(0x51);
        const text = `{"plans":{"${S}":{"deploymentContext":{"operator":"${op}"},"phaseC":{"addresses":{"X":"${x}"},"aPNTsPriceUSD":29999999999999999,"exchangeRate":1333333333333333333,"priceCap":350000000000,"priceDecimals":8,"protocolFeeBPS":137}}},"shared":{"extraEndUsers":[{"address":"${acct}","xAmount":12345678901234567890}],"sdkLive":{"Amax":1170320411167255161156,"Xmax":1560427214889673547818,"a0":1050839913053115885028,"aPNTsPriceUSD":29999999999999999,"exchangeRate":1333333333333333333,"maxCostPerOpWei":9007199254740993,"priceCap":350000000000,"priceDecimals":8,"protocolFeeBPS":137,"sdkCostCapCommit":"${'a'.repeat(40)}","status":"cleared","validationBufferBPS":1000,"priceHeadroomBPS":500}}}`;
        const r = sdkLivePlanProblems(parsePlanJson(text), { opMaxCostWei: 9007199254740993n, account: acct, lock: superPaymasterLock, validationBufferBPS: 1000n });
        expect(r.problems).toEqual([]);
        expect(r.plan).toMatchObject({ Xmax: 1560427214889673547818n, xAmount: 12345678901234567890n, status: 'cleared' });
        expect(maxCostDigitsProblem(text, r.plan!.maxCostPerOpWei)).toBeUndefined();
        // The same text through a plain JSON.parse is refused (lossy).
        expect(sdkLivePlanProblems(JSON.parse(text), { opMaxCostWei: 9007199254740993n, account: acct, lock: superPaymasterLock, validationBufferBPS: 1000n }).problems.length).toBeGreaterThan(0);
    });
    const wrap = (tok: string, extra = '') => `{"shared":{"sdkLive":{"maxCostPerOpWei":${tok}}}${extra}}`;
    it('the runner\'s cap must be the source token AT shared.sdkLive.maxCostPerOpWei (not anywhere in the bytes)', () => {
        expect(maxCostDigitsProblem(wrap('9007199254740993'), 9007199254740993n)).toBeUndefined();
        expect(maxCostDigitsProblem(wrap('"9007199254740993"'), 9007199254740993n)).toBeUndefined();
        expect(maxCostDigitsProblem(wrap('9007199254740992'), 9007199254740993n)).toMatch(/are not 9007199254740993/);
        // Codex r2: the real cap is a fraction / exponent while an unrelated field carries the digits.
        expect(maxCostDigitsProblem(wrap('1.00000000000000001', ',"other":{"maxCostPerOpWei":1}'), 1n)).toMatch(/are not 1/);
        expect(maxCostDigitsProblem(wrap('1e0', ',"other":{"maxCostPerOpWei":1}'), 1n)).toMatch(/are not 1/);
        expect(maxCostDigitsProblem('{"other":{"maxCostPerOpWei":5}}', 5n)).toMatch(/\(absent\)/);
        // Codex r3: a flattened key that spells the path must not stand in for the nested value (and vice versa).
        expect(maxCostDigitsProblem('{"shared":{"sdkLive":{"maxCostPerOpWei":"1\\u0030"}},"shared.sdkLive.maxCostPerOpWei":10}', 10n)).toMatch(/are not 10/);
        expect(maxCostDigitsProblem('{"shared":{"sdkLive":{"maxCostPerOpWei":10}},"shared.sdkLive.maxCostPerOpWei":11}', 10n)).toBeUndefined();
    });
    it.each([
        ['an exponent', '{"a":1e3}', /exponent form 1e3/],
        ['a large exponent', '{"a":1e16}', /exponent form/],
        ['an underflowing exponent', '{"a":-1e-400}', /exponent form/],
        ['negative zero', '{"a":-0}', /negative zero/],
        ['a duplicate key', '{"n":1,"n":2}', /duplicate key\(s\) \["n"\]/],
        ['a nested duplicate key', '{"shared":{"sdkLive":{"status":"cleared","status":"x"}}}', /duplicate key\(s\) \["shared","sdkLive","status"\]/],
        ['nesting deeper than the stated limit', '['.repeat(300) + ']'.repeat(300), /nesting deeper than 256/],
    ])('parsePlanJson refuses %s', (_n, text, why) => {
        expect(() => parsePlanJson(text as string)).toThrow(why as RegExp);
    });
    it('a number token is read whole, however long (no 4096-character cut)', () => {
        const big = '9'.repeat(5000);
        expect(parsePlanJson(`{"a":${big}}`).a.toString()).toBe(big);
    });
    it('a phaseC value wrapped in an array (["123"]) no longer matches by String() coercion', () => {
        const live = { maxCostPerOpWei: '1234567890123457', priceCap: '350000000000', priceDecimals: 8, aPNTsPriceUSD: '29999999999999999', protocolFeeBPS: 137, validationBufferBPS: 1000, exchangeRate: '1333333333333333333', a0: '144032920514403321468', Amax: '160409463576890979119', Xmax: '213879284769187972106', status: 'cleared', priceHeadroomBPS: 0 };
        const pc = { priceCap: ['350000000000'], priceDecimals: 8, aPNTsPriceUSD: '29999999999999999', protocolFeeBPS: 137, exchangeRate: '1333333333333333333', addresses: { X: A(0x0f) } };
        const r = sdkLivePlanProblems({ shared: { sdkLive: live, extraEndUsers: [{ address: A(0xacc), xAmount: '1' }] }, plans: { [A(0x51)]: { phaseC: pc, deploymentContext: { operator: A(0x0e) } } } },
            { opMaxCostWei: 1234567890123457n, account: A(0xacc), lock: superPaymasterLock, validationBufferBPS: 1000n });
        expect(r.problems).toContainEqual(expect.stringMatching(/phaseC.priceCap 350000000000 != shared.sdkLive.priceCap/));
    });
    it('a fraction becomes a non-integer marker (never a rounded integer); the plan check refuses it in an integer field', () => {
        const v = parsePlanJson('{"a":1.00000000000000001,"b":-9007199254740993,"c":0.5}');
        expect(v.a).toEqual({ nonIntegerNumber: '1.00000000000000001' });
        expect(v.b).toBe(-9007199254740993n);
        expect(v.c).toEqual({ nonIntegerNumber: '0.5' });
        const r = sdkLivePlanProblems({ shared: { sdkLive: { ...v, maxCostPerOpWei: v.a } }, plans: {} }, { opMaxCostWei: 1n, account: A(1), lock: superPaymasterLock, validationBufferBPS: 1000n });
        expect(r.problems).toContainEqual(expect.stringMatching(/maxCostPerOpWei is not a non-negative integer/));
    });
});

describe('the cost path, behaviourally (Daybreak #470 L3)', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('headFreshnessProblem: the head may be at most MAX_BLOCKS_SINCE_CHECK (1) past the check block', () => {
        expect(MAX_BLOCKS_SINCE_CHECK).toBe(1n);
        expect(headFreshnessProblem(100n, 100n)).toBeUndefined();
        expect(headFreshnessProblem(100n, 101n)).toBeUndefined();
        expect(headFreshnessProblem(100n, 102n)).toMatch(/more than 1 block\(s\) past the check block 100/);
    });
    it('readPricingAt pins all four reads to the one block; a failed read fails the check', async () => {
        const calls: any[] = [];
        const client = { readContract: async (a: any) => { calls.push(a); return a.functionName === 'cachedPrice' ? [350000000000n, 0n, 0n, 8] : a.functionName === 'exchangeRate' ? 10n ** 18n : 137n; } };
        const r = await readPricingAt(client, { sp: A(1), token: A(2), spAbi: [], tokenAbi: [], blockNumber: 77n });
        expect(calls.map((c) => [c.functionName, c.blockNumber])).toEqual([['cachedPrice', 77n], ['aPNTsPriceUSD', 77n], ['protocolFeeBPS', 77n], ['exchangeRate', 77n]]);
        expect(r).toMatchObject({ ethUsdPrice: 350000000000n, priceDecimals: 8n, exchangeRate: 10n ** 18n });
        await expect(readPricingAt({ readContract: async () => { throw new Error('rpc down'); } }, { sp: A(1), token: A(2), spAbi: [], tokenAbi: [], blockNumber: 1n })).rejects.toThrow('rpc down');
    });
    it('a zero exchange rate (or any rate other than the plan\'s) is refused at the key', () => {
        const plan: any = { maxCostPerOpWei: 10n, priceCap: 10n, priceDecimals: 8n, aPNTsPriceUSD: 1n, protocolFeeBPS: 0n, validationBufferBPS: 1000n, exchangeRate: 10n ** 18n, Xmax: 10n ** 30n, priceHeadroomBPS: 0n };
        expect(signTimeCostProblems(1n, { ethUsdPrice: 1n, priceDecimals: 8n, aPNTsPriceUSD: 1n, protocolFeeBPS: 0n, exchangeRate: 0n }, plan, superPaymasterLock)).toContainEqual(expect.stringMatching(/exchangeRate 0 != plan/));
    });
    it('readPlanFile: the sha256 is over the raw bytes; a mismatch and invalid UTF-8 are refused', () => {
        const bytes = new TextEncoder().encode('{"a":1}');
        const sha = createHash('sha256').update(bytes).digest('hex');
        expect(readPlanFile('p.json', sha, () => bytes)).toEqual({ raw: '{"a":1}' });
        expect(readPlanFile('p.json', '0'.repeat(64), () => bytes)).toEqual({ problem: expect.stringMatching(/sha256 .* != the given/) });
        const bad = new Uint8Array([0x7b, 0xff, 0x7d]);
        expect(readPlanFile('p.json', createHash('sha256').update(bad).digest('hex'), () => bad)).toEqual({ problem: expect.stringMatching(/not valid UTF-8/) });
    });
    it('checkoutContains with real git: an ancestor is contained; no git metadata or a shallow clone without it is not', () => {
        const git = (a: string[], cwd: string) => spawnSync('git', a, { cwd, encoding: 'utf8' }).status ?? 1;
        const out = (a: string[], cwd: string) => spawnSync('git', a, { cwd, encoding: 'utf8' }).stdout.trim();
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anc-'));
        const env = ['-c', 'user.email=t@t', '-c', 'user.name=t'];
        git(['init', '-q'], dir);
        fs.writeFileSync(path.join(dir, 'a'), '1'); git(['add', 'a'], dir); git([...env, 'commit', '-qm', 'one'], dir);
        const first = out(['rev-parse', 'HEAD'], dir);
        fs.writeFileSync(path.join(dir, 'a'), '2'); git(['add', 'a'], dir); git([...env, 'commit', '-qm', 'two'], dir);
        expect(checkoutContains(dir, first, git)).toBe(true);
        expect(checkoutContains(dir, 'f'.repeat(40), git)).toBe(false);
        const shallow = fs.mkdtempSync(path.join(os.tmpdir(), 'shallow-'));
        git(['clone', '-q', '--depth', '1', `file://${dir}`, shallow], os.tmpdir());
        expect(checkoutContains(shallow, first, git)).toBe(false);
        const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'nogit-'));
        expect(checkoutContains(bare, first, git)).toBe(false);
    });
    it('guardedSignMessage refuses before the key when no cost check approved the hash (a path that skipped the hook)', async () => {
        let keys = 0;
        const io: any = { approvals: new CostApprovals(), budget: () => ({ used: 0, limit: 1 }), takeSlot: () => {}, beforeSign: async () => {}, costAtKey: async () => {}, fresh: async () => {}, sign: async () => { keys++; return '0x' as Hex; } };
        await expect(guardedSignMessage({ message: { raw: ('0x' + 'ee'.repeat(32)) as Hex } }, io)).rejects.toThrow(/no cost check approved/);
        expect(keys).toBe(0);
    });
});
