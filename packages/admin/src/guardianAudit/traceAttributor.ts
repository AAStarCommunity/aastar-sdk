/**
 * Trace attribution for guardian audit.
 *
 * `attributionSource: 'single:<name>'` means the call path was claimed by one trace provider.
 * `immediateCaller` and `forwardingPath` are unverified hints in that mode. Only
 * `transactionSender` (root `from` = dual-verified `tx.from`), the root frame
 * (`to` / `input` / `value` = the transaction), and `emitter` (= the receipt log address)
 * are independently verified. A decision that depends on the caller or the path must require
 * `attributionSource` to start with `dual:`.
 */
import { getAddress, getContractAddress, type Address } from 'viem';
import { attributeTx, MEASURE_BYTES, MEASURE_NODES, measure, receiptPos, sameLog, type LogAttribution } from './attribute.js';
import { quantity, type RawRpc } from './rpc.js';
import type { FoundAction } from './scan.js';

/** `single:` is one trace provider's claim. `dual:` is two providers that agreed on the path. */
export type TraceAttribution = LogAttribution & {
    attributionSource: `single:${string}` | `dual:${string}`;
};

/** A new object on every call. A shared tracer config is mutable across requests. */
function traceParams(hash: string): [string, { tracer: string; tracerConfig: { withLog: boolean } }] {
    return [hash, { tracer: 'callTracer', tracerConfig: { withLog: true } }];
}
/** Same label rule as the core. A URL is not a provider name, and the name is never put in an error. */
const PROVIDER_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function assertProviderName(name: unknown): void {
    if (typeof name !== 'string' || !PROVIDER_NAME.test(name)) {
        throw new Error('guardian audit provider name is invalid');
    }
}

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
    receipt: unknown, action: ActionView,
): { logs: unknown[] } | { reason: string } {
    if (jsonRpcFailure(receipt)) return { reason: 'receipt read failed' };
    if (receipt === null || typeof receipt !== 'object') return { reason: 'no receipt' };
    const r = receipt as Record<string, unknown>;
    if (lc(r.transactionHash) !== lc(action.txHash)) return { reason: 'receipt transaction mismatch' };
    if (lc(r.blockHash) !== lc(action.blockHash)) return { reason: 'receipt block mismatch' };
    if (!statusOk(r.status)) return { reason: 'receipt status is not success' };
    if (!Array.isArray(r.logs)) return { reason: 'receipt logs missing' };
    if (r.logs.length > 10_000) return { reason: 'trace too large' };
    const found = r.logs.some((log) => receiptPos(log) === action.logIndex && sameLog(log, action.log));
    if (!found) return { reason: 'receipt log missing' };
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
const WORD_RE = /^0x[0-9a-fA-F]{64}$/;
/**
 * Flat scan. A repeated `{2}` group returns false, without throwing, on about 1.4 MB of
 * calldata in JavaScriptCore. Calldata is bytes, so a single nibble is rejected by length.
 */
const CALLDATA_RE = /^0x[0-9a-fA-F]*$/;
/** Strict 0x quantity. Leading zeros are allowed; comparison is numeric. */
const QTY_RE = /^0x[0-9a-fA-F]+$/;

function isCalldata(v: unknown): v is string {
    return typeof v === 'string' && v.length % 2 === 0 && CALLDATA_RE.test(v);
}

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
 * A CREATE or CREATE2 root on a call is refused even when that `to` equals `tx.to`.
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
    trace: unknown, tx: Record<string, unknown>, receipt: unknown,
): string | null {
    if (!trace || typeof trace !== 'object') return 'no trace';
    const frame = trace as Record<string, unknown>;
    if (!sameText(frame.from, tx.from)) return 'trace from mismatch';
    if (!toMatches(frame, tx, receipt)) return 'trace to mismatch';
    if (!sameText(frame.input, tx.input)) return 'trace input mismatch';
    if (!sameValue(frame.value, tx.value)) return 'trace value mismatch';
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

interface ActionView {
    txHash: string;
    blockHash: string;
    blockNumber: number;
    logIndex: number;
    log: { address: string; topics: readonly string[]; data: string };
}

interface BoundRpc {
    readonly name: string;
    readonly request: RawRpc['request'];
}

/**
 * Name and request are read once, here. Later writes to the caller's object are not observed.
 * `request` is bound so a replaced method is not the function this module calls.
 */
function bindRpc(rpc: unknown): BoundRpc {
    if (!rpc || typeof rpc !== 'object') throw new Error('guardian audit provider is invalid');
    const live = rpc as RawRpc;
    assertProviderName(live.name);
    if (typeof live.request !== 'function') throw new Error('guardian audit provider is invalid');
    const name = live.name;
    const request = live.request.bind(live);
    return Object.freeze({ name, request });
}

function snapAction(action: FoundAction): ActionView | null {
    if (!action || typeof action !== 'object') return null;
    const txHash = action.txHash;
    const blockHash = action.blockHash;
    if (typeof txHash !== 'string' || !WORD_RE.test(txHash)) return null;
    if (typeof blockHash !== 'string' || !WORD_RE.test(blockHash)) return null;
    if (typeof action.blockNumber !== 'number' || !Number.isSafeInteger(action.blockNumber) || action.blockNumber < 0) {
        return null;
    }
    if (typeof action.logIndex !== 'number' || !Number.isSafeInteger(action.logIndex) || action.logIndex < 0) {
        return null;
    }
    const address = addressOf(action.address);
    const log = action.log;
    if (!address || !log || typeof log !== 'object') return null;
    const logAddress = addressOf(log.address);
    if (!logAddress || !Array.isArray(log.topics) || log.topics.length > 4) return null;
    const topics: string[] = [];
    for (const topic of log.topics) {
        if (typeof topic !== 'string' || !WORD_RE.test(topic)) return null;
        topics.push(topic);
    }
    if (!isCalldata(log.data)) return null;
    return Object.freeze({
        txHash,
        blockHash,
        blockNumber: action.blockNumber,
        logIndex: action.logIndex,
        log: Object.freeze({ address: logAddress, topics: Object.freeze(topics), data: log.data }),
    });
}

function copyQty(v: unknown): string | number | undefined {
    if (typeof v === 'string' || typeof v === 'number') return v;
    return undefined;
}

/** Provider-owned objects stay on the provider. Only copied primitives are returned. */
function detachLog(raw: unknown): Record<string, unknown> {
    const o = asRecord(raw);
    const topicsIn = o && Array.isArray(o.topics) ? o.topics : [];
    const topics: string[] = [];
    for (const topic of topicsIn) {
        if (typeof topic !== 'string') return Object.freeze({ address: undefined, topics: Object.freeze([]), data: undefined });
        topics.push(topic);
    }
    const log: Record<string, unknown> = {
        address: o && typeof o.address === 'string' ? o.address : undefined,
        topics: Object.freeze(topics),
        data: o && typeof o.data === 'string' ? o.data : undefined,
    };
    if (o && Object.prototype.hasOwnProperty.call(o, 'logIndex')) log.logIndex = copyQty(o.logIndex);
    if (o && Object.prototype.hasOwnProperty.call(o, 'index')) log.index = copyQty(o.index);
    return Object.freeze(log);
}

function detachReceipt(raw: unknown): Record<string, unknown> | null {
    const o = asRecord(raw);
    if (!o) return null;
    const logs = Array.isArray(o.logs) ? Object.freeze(o.logs.map((item) => detachLog(item))) : undefined;
    const receipt: Record<string, unknown> = {
        transactionHash: typeof o.transactionHash === 'string' ? o.transactionHash : undefined,
        blockHash: typeof o.blockHash === 'string' ? o.blockHash : undefined,
        blockNumber: copyQty(o.blockNumber),
        transactionIndex: typeof o.transactionIndex === 'string' ? o.transactionIndex : undefined,
        status: copyQty(o.status),
        logs,
    };
    if (Object.prototype.hasOwnProperty.call(o, 'contractAddress')) {
        const claimed = o.contractAddress;
        receipt.contractAddress = claimed === null ? null : (typeof claimed === 'string' ? claimed : undefined);
    }
    return Object.freeze(receipt);
}

function detachTx(raw: unknown): Record<string, unknown> | null {
    const o = asRecord(raw);
    if (!o) return null;
    const tx: Record<string, unknown> = {
        hash: typeof o.hash === 'string' ? o.hash : undefined,
        blockHash: typeof o.blockHash === 'string' ? o.blockHash : undefined,
        blockNumber: copyQty(o.blockNumber),
        transactionIndex: typeof o.transactionIndex === 'string' ? o.transactionIndex : undefined,
        from: typeof o.from === 'string' ? o.from : undefined,
        input: typeof o.input === 'string' ? o.input : undefined,
        value: typeof o.value === 'string' ? o.value : undefined,
        nonce: typeof o.nonce === 'string' ? o.nonce : undefined,
    };
    if (Object.prototype.hasOwnProperty.call(o, 'to')) {
        tx.to = o.to === null ? null : (typeof o.to === 'string' ? o.to : undefined);
    }
    return Object.freeze(tx);
}

function logShapeOk(log: unknown): boolean {
    const o = asRecord(log);
    if (!o || !addressOf(o.address) || !isCalldata(o.data)) return false;
    const topics = o.topics;
    if (!Array.isArray(topics) || topics.length > 4) return false;
    return topics.every((topic) => typeof topic === 'string' && WORD_RE.test(topic));
}

type Side =
    | { ok: true; receipt: Record<string, unknown>; tx: Record<string, unknown>; logs: unknown[] }
    | { ok: false; reason: string };

async function readSide(rpc: BoundRpc, action: ActionView): Promise<Side> {
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
    if (!receiptR.ok) return { ok: false, reason: 'receipt read failed' };
    if (!txR.ok) return { ok: false, reason: 'transaction read failed' };
    // Before checkReceipt, sameLog, or any other walk of the payloads.
    const budget = { nodes: MEASURE_NODES, bytes: MEASURE_BYTES };
    if (!measure(receiptR.v, budget) || !measure(txR.v, budget)) return { ok: false, reason: 'trace too large' };
    // Copy the fields we keep before any later await can mutate the provider's objects.
    const receipt = detachReceipt(receiptR.v);
    const tx = detachTx(txR.v);
    if (jsonRpcFailure(receiptR.v)) return { ok: false, reason: 'receipt read failed' };
    if (!receipt) return { ok: false, reason: 'no receipt' };
    const checked = checkReceipt(receipt, action);
    if ('reason' in checked) return { ok: false, reason: checked.reason };
    if (checked.logs.some((log) => !logShapeOk(log))) return { ok: false, reason: 'receipt log missing' };
    if (jsonRpcFailure(txR.v)) return { ok: false, reason: 'transaction read failed' };
    if (!tx) return { ok: false, reason: 'no transaction' };
    // This provider's own tx and receipt. Cross-provider disagreement is a different reason.
    if (!sameBlock(tx, receipt)) return { ok: false, reason: 'provider tx block does not match its receipt' };
    const receiptHeight = quantity(receipt.blockNumber);
    if (receiptHeight === null || receiptHeight !== action.blockNumber || quantity(tx.blockNumber) !== action.blockNumber) {
        return { ok: false, reason: 'block number mismatch' };
    }
    // Each provider is checked on its own. Agreement between them is not enough.
    if (typeof tx.hash !== 'string' || !WORD_RE.test(tx.hash) || !sameText(tx.hash, action.txHash)) {
        return { ok: false, reason: 'transaction hash mismatch' };
    }
    if (addressOf(tx.from) === null) return { ok: false, reason: 'transaction from invalid' };
    if (Object.prototype.hasOwnProperty.call(tx, 'to') && tx.to !== null && addressOf(tx.to) === null) {
        return { ok: false, reason: 'transaction to invalid' };
    }
    if (Object.prototype.hasOwnProperty.call(receipt, 'contractAddress')
        && receipt.contractAddress !== null
        && addressOf(receipt.contractAddress) === null) {
        return { ok: false, reason: 'contract address mismatch' };
    }
    if (hexQuantity(tx.value) === null) return { ok: false, reason: 'transaction value invalid' };
    if (!isCalldata(tx.input)) {
        return { ok: false, reason: 'transaction input invalid' };
    }
    if (hexQuantity(tx.nonce) === null) return { ok: false, reason: 'transaction nonce invalid' };
    const txIndex = hexQuantity(tx.transactionIndex);
    const receiptTxIndex = hexQuantity(receipt.transactionIndex);
    if (txIndex === null || receiptTxIndex === null || txIndex !== receiptTxIndex) {
        return { ok: false, reason: 'transaction index mismatch' };
    }
    if (tx.to === null && boundCreateAddress(tx, receipt) === null) {
        return { ok: false, reason: 'contract address mismatch' };
    }
    return { ok: true, receipt, tx, logs: checked.logs };
}

type Traced =
    | { ok: true; attribution: LogAttribution }
    | { ok: false; reason: string };

/**
 * The trace RPC is keyed only by tx hash. Re-read the receipt afterwards and pin it to the
 * transaction the completeness providers already agreed on: hash, block hash, block number,
 * transaction index, and status. A non-object or a JSON-RPC error is a failed read.
 */
async function traceReceiptBinds(rpc: BoundRpc, action: ActionView, verified: Record<string, unknown>): Promise<string | null> {
    const got = await rpc.request({ method: 'eth_getTransactionReceipt', params: [action.txHash] }).then(
        (v) => ({ ok: true as const, v }),
        () => ({ ok: false as const }),
    );
    if (!got.ok) return 'trace receipt read failed';
    const budget = { nodes: MEASURE_NODES, bytes: MEASURE_BYTES };
    if (!measure(got.v, budget)) return 'trace too large';
    if (jsonRpcFailure(got.v)) return 'trace receipt read failed';
    const claimed = asRecord(got.v);
    if (!claimed
        || typeof claimed.transactionHash !== 'string'
        || typeof claimed.blockHash !== 'string'
        || typeof claimed.blockNumber !== 'string'
        || typeof claimed.transactionIndex !== 'string'
        || typeof claimed.status !== 'string') {
        return 'trace receipt read failed';
    }
    if (!sameHexText(claimed.transactionHash, verified.transactionHash)) {
        return 'trace receipt transaction mismatch';
    }
    if (lc(claimed.blockHash) === '' || lc(claimed.blockHash) !== lc(verified.blockHash)) {
        return 'trace receipt block mismatch';
    }
    if (!sameQty(claimed.blockNumber, verified.blockNumber)) {
        return 'trace receipt block number mismatch';
    }
    const claimedIndex = hexQuantity(claimed.transactionIndex);
    const boundIndex = hexQuantity(verified.transactionIndex);
    if (claimedIndex === null || boundIndex === null || claimedIndex !== boundIndex) {
        return 'trace receipt index mismatch';
    }
    if (!sameQty(claimed.status, verified.status)) {
        return 'trace receipt status mismatch';
    }
    return null;
}

function seal(attribution: LogAttribution, attributionSource: TraceAttribution['attributionSource']): TraceAttribution {
    return Object.freeze({
        transactionSender: attribution.transactionSender,
        immediateCaller: attribution.immediateCaller,
        emitter: attribution.emitter,
        forwardingPath: Object.freeze(attribution.forwardingPath.map((hop) => Object.freeze({
            type: hop.type,
            from: hop.from,
            to: hop.to,
            selector: hop.selector,
        }))),
        attributionSource,
    });
}

async function readTrace(
    rpc: BoundRpc, action: ActionView, tx: Record<string, unknown>, receipt: Record<string, unknown>, logs: unknown[],
): Promise<Traced> {
    const got = await rpc.request({
        method: 'debug_traceTransaction', params: traceParams(action.txHash),
    }).then(
        (v) => ({ ok: true as const, v }),
        (e: unknown) => ({ ok: false as const, e }),
    );
    if (!got.ok) {
        const reason = traceUnsupported(got.e) ? 'trace unsupported' : 'trace read failed';
        return { ok: false, reason };
    }
    // Finish with the trace value before the next await. The receipt re-read must not be a window
    // in which the provider can still change this object.
    // MEASURE_NODES is fail-closed: a larger trace is rejected even when it would have been legitimate.
    let traced: Traced;
    const budget = { nodes: MEASURE_NODES, bytes: MEASURE_BYTES };
    if (!measure(got.v, budget)) {
        traced = { ok: false, reason: 'trace too large' };
    } else {
        const failure = jsonRpcFailure(got.v);
        if (failure) {
            const reason = traceUnsupported(failure) ? 'trace unsupported' : 'trace read failed';
            traced = { ok: false, reason };
        } else {
            const mismatch = traceMatchesTx(got.v, tx, receipt);
            if (mismatch) {
                traced = { ok: false, reason: mismatch };
            } else {
                const aligned = attributeTx(got.v, logs, { only: [action.logIndex] });
                if (!aligned.aligned) {
                    traced = { ok: false, reason: aligned.why };
                } else {
                    const attribution = aligned.byLogIndex.get(action.logIndex);
                    traced = attribution
                        ? { ok: true, attribution }
                        : { ok: false, reason: 'attribution missing' };
                }
            }
        }
    }
    // After the trace, not before. A receipt for another transaction rejects the trace.
    const unbound = await traceReceiptBinds(rpc, action, receipt);
    if (unbound) return { ok: false, reason: unbound };
    return traced;
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
 * `attributionSource` is `single:<name>` or `dual:<name>+<name>`. `single:<name>` means the call
 * path was claimed by that one trace provider. `immediateCaller` and `forwardingPath` are
 * unverified hints in that mode: an internally consistent tree that reproduces the receipt logs
 * is accepted, including a forged intermediate frame. Only `transactionSender` (root `from`
 * equals the dual-verified `tx.from`), the root frame (`to`, `input`, and `value` equal the
 * transaction), and `emitter` (the receipt log address) are checked against data both
 * completeness providers agreed on. Any decision that depends on the caller or the path must
 * require `attributionSource` to start with `dual:`.
 *
 * `debug_traceTransaction` selects by transaction hash, not by block. After that call returns,
 * the trace value is read synchronously, then each trace provider's receipt is read again.
 * That re-read must match the dual-verified receipt on `transactionHash`, `blockHash`,
 * `blockNumber`, `transactionIndex`, and `status`. This does not switch to
 * `debug_traceBlockByHash` (availability on our providers is unverified).
 *
 * The decoded JSON is already allocated by the transport, so callers must use a transport with a
 * response-size cap. This module bounds its own work after decoding. A trace above
 * {@link MEASURE_NODES} is rejected whole, even a legitimate one: a prefix is not evidence.
 */
export function traceAttributor(opts: TraceAttributorOptions): {
    attribute(action: FoundAction): Promise<
        { ok: true; attribution: TraceAttribution } | { ok: false; reason: string }
    >;
} {
    const listed = opts.providers;
    if (!listed || listed.length !== 2 || !listed[0] || !listed[1] || listed[0] === listed[1]) {
        throw new Error('guardian audit requires two distinct providers');
    }
    const pa = bindRpc(listed[0]);
    const pb = bindRpc(listed[1]);
    if (pa.name === pb.name) throw new Error('guardian audit requires two distinct providers');
    // Copies of the bound endpoints, not the caller's array. Later writes to that array are not observed.
    const providers = Object.freeze([pa, pb]);
    const traceListed = opts.traceProviders;
    if (!traceListed || (traceListed.length !== 1 && traceListed.length !== 2)) {
        throw new Error('guardian audit requires one or two trace providers');
    }
    if (traceListed.length === 2 && traceListed[0] === traceListed[1]) {
        throw new Error('guardian audit requires two distinct providers');
    }
    const ta = bindRpc(traceListed[0]);
    const tb = traceListed.length === 2 ? bindRpc(traceListed[1]) : undefined;
    if (tb && ta.name === tb.name) throw new Error('guardian audit requires two distinct providers');
    const traces = Object.freeze(tb ? [ta, tb] : [ta]);
    return {
        async attribute(action) {
            const snap = snapAction(action);
            if (!snap) return { ok: false, reason: 'action invalid' };
            try {
                const [sa, sb] = await Promise.all([readSide(providers[0], snap), readSide(providers[1], snap)]);
                if (!sa.ok) return sa;
                if (!sb.ok) return sb;
                if (!sameReceipt(sa.receipt, sb.receipt) || !sameTx(sa.tx, sb.tx)) {
                    return { ok: false, reason: 'providers disagree on the transaction' };
                }
                const traced = await Promise.all(
                    traces.map((rpc) => readTrace(rpc, snap, sa.tx, sa.receipt, sa.logs)),
                );
                const first = traced[0]!;
                if (!first.ok) return first;
                if (!tb) return { ok: true, attribution: seal(first.attribution, `single:${ta.name}`) };
                const second = traced[1]!;
                if (!second.ok) return second;
                if (!sameAttribution(first.attribution, second.attribution)) {
                    return { ok: false, reason: 'trace providers disagree' };
                }
                return { ok: true, attribution: seal(first.attribution, `dual:${ta.name}+${tb.name}`) };
            } catch {
                return { ok: false, reason: 'attribution failed' };
            }
        },
    };
}
