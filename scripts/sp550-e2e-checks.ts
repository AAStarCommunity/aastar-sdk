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

export function tapBundler(bundlerUrl: string, signsNow: () => number, sink: BundlerCall[]): () => void {
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
                        call.flags = flagsFromPaymasterData(op.paymasterData);
                        const big = (v: unknown) => { try { return v === undefined || v === null ? undefined : BigInt(v as any); } catch { return undefined; } };
                        call.gas = {
                            verificationGasLimit: big(op.verificationGasLimit), callGasLimit: big(op.callGasLimit), preVerificationGas: big(op.preVerificationGas),
                            paymasterVerificationGasLimit: big(op.paymasterVerificationGasLimit), paymasterPostOpGasLimit: big(op.paymasterPostOpGasLimit),
                            maxFeePerGas: big(op.maxFeePerGas), maxPriorityFeePerGas: big(op.maxPriorityFeePerGas),
                        };
                    }
                    sink.push(call);
                }
            } catch { sink.push({ method: '<unparsable body>', signsBefore: signsNow() }); }
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
    if (tx.chainId === undefined || Number(tx.chainId) !== w.chainId) p.push(`chainId ${tx.chainId} is not ${w.chainId}`);
    if (typeof tx.to !== 'string' || getAddress(tx.to) !== getAddress(w.entryPoint)) p.push(`to ${tx.to} is not the EntryPoint ${w.entryPoint}`);
    if (tx.value !== undefined && BigInt(tx.value) !== 0n) p.push(`value ${tx.value} is not 0`);
    if (tx.gas === undefined || BigInt(tx.gas) > w.maxGas) p.push(`gas ${tx.gas} is not within the cap ${w.maxGas}`);
    const fee = tx.maxFeePerGas ?? tx.gasPrice;
    if (fee === undefined || BigInt(fee) > w.maxFeePerGas) p.push(`maxFeePerGas ${fee} is not within the cap ${w.maxFeePerGas}`);
    if (tx.maxPriorityFeePerGas !== undefined && fee !== undefined && BigInt(tx.maxPriorityFeePerGas) > BigInt(fee)) p.push('maxPriorityFeePerGas exceeds maxFeePerGas');
    if (tx.authorizationList !== undefined || tx.blobs !== undefined) p.push('authorization list / blobs are not part of C12');
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
        let safe: string;
        try { const x = new URL(u); safe = `${x.protocol}//${x.host}/…`; } catch { continue; }
        for (const f of new Set([u, u.replace(/\/+$/, '')])) if (f.length > 0) forms.push([f, safe]);
    }
    forms.sort((a, b) => b[0].length - a[0].length);
    let out = text;
    for (const [f, safe] of forms) out = out.split(f).join(safe);
    return out;
}

/** The signer state C12's transaction is checked against (sp550-live-e2e.ts owns it; mutable). */
export type C12SignState = {
    allowTx: boolean;
    expect?: Omit<C12TxExpectation, 'userOpHash'>;
    lastSignedHash?: Hex;
    signs: number;
    txSigns: number;
    signBudget: number;
    beforeSign?: () => Promise<void>;
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
    if (!st.lastSignedHash) throw new Error('C12: no UserOperation was signed before the transaction; refused');
    const bad = c12TransactionProblems(tx, { ...st.expect, userOpHash: st.lastSignedHash });
    if (bad.length) throw new Error(`C12 transaction refused before signing: ${bad.join('; ')}`);
    if (st.beforeSign) await st.beforeSign();
    st.txSigns++;
    return sign();
}
