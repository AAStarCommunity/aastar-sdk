import { getAddress, getContractAddress, type Address } from 'viem';
import { attributeTx, MEASURE_BYTES, MEASURE_NODES, measure, receiptPos, sameLog, type LogAttribution } from './attribute.js';
import { quantity, type RawRpc } from './rpc.js';
import type { Attributor, FoundAction } from './scan.js';

const TRACE_OPTS = { tracer: 'callTracer', tracerConfig: { withLog: true } } as const;

/** Messages longer than this are ignored. They are never sliced, joined, or passed to a regex. */
const CLASSIFY_MESSAGE_MAX = 512;
const UNSUPPORTED_RE = /(method|namespace)\b.{0,60}\b(not found|does not exist|not available|not supported|unsupported|disabled|not allowed)|unknown tracer|tracer\b.{0,30}\bnot (found|supported)/i;

/**
 * The node has no `debug_traceTransaction` / callTracer (not a transient failure).
 * -32601 method not found, -32600 invalid request (tracer config rejected).
 * Reads only a numeric `code` (`code`, `error.code`, `info.error.code`, `cause.code` up to 3
 * levels) and a `message` / `shortMessage` whose length is at most {@link CLASSIFY_MESSAGE_MAX}.
 * The message is only classified here — it never becomes part of a reason.
 */
function traceUnsupported(e: unknown): boolean {
    if (!e || typeof e !== 'object') return false;
    const root = e as Record<string, unknown>;
    const objs: Record<string, unknown>[] = [root];
    if (root.error && typeof root.error === 'object') objs.push(root.error as Record<string, unknown>);
    const info = root.info;
    if (info && typeof info === 'object') {
        const infoError = (info as Record<string, unknown>).error;
        if (infoError && typeof infoError === 'object') objs.push(infoError as Record<string, unknown>);
    }
    let cause: unknown = root.cause;
    for (let depth = 0; depth < 3 && cause && typeof cause === 'object'; depth++) {
        const node = cause as Record<string, unknown>;
        objs.push(node);
        cause = node.cause;
    }
    for (const o of objs) {
        if (o.code === -32601 || o.code === -32600) return true;
    }
    for (const o of objs) {
        if (shortEnough(o.message) || shortEnough(o.shortMessage)) return true;
    }
    return false;
}

function shortEnough(v: unknown): boolean {
    return typeof v === 'string' && v.length <= CLASSIFY_MESSAGE_MAX && UNSUPPORTED_RE.test(v);
}

/** A JSON-RPC error envelope. A reverted call frame carries `error` as a string, not `{ code }`. */
function jsonRpcFailure(v: unknown): unknown | null {
    if (!v || typeof v !== 'object') return null;
    const err = (v as { error?: unknown }).error;
    if (!err || typeof err !== 'object') return null;
    return typeof (err as { code?: unknown }).code === 'number' ? v : null;
}

function lc(v: unknown): string {
    return typeof v === 'string' ? v.toLowerCase() : '';
}

function statusOk(v: unknown): boolean {
    return quantity(v) === 1;
}

function checkReceipt(
    receipt: unknown, action: FoundAction, name: string,
): { logs: unknown[] } | { reason: string } {
    if (jsonRpcFailure(receipt)) return { reason: `receipt read failed on ${name}` };
    if (receipt === null || typeof receipt !== 'object') return { reason: `no receipt on ${name}` };
    const r = receipt as Record<string, unknown>;
    if (lc(r.transactionHash) !== lc(action.txHash)) return { reason: `receipt transaction mismatch on ${name}` };
    if (lc(r.blockHash) !== lc(action.blockHash)) return { reason: `receipt block mismatch on ${name}` };
    if (!statusOk(r.status)) return { reason: `receipt status is not success on ${name}` };
    if (!Array.isArray(r.logs)) return { reason: `receipt logs missing on ${name}` };
    if (r.logs.length > 10_000) return { reason: 'trace too large' };
    const found = r.logs.some((log) => receiptPos(log) === action.logIndex && sameLog(log, action.log));
    if (!found) return { reason: `receipt log missing on ${name}` };
    return { logs: r.logs };
}

function sameHop(a: LogAttribution['forwardingPath'][number], b: LogAttribution['forwardingPath'][number]): boolean {
    return a.type === b.type
        && lc(a.from) === lc(b.from)
        && lc(a.to) === lc(b.to)
        && lc(a.selector) === lc(b.selector);
}

