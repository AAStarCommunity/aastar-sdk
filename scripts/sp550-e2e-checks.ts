/**
 * Per-op assertions for scripts/sp550-live-e2e.ts that do not need a chain: what the SDK sent to the
 * bundler, and whether an op's flags agree with what the token did on-chain.
 *
 * These turn three behaviours of PaymasterClient.submitGaslessUserOperation into checks instead of
 * printed numbers:
 *   - estimation runs on a placeholder signature, before the user's signer is asked for anything
 *     (the request carries PaymasterClient.dummySignature() and the signer count is still 0);
 *   - one signature per op: exactly one eth_sendUserOperation, carrying a real signature, and the
 *     signer asked exactly once. A fee/PVG retry re-signs, so a retried op fails this on purpose;
 *   - SP_RENEW is chosen by the SDK per op: an op that carries it must renew inline on-chain
 *     (AllowanceRenewed(bySP=true), autoRenewUsed +1), and an op without it must not renew at all.
 */
import { type Abi, type Address, type Hex, decodeEventLog, decodeFunctionData, encodeAbiParameters, encodeFunctionData, getAddress, keccak256, size, slice } from 'viem';
import { SUPER_PAYMASTER_FLAGS, SUPER_PAYMASTER_PMD_OFFSETS } from '../packages/core/src/superPaymasterData.js';

/** One JSON-RPC request the SDK made to the bundler, as the tap saw it. */
export type BundlerCall = {
    method: string;
    /** userOp.signature, for eth_estimateUserOperationGas / eth_sendUserOperation. */
    signature?: Hex;
    /** The SP flags byte from the request's paymasterData (0 when the 124-byte layout omits it). */
    flags?: number;
    /** How many times the user's signer had been asked when this request left. */
    signsBefore: number;
    /** The op's sender and nonce as sent (eth_sendUserOperation / estimate requests). */
    sender?: string;
    nonce?: bigint;
    /** The op's gas fields as sent (eth_sendUserOperation / estimate requests), so a rejected op is still recorded. */
    gas?: Record<'verificationGasLimit' | 'callGasLimit' | 'preVerificationGas' | 'paymasterVerificationGasLimit' | 'paymasterPostOpGasLimit' | 'maxFeePerGas' | 'maxPriorityFeePerGas', bigint | undefined>;
};

const USER_OP_METHODS = new Set(['eth_estimateUserOperationGas', 'eth_sendUserOperation']);
/** Index of the flags byte inside the UNPACKED paymasterData (the v0.7 RPC form drops the first 52 bytes). */
const FLAGS_IN_PAYMASTER_DATA = SUPER_PAYMASTER_PMD_OFFSETS.FLAGS - SUPER_PAYMASTER_PMD_OFFSETS.OPERATOR;

/** The flags byte of an RPC-form userOp's `paymasterData`; undefined if it is not a SuperPaymaster layout. */
export function flagsFromPaymasterData(paymasterData: unknown): number | undefined {
    if (typeof paymasterData !== 'string' || !/^0x([0-9a-fA-F]{2})*$/.test(paymasterData)) return undefined;
    const bytes = (paymasterData.length - 2) / 2;
    if (bytes < FLAGS_IN_PAYMASTER_DATA) return undefined;
    if (bytes === FLAGS_IN_PAYMASTER_DATA) return 0;
    return parseInt(paymasterData.slice(2 + FLAGS_IN_PAYMASTER_DATA * 2, 4 + FLAGS_IN_PAYMASTER_DATA * 2), 16);
}

/**
 * Wrap globalThis.fetch so every request to `bundlerUrl` is recorded into `sink` before it is sent.
 * Returns the function that restores the original fetch.
 */
/**
 * The client a bundler's web3_clientVersion reply names, "not reported: …" for method-not-found
 * (-32601, the method is optional), or undefined for anything else: a non-JSON-RPC body, a non-string
 * result, or any other JSON-RPC error (auth, rate limit, internal) — not a usable gas source.
 */
export function gasSourceClient(reply: any): string | undefined {
    if (reply?.jsonrpc !== '2.0') return undefined;
    // "error": null beside a result is off-spec but seen; it is no error.
    if (reply.error !== undefined && reply.error !== null) return reply.error?.code === -32601 ? 'not reported: no web3_clientVersion' : undefined;
    return typeof reply.result === 'string' && reply.result !== '' ? reply.result : undefined;
}

