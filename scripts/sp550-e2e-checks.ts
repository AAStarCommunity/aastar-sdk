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
import { type Abi, type Address, type Hex, decodeEventLog, getAddress } from 'viem';
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
export function opSigningProblems(calls: BundlerCall[], signsTotal: number, dummySignature: Hex): string[] {
    const problems: string[] = [];
    const estimates = calls.filter((c) => c.method === 'eth_estimateUserOperationGas');
    const sends = calls.filter((c) => c.method === 'eth_sendUserOperation');
    if (estimates.length === 0) problems.push('no eth_estimateUserOperationGas call: placeholder-signature estimation was not exercised');
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