function sameAttribution(a: LogAttribution, b: LogAttribution): boolean {
    if (lc(a.transactionSender) !== lc(b.transactionSender)) return false;
    if (lc(a.immediateCaller) !== lc(b.immediateCaller)) return false;
    if (lc(a.emitter) !== lc(b.emitter)) return false;
    if (a.forwardingPath.length !== b.forwardingPath.length) return false;
    return a.forwardingPath.every((hop, i) => sameHop(hop, b.forwardingPath[i]!));
}

function asRecord(v: unknown): Record<string, unknown> | null {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    return v as Record<string, unknown>;
}

function sameHexText(a: unknown, b: unknown): boolean {
    return typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
}

/** `null` is a value (no address). A missing field only equals a missing field. */
function sameNullableHex(a: unknown, b: unknown): boolean {
    if (a === undefined && b === undefined) return true;
    if (a === null && b === null) return true;
    return sameHexText(a, b);
}

function sameQty(a: unknown, b: unknown): boolean {
    const x = hexQuantity(a);
    const y = hexQuantity(b);
    return x !== null && y !== null && x === y;
}

/**
 * Cross-provider agreement uses attribution-relevant fields only.
 * Hex is lower-cased. Quantities (`blockNumber`, `transactionIndex`, `value`, `nonce`,
 * `status`, `logIndex`) compare as bigint, so `0x0` and `0x00` agree.
 * Extra provider-specific fields are ignored.
 *
 * tx: hash, blockHash, blockNumber, transactionIndex, from, to, input, value, nonce.
 * receipt: transactionHash, blockHash, blockNumber, transactionIndex, status,
 * contractAddress, logs[{address, topics, data, logIndex}].
 */
function sameTx(a: unknown, b: unknown): boolean {
    const x = asRecord(a);
    const y = asRecord(b);
    if (!x || !y) return false;
    return sameHexText(x.hash, y.hash)
        && sameHexText(x.blockHash, y.blockHash)
        && sameQty(x.blockNumber, y.blockNumber)
        && sameQty(x.transactionIndex, y.transactionIndex)
        && sameHexText(x.from, y.from)
        && sameNullableHex(x.to, y.to)
        && sameHexText(x.input, y.input)
        && sameQty(x.value, y.value)
        && sameQty(x.nonce, y.nonce);
}

function sameReceiptLog(a: unknown, b: unknown): boolean {
    const x = asRecord(a);
    const y = asRecord(b);
    if (!x || !y) return false;
    if (!sameHexText(x.address, y.address) || !sameHexText(x.data, y.data) || !sameQty(x.logIndex, y.logIndex)) {
        return false;
    }
    const xt = x.topics;
    const yt = y.topics;
    if (!Array.isArray(xt) || !Array.isArray(yt) || xt.length !== yt.length) return false;
    return xt.every((topic, i) => sameHexText(topic, yt[i]));
}

function sameReceipt(a: unknown, b: unknown): boolean {
    const x = asRecord(a);
    const y = asRecord(b);
    if (!x || !y) return false;
    if (!sameHexText(x.transactionHash, y.transactionHash)
        || !sameHexText(x.blockHash, y.blockHash)
        || !sameQty(x.blockNumber, y.blockNumber)
        || !sameQty(x.transactionIndex, y.transactionIndex)
        || !sameQty(x.status, y.status)
        || !sameNullableHex(x.contractAddress, y.contractAddress)) {
        return false;
    }
    const xl = x.logs;
    const yl = y.logs;
    if (!Array.isArray(xl) || !Array.isArray(yl) || xl.length !== yl.length) return false;
    return xl.every((log, i) => sameReceiptLog(log, yl[i]));
}

function sameText(a: unknown, b: unknown): boolean {
    return typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
}

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
/** Strict 0x quantity. Leading zeros are allowed; comparison is numeric. */
const QTY_RE = /^0x[0-9a-fA-F]+$/;

function addressOf(v: unknown): Address | null {
    if (typeof v !== 'string' || !ADDR_RE.test(v)) return null;
    try {
        return getAddress(v);
    } catch {
        return null;
    }
}

/** `0x0` and `0x00` are equal. Values above `2^53−1` stay exact. Decimal and bare numbers are rejected. */
function hexQuantity(v: unknown): bigint | null {
    if (typeof v !== 'string' || !QTY_RE.test(v)) return null;
    return BigInt(v);
}

/**
 * geth and erigon callTracer always report `value` on CALL and CREATE roots.
 * An absent trace value is a mismatch. `tx.value` must already be a valid quantity.
 */
function sameValue(traceValue: unknown, txValue: unknown): boolean {
    const tx = hexQuantity(txValue);
    const traced = hexQuantity(traceValue);
    return tx !== null && traced !== null && tx === traced;
}