export function tapBundler(bundlerUrl: string, signsNow: () => number, sink: BundlerCall[], opts: { timeoutMs?: number; onSend?: (c: BundlerCall) => void } = {}): () => void {
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: any, init?: any) => {
        const url = typeof input === 'string' ? input : input?.url ?? String(input);
        if (url === bundlerUrl && typeof init?.body === 'string') {
            try {
                const body = JSON.parse(init.body);
                for (const req of Array.isArray(body) ? body : [body]) {
                    const call: BundlerCall = { method: String(req?.method), signsBefore: signsNow() };
                    if (USER_OP_METHODS.has(call.method)) {
                        const op = req.params?.[0] ?? {};
                        call.signature = op.signature;
                        if (typeof op.sender === 'string') call.sender = op.sender;
                        try { if (op.nonce !== undefined) call.nonce = BigInt(op.nonce); } catch { /* malformed: left out */ }
                        call.flags = flagsFromPaymasterData(op.paymasterData);
                        const big = (v: unknown) => { try { return v === undefined || v === null ? undefined : BigInt(v as any); } catch { return undefined; } };
                        call.gas = {
                            verificationGasLimit: big(op.verificationGasLimit), callGasLimit: big(op.callGasLimit), preVerificationGas: big(op.preVerificationGas),
                            paymasterVerificationGasLimit: big(op.paymasterVerificationGasLimit), paymasterPostOpGasLimit: big(op.paymasterPostOpGasLimit),
                            maxFeePerGas: big(op.maxFeePerGas), maxPriorityFeePerGas: big(op.maxPriorityFeePerGas),
                        };
                    }
                    sink.push(call);
                    opts.onSend?.(call);
                }
            } catch { sink.push({ method: '<unparsable body>', signsBefore: signsNow() }); }
            // A bundler that never answers cannot hold the run (an AbortError fails the cell, recorded as OUTCOME UNKNOWN).
            if (opts.timeoutMs && !init.signal) return original(input, { ...init, signal: AbortSignal.timeout(opts.timeoutMs) });
        }
        return original(input, init);
    }) as typeof fetch;
    return () => { globalThis.fetch = original; };
}

/** Placeholder-signature estimation and one signature per op, from one op's recorded bundler calls. */
export function opSigningProblems(calls: BundlerCall[], signsTotal: number, dummySignature: Hex, opts: { expectEstimate?: boolean } = {}): string[] {
    const problems: string[] = [];
    const estimates = calls.filter((c) => c.method === 'eth_estimateUserOperationGas');
    const sends = calls.filter((c) => c.method === 'eth_sendUserOperation');
    // frozenGas: the SDK does not estimate at all, so an estimate is a problem, not a requirement.
    if (opts.expectEstimate === false) { if (estimates.length) problems.push(`${estimates.length} eth_estimateUserOperationGas call(s) with frozenGas; frozen limits are not estimated`); }
    else if (estimates.length === 0) problems.push('no eth_estimateUserOperationGas call: placeholder-signature estimation was not exercised');
    estimates.forEach((e, i) => {
        if (e.signature?.toLowerCase() !== dummySignature.toLowerCase()) problems.push(`estimate #${i + 1} carried a signature that is not the placeholder`);
        if (e.signsBefore !== 0) problems.push(`estimate #${i + 1} left after the signer had been asked ${e.signsBefore} time(s); estimation must not ask the signer`);
    });
    if (sends.length !== 1) problems.push(`${sends.length} eth_sendUserOperation attempt(s); one signature per op means exactly 1`);
    for (const s of sends) {
        if (!s.signature || s.signature === '0x' || s.signature.toLowerCase() === dummySignature.toLowerCase()) problems.push('eth_sendUserOperation carried the placeholder or no signature');
        if (s.signsBefore !== 1) problems.push(`eth_sendUserOperation left after ${s.signsBefore} signature(s), expected 1`);
    }
    if (signsTotal !== 1) problems.push(`the user's signer was asked ${signsTotal} time(s) for this op, expected 1`);
    return problems;
}

/** What one op did, as read back from the chain. */
export type OpOutcome = {
    /** Flags byte from the bundle transaction's handleOps calldata. */
    onChainFlags: number;
    /** Flags byte the SDK put in its eth_sendUserOperation request. */
    sentFlags: number | undefined;
    renewedInline: boolean;
    renewUsedBefore: bigint;
    renewUsedAfter: bigint;
};

/** SP_RENEW chosen by the SDK must match what happened on-chain, in both directions. */
export function renewalConsistencyProblems(o: OpOutcome): string[] {
    const problems: string[] = [];
    if (o.sentFlags === undefined) problems.push('the eth_sendUserOperation request had no readable SuperPaymaster flags byte');
    else if (o.sentFlags !== o.onChainFlags) problems.push(`flags sent 0x${o.sentFlags.toString(16)} but the bundled op carried 0x${o.onChainFlags.toString(16)}`);
    const renew = (o.onChainFlags & SUPER_PAYMASTER_FLAGS.SP_RENEW) !== 0;
    if (renew) {
        if (!o.renewedInline) problems.push('carried SP_RENEW but no AllowanceRenewed(user, SP, bySP=true) in the receipt');
        if (o.renewUsedAfter !== o.renewUsedBefore + 1n) problems.push(`carried SP_RENEW but autoRenewUsed went ${o.renewUsedBefore} -> ${o.renewUsedAfter}, expected +1`);
    } else {
        if (o.renewedInline) problems.push('no SP_RENEW, yet the receipt has an AllowanceRenewed(bySP=true)');
        if (o.renewUsedAfter !== o.renewUsedBefore) problems.push(`no SP_RENEW, yet autoRenewUsed went ${o.renewUsedBefore} -> ${o.renewUsedAfter}`);
    }
    return problems;
}

/**
 * Whether a receipt log is the token's `AllowanceRenewed(user, spender, bySP)` for this user and SP
 * with `bySP == true` (the renewal SP relayed during validation). The field is `bySP`; reading a
 * name the ABI does not have returns undefined, which would make every renewal look absent.
 */
export function isSpRelayedRenewal(log: { address: string; data: Hex; topics: Hex[] }, abi: Abi, w: { token: Address; user: Address; sp: Address }): boolean {
    if (getAddress(log.address) !== getAddress(w.token)) return false;
    try {
        const ev = decodeEventLog({ abi, data: log.data, topics: log.topics as [Hex, ...Hex[]] }) as any;
        return ev.eventName === 'AllowanceRenewed' && getAddress(ev.args.user) === getAddress(w.user)
            && getAddress(ev.args.spender) === getAddress(w.sp) && ev.args.bySP === true;
    } catch { return false; }
}

/** What C12's one handleOps transaction must be, fixed before the user's key signs it (Daybreak #468 M2). */
export type C12TxExpectation = {
    chainId: number;
    entryPoint: Address;
    /** The userOpHash the user's key signed for this op (captured at signMessage). */
    userOpHash: Hex;
    /** The signature bytes signMessage returned for it: op.signature must be exactly these (the hash omits them). */
    userOpSignature: Hex;
    /** The EOA's pending nonce snapshotted before C12: the transaction must use it (no replacing another pending tx). */
    txNonce: number;
    sender: Address;
    nonce: bigint;
    paymaster: Address;
    beneficiary: Address;
    /** Explicit caps from the run config: together they bound what the EOA can spend (gas x maxFeePerGas). */
    maxGas: bigint;
    maxFeePerGas: bigint;
};

const HANDLE_OPS_ABI = [{
    type: 'function', name: 'handleOps', stateMutability: 'nonpayable', outputs: [],
    inputs: [{ type: 'tuple[]', name: 'ops', components: [
        { name: 'sender', type: 'address' }, { name: 'nonce', type: 'uint256' }, { name: 'initCode', type: 'bytes' },
        { name: 'callData', type: 'bytes' }, { name: 'accountGasLimits', type: 'bytes32' }, { name: 'preVerificationGas', type: 'uint256' },
        { name: 'gasFees', type: 'bytes32' }, { name: 'paymasterAndData', type: 'bytes' }, { name: 'signature', type: 'bytes' },
    ] }, { name: 'beneficiary', type: 'address' }],
}] as const;