/**
 * Creation (`tx.to === null`) is a top-level CREATE whose `to` equals the dual-verified
 * `receipt.contractAddress` and the address derived from `tx.from` + `tx.nonce`.
 * A top-level CREATE2 is not a creation transaction. A call must carry the same `to`.
 */
function toMatches(trace: Record<string, unknown>, tx: Record<string, unknown>, receipt: unknown): boolean {
    const type = typeof trace.type === 'string' ? trace.type.toUpperCase() : '';
    if (tx.to === null) {
        if (type !== 'CREATE') return false;
        const bound = boundCreateAddress(tx, receipt);
        return bound !== null && sameText(trace.to, bound);
    }
    if (type === 'CREATE' || type === 'CREATE2') return false;
    return sameText(trace.to, tx.to);
}

/** Address claimed by the receipt and reproduced from sender + nonce. */
function boundCreateAddress(tx: Record<string, unknown>, receipt: unknown): Address | null {
    if (!receipt || typeof receipt !== 'object') return null;
    const claimed = addressOf((receipt as Record<string, unknown>).contractAddress);
    const from = addressOf(tx.from);
    const nonce = hexQuantity(tx.nonce);
    if (!claimed || !from || nonce === null) return null;
    const derived = getContractAddress({ from, nonce, opcode: 'CREATE' });
    return claimed.toLowerCase() === derived.toLowerCase() ? derived : null;
}

function traceMatchesTx(
    trace: unknown, tx: Record<string, unknown>, receipt: unknown, name: string,
): string | null {
    if (!trace || typeof trace !== 'object') return 'no trace';
    const frame = trace as Record<string, unknown>;
    if (!sameText(frame.from, tx.from)) return `trace from mismatch on ${name}`;
    if (!toMatches(frame, tx, receipt)) return `trace to mismatch on ${name}`;
    if (!sameText(frame.input, tx.input)) return `trace input mismatch on ${name}`;
    if (!sameValue(frame.value, tx.value)) return `trace value mismatch on ${name}`;
    return null;
}

function sameBlock(tx: Record<string, unknown>, receipt: unknown): boolean {
    if (!receipt || typeof receipt !== 'object') return false;
    const r = receipt as Record<string, unknown>;
    if (lc(tx.blockHash) === '' || lc(tx.blockHash) !== lc(r.blockHash)) return false;
    const txBlock = quantity(tx.blockNumber);
    const receiptBlock = quantity(r.blockNumber);
    return txBlock !== null && txBlock === receiptBlock;
}

type Side =
    | { ok: true; receipt: unknown; tx: Record<string, unknown>; logs: unknown[] }
    | { ok: false; reason: string };

async function readSide(rpc: RawRpc, action: FoundAction): Promise<Side> {
    const hash = action.txHash;
    const [receiptR, txR] = await Promise.all([
        rpc.request({ method: 'eth_getTransactionReceipt', params: [hash] }).then(
            (v) => ({ ok: true as const, v }),
            () => ({ ok: false as const }),
        ),
        rpc.request({ method: 'eth_getTransactionByHash', params: [hash] }).then(
            (v) => ({ ok: true as const, v }),
            () => ({ ok: false as const }),
        ),
    ]);
    if (!receiptR.ok) return { ok: false, reason: `receipt read failed on ${rpc.name}` };
    if (!txR.ok) return { ok: false, reason: `transaction read failed on ${rpc.name}` };
    // Before checkReceipt, sameLog, or any other walk of the payloads.
    const budget = { nodes: MEASURE_NODES, bytes: MEASURE_BYTES };
    if (!measure(receiptR.v, budget) || !measure(txR.v, budget)) return { ok: false, reason: 'trace too large' };
    const checked = checkReceipt(receiptR.v, action, rpc.name);
    if ('reason' in checked) return { ok: false, reason: checked.reason };
    if (jsonRpcFailure(txR.v)) return { ok: false, reason: `transaction read failed on ${rpc.name}` };
    if (txR.v === null || typeof txR.v !== 'object') return { ok: false, reason: `no transaction on ${rpc.name}` };
    const tx = txR.v as Record<string, unknown>;
    if (!sameBlock(tx, receiptR.v)) return { ok: false, reason: 'providers disagree on the transaction' };
    // Each provider is checked on its own. Agreement between them is not enough.
    if (!sameText(tx.hash, action.txHash)) return { ok: false, reason: `transaction hash mismatch on ${rpc.name}` };
    if (hexQuantity(tx.value) === null) return { ok: false, reason: `transaction value invalid on ${rpc.name}` };
    const receiptIndex = receiptR.v && typeof receiptR.v === 'object'
        ? (receiptR.v as Record<string, unknown>).transactionIndex
        : undefined;
    const txIndex = hexQuantity(tx.transactionIndex);
    const receiptTxIndex = hexQuantity(receiptIndex);
    if (txIndex === null || receiptTxIndex === null || txIndex !== receiptTxIndex) {
        return { ok: false, reason: `transaction index mismatch on ${rpc.name}` };
    }
    if (tx.to === null && boundCreateAddress(tx, receiptR.v) === null) {
        return { ok: false, reason: `contract address mismatch on ${rpc.name}` };
    }
    return { ok: true, receipt: receiptR.v, tx, logs: checked.logs };
}