/** EntryPoint v0.7 getUserOpHash, computed off-chain from the packed op. */
export function packedUserOpHashV07(op: { sender: Address; nonce: bigint; initCode: Hex; callData: Hex; accountGasLimits: Hex; preVerificationGas: bigint; gasFees: Hex; paymasterAndData: Hex }, entryPoint: Address, chainId: number): Hex {
    const inner = keccak256(encodeAbiParameters(
        [{ type: 'address' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'bytes32' }],
        [op.sender, op.nonce, keccak256(op.initCode), keccak256(op.callData), op.accountGasLimits, op.preVerificationGas, op.gasFees, keccak256(op.paymasterAndData)],
    ));
    return keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }], [inner, entryPoint, BigInt(chainId)]));
}

/**
 * Why the transaction the user's key is about to sign is not C12's expected handleOps: empty when it is. Checked on
 * the request handed to signTransaction, so nothing is signed when any field is off: the chain, the EntryPoint as
 * destination, no value, calldata that decodes to handleOps with exactly the one op whose hash was signed (sender,
 * nonce, this paymaster) and the expected beneficiary, and gas / fee within the explicit caps.
 */
export function c12TransactionProblems(tx: any, w: C12TxExpectation): string[] {
    const p: string[] = [];
    if (tx === null || typeof tx !== 'object') return ['not a transaction request'];
    // Strict field table (Daybreak #468 M2): every key must be known. viem itself hands the signer its own bookkeeping
    // keys (account, chain, from, nonceManager) and some forbidden fields as undefined; each is held to the one value
    // C12 allows. Anything else — input, an unknown field — is refused.
    const SERIALIZED = ['type', 'chainId', 'to', 'value', 'data', 'gas', 'maxFeePerGas', 'maxPriorityFeePerGas', 'nonce', 'accessList'];
    const MUST_BE_UNSET = ['gasPrice', 'blobs', 'blobVersionedHashes', 'maxFeePerBlobGas', 'sidecars', 'kzg', 'authorizationList', 'nonceManager'];
    const BOOKKEEPING = ['account', 'chain', 'from'];
    const unknown = Object.keys(tx).filter((k) => ![...SERIALIZED, ...MUST_BE_UNSET, ...BOOKKEEPING].includes(k));
    if (unknown.length) p.push(`unrecognised transaction field(s) ${unknown.join(', ')}`);
    for (const k of MUST_BE_UNSET) if (tx[k] !== undefined) p.push(`${k} is not part of C12's transaction`);
    const addrOf = (v: any) => (typeof v === 'string' ? v : typeof v?.address === 'string' ? v.address : undefined);
    // `from` / `account` are held to the EOA, not refused: viem's own writeContract hands the signer both (refusing them
    // would refuse every real request; DSR accepted this on #468).
    for (const k of ['from', 'account'] as const) {
        if (tx[k] !== undefined && (addrOf(tx[k]) === undefined || getAddress(addrOf(tx[k])!) !== getAddress(w.beneficiary))) p.push(`${k} is not the user's EOA ${w.beneficiary}`);
    }
    if (tx.chain !== undefined && Number(tx.chain?.id) !== w.chainId) p.push(`chain ${tx.chain?.id} is not ${w.chainId}`);
    // EIP-1559 only: a legacy gasPrice or blob fees would be charged outside maxGas x maxFeePerGas (Codex 468-d1).
    if (tx.type !== 'eip1559') p.push(`transaction type ${JSON.stringify(tx.type)} is not eip1559`);
    if (tx.nonce === undefined || Number(tx.nonce) !== w.txNonce) p.push(`nonce ${tx.nonce} is not the EOA's pending nonce ${w.txNonce}`);
    if (tx.accessList !== undefined && !(Array.isArray(tx.accessList) && tx.accessList.length === 0)) p.push('a non-empty accessList is not part of C12\'s transaction');
    if (tx.chainId === undefined || Number(tx.chainId) !== w.chainId) p.push(`chainId ${tx.chainId} is not ${w.chainId}`);
    if (typeof tx.to !== 'string' || getAddress(tx.to) !== getAddress(w.entryPoint)) p.push(`to ${tx.to} is not the EntryPoint ${w.entryPoint}`);
    if (tx.value !== undefined && BigInt(tx.value) !== 0n) p.push(`value ${tx.value} is not 0`);
    if (tx.gas === undefined || BigInt(tx.gas) > w.maxGas) p.push(`gas ${tx.gas} is not within the cap ${w.maxGas}`);
    const fee = tx.maxFeePerGas;
    if (fee === undefined || BigInt(fee) > w.maxFeePerGas) p.push(`maxFeePerGas ${fee} is not within the cap ${w.maxFeePerGas}`);
    if (tx.maxPriorityFeePerGas === undefined || (fee !== undefined && BigInt(tx.maxPriorityFeePerGas) > BigInt(fee))) p.push('maxPriorityFeePerGas missing or above maxFeePerGas');
    let decoded: any;
    try { decoded = decodeFunctionData({ abi: HANDLE_OPS_ABI, data: tx.data }); } catch { return [...p, 'calldata does not decode as handleOps(PackedUserOperation[], address)']; }
    if (decoded.functionName !== 'handleOps') return [...p, `calldata is ${decoded.functionName}, not handleOps`];
    // Re-encoding must give the same bytes: no trailing data after the call.
    if (encodeFunctionData({ abi: HANDLE_OPS_ABI, functionName: 'handleOps', args: decoded.args }).toLowerCase() !== String(tx.data).toLowerCase()) p.push('calldata is not the canonical handleOps encoding');
    const [ops, beneficiary] = decoded.args as [any[], Address];
    if (ops.length !== 1) return [...p, `handleOps carries ${ops.length} ops, not exactly one`];
    const op = ops[0];
    if (getAddress(beneficiary) !== getAddress(w.beneficiary)) p.push(`beneficiary ${beneficiary} is not ${w.beneficiary}`);
    if (getAddress(op.sender) !== getAddress(w.sender)) p.push(`op sender ${op.sender} is not ${w.sender}`);
    if (BigInt(op.nonce) !== w.nonce) p.push(`op nonce ${op.nonce} is not ${w.nonce}`);
    if (size(op.paymasterAndData) < 20 || getAddress(slice(op.paymasterAndData, 0, 20)) !== getAddress(w.paymaster)) p.push(`op paymaster is not ${w.paymaster}`);
    if (packedUserOpHashV07(op, w.entryPoint, w.chainId).toLowerCase() !== w.userOpHash.toLowerCase()) p.push('the op in the calldata is not the op whose hash was signed');
    if (String(op.signature).toLowerCase() !== String(w.userOpSignature).toLowerCase()) p.push('the op\'s signature is not the bytes the user\'s key returned');
    return p;
}

/**
 * L1 (Daybreak): no configured RPC / bundler URL reaches stdout, stderr or the log the caller tees them into. Every
 * console line is scrubbed: each URL is replaced by its scheme and host (a credential lives in the path or query).
 * Installed once the config is read; it also covers viem error texts that quote the request URL.
 */
export function redactUrls(text: string, urls: readonly string[]): string {
    // Every form of every URL, longest first: a URL that is a prefix of another must not leave the other's tail behind.
    const forms: [string, string][] = [];
    for (const u of urls) {
        let safe: string, x: URL;
        try { x = new URL(u); safe = `${x.protocol}//${x.host}/…`; } catch { continue; }
        // As configured, and as a URL parser prints it back (lower-case host, default port dropped), each with and without
        // a trailing slash; and the secret-bearing part on its own (userinfo, path, query), for text that quotes only it.
        const secret = `${x.username}${x.password ? ':' + x.password : ''}${x.pathname === '/' ? '' : x.pathname}${x.search}`;
        for (const f of new Set([u, u.replace(/\/+$/, ''), x.href, x.href.replace(/\/+$/, '')])) if (f.length > 0) forms.push([f, safe]);
        if (secret.length >= 8) forms.push([secret, '/…']);
    }
    forms.sort((a, b) => b[0].length - a[0].length);
    let out = text;
    for (const [f, safe] of forms) out = out.split(f).join(safe);
    return out;
}