type Traced =
    | { ok: true; attribution: LogAttribution }
    | { ok: false; reason: string };

async function readTrace(
    rpc: RawRpc, action: FoundAction, tx: Record<string, unknown>, receipt: unknown, logs: unknown[],
): Promise<Traced> {
    const got = await rpc.request({
        method: 'debug_traceTransaction', params: [action.txHash, TRACE_OPTS],
    }).then(
        (v) => ({ ok: true as const, v }),
        (e: unknown) => ({ ok: false as const, e }),
    );
    if (!got.ok) {
        const reason = traceUnsupported(got.e) ? `trace unsupported on ${rpc.name}` : `trace read failed on ${rpc.name}`;
        return { ok: false, reason };
    }
    const budget = { nodes: MEASURE_NODES, bytes: MEASURE_BYTES };
    if (!measure(got.v, budget)) return { ok: false, reason: 'trace too large' };
    const failure = jsonRpcFailure(got.v);
    if (failure) {
        const reason = traceUnsupported(failure) ? `trace unsupported on ${rpc.name}` : `trace read failed on ${rpc.name}`;
        return { ok: false, reason };
    }
    const mismatch = traceMatchesTx(got.v, tx, receipt, rpc.name);
    if (mismatch) return { ok: false, reason: mismatch };
    const aligned = attributeTx(got.v, logs);
    if (!aligned.aligned) return { ok: false, reason: aligned.why };
    const attribution = aligned.byLogIndex.get(action.logIndex);
    if (!attribution) return { ok: false, reason: `attribution missing on ${rpc.name}` };
    return { ok: true, attribution };
}

export interface TraceAttributorOptions {
    /** Completeness providers. Receipts and transactions are read on both and must agree. */
    providers: readonly [RawRpc, RawRpc];
    /** One or two callTracer sources. Two names must be distinct, same rule as `scanRange`. */
    traceProviders: readonly [RawRpc] | readonly [RawRpc, RawRpc];
}

/**
 * Attribute a found action.
 *
 * Completeness providers both serve `eth_getTransactionReceipt` and `eth_getTransactionByHash`.
 * Trace providers serve `debug_traceTransaction` (callTracer, withLog). One source is enough when
 * the other completeness provider has no trace API.
 *
 * The decoded JSON is already allocated by the transport, so callers must use a transport with a
 * response-size cap. This module bounds its own work after decoding.
 */
export function traceAttributor(opts: TraceAttributorOptions): Attributor {
    const [pa, pb] = opts.providers;
    if (opts.providers.length !== 2 || pa === pb || pa.name === pb.name) {
        throw new Error('guardian audit requires two distinct providers');
    }
    const traces = opts.traceProviders;
    if (traces.length !== 1 && traces.length !== 2) {
        throw new Error('guardian audit requires one or two trace providers');
    }
    const [ta, tb] = traces;
    if (tb && (ta === tb || ta.name === tb.name)) {
        throw new Error('guardian audit requires two distinct providers');
    }
    return {
        async attribute(action) {
            try {
                const [sa, sb] = await Promise.all([readSide(pa, action), readSide(pb, action)]);
                if (!sa.ok) return sa;
                if (!sb.ok) return sb;
                if (!sameReceipt(sa.receipt, sb.receipt) || !sameTx(sa.tx, sb.tx)) {
                    return { ok: false, reason: 'providers disagree on the transaction' };
                }
                const traced = await Promise.all(
                    traces.map((rpc) => readTrace(rpc, action, sa.tx, sa.receipt, sa.logs)),
                );
                const first = traced[0]!;
                if (!first.ok) return first;
                if (!tb) {
                    return { ok: true, attribution: { ...first.attribution, attributionSource: `single:${ta.name}` } };
                }
                const second = traced[1]!;
                if (!second.ok) return second;
                if (!sameAttribution(first.attribution, second.attribution)) {
                    return { ok: false, reason: 'trace providers disagree' };
                }
                return {
                    ok: true,
                    attribution: { ...first.attribution, attributionSource: `dual:${ta.name}+${tb.name}` },
                };
            } catch {
                return { ok: false, reason: 'attribution failed' };
            }
        },
    };
}