/** The signer state C12's transaction is checked against (sp550-live-e2e.ts owns it; mutable). */
export type C12SignState = {
    allowTx: boolean;
    expect?: Omit<C12TxExpectation, 'userOpHash' | 'userOpSignature'>;
    lastSignedHash?: Hex;
    lastSignature?: Hex;
    signs: number;
    txSigns: number;
    signBudget: number;
    beforeSign?: () => Promise<void>;
    /** The EOA's pending nonce now (Daybreak #468 re-run): re-read at the boundary, it must still equal the snapshot. */
    txNonceNow?: () => Promise<number>;
};

/**
 * The user's signTransaction, guarded (Daybreak #468 M2): refuses unless C12 armed it, at most one transaction, within
 * the signature budget (op + transaction), after an op was signed, and only for the expected handleOps. `sign` (the
 * key) is called only after every check passed.
 */
export async function signC12Transaction<T>(sign: () => Promise<T>, tx: any, st: C12SignState): Promise<T> {
    if (!st.allowTx || !st.expect) throw new Error('the user key signs no transaction outside C12 (a direct handleOps send would pay from the author\'s ETH); refused');
    if (st.txSigns >= 1) throw new Error('C12 signs exactly one transaction; a second one is refused');
    if (st.signs + st.txSigns >= st.signBudget) throw new Error(`signature budget exhausted (${st.signBudget}); refused`);
    if (!st.lastSignedHash || !st.lastSignature) throw new Error('C12: no UserOperation was signed before the transaction; refused');
    const bad = c12TransactionProblems(tx, { ...st.expect, userOpHash: st.lastSignedHash, userOpSignature: st.lastSignature });
    if (bad.length) throw new Error(`C12 transaction refused before signing: ${bad.join('; ')}`);
    // The slot is taken synchronously, before the first await: a concurrent call sees it used (Codex 468-d2). A refusal
    // by beforeSign keeps it taken; nothing was signed and the cell fails.
    st.txSigns++;
    if (st.beforeSign) await st.beforeSign();
    // Last, right before the key: another honest transaction from this EOA during C12's estimate would have taken the
    // snapshotted nonce; signing it again would replace that pending transaction.
    // Required, not optional (DSR): an armed C12 without a nonce re-read refuses instead of silently skipping it.
    if (!st.txNonceNow) throw new Error('C12: no pending-nonce re-read is wired (txNonceNow); refused before signing');
    const now = await st.txNonceNow();
    if (now !== st.expect.txNonce) throw new Error(`C12: the EOA's pending nonce moved ${st.expect.txNonce} -> ${now} since the snapshot; refused before signing`);
    return sign();
}

/** The four gasParams() fields the E2E snapshots (Daybreak M1). */
export type GasParamsTuple = { minPostOpGas: bigint; settleGasBound: bigint; cWrap: bigint; cPostop: bigint };
export const GAS_PARAMS_KEYS = ['minPostOpGas', 'settleGasBound', 'cWrap', 'cPostop'] as const;
/** Fields where `observed` differs from `expected`, as "k a != b" (empty = equal). */
export function gasParamsDiff(observed: GasParamsTuple, expected: GasParamsTuple): string[] {
    return GAS_PARAMS_KEYS.filter((k) => observed[k] !== expected[k]).map((k) => `${k} ${observed[k]} != ${expected[k]}`);
}
/** gasParams() result (current, pending) as the E2E reads it: tuple by name or index. */
export function gasParamsOf(current: any): GasParamsTuple {
    const pick = (k: string, i: number) => BigInt(String(current?.[k] ?? current?.[i]));
    return { minPostOpGas: pick('minPostOpGas', 0), settleGasBound: pick('settleGasBound', 1), cWrap: pick('cWrap', 2), cPostop: pick('cPostop', 3) };
}
/** Snapshot keys whose value changed between the gate's snapshot and a re-read (blockNumber ignored). */
export function snapshotChanges<T extends Record<string, unknown>>(gated: T, now: T): string[] {
    return (Object.keys(gated) as (keyof T & string)[]).filter((k) => k !== 'blockNumber' && String(now[k]).toLowerCase() !== String(gated[k]).toLowerCase())
        .map((k) => `${k} ${String(gated[k])} -> ${String(now[k])}`);
}

/** Daybreak #468 M3: a child's environment without the fork source (SP550_FORK_URL usually carries a provider key). */
export const childEnv = (env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv => {
    const { SP550_FORK_URL: _drop, ...rest } = env;
    return rest;
};
