import { attributeTx, MEASURE_BYTES, MEASURE_NODES, measure, receiptPos, sameLog, type LogAttribution } from './attribute.js';
import { quantity, type RawRpc } from './rpc.js';
import type { Attributor, FoundAction } from './scan.js';

const TRACE_OPTS = { tracer: 'callTracer', tracerConfig: { withLog: true } } as const;

/**
 * The node has no `debug_traceTransaction` / callTracer (not a transient failure).
 * -32601 method not found, -32600 invalid request (tracer config rejected).
 * The message is only classified here — it never becomes part of a reason.
 */
function traceUnsupported(e: unknown): boolean {
    const o = (e ?? {}) as {
        error?: { code?: unknown; message?: unknown };
        info?: { error?: { code?: unknown; message?: unknown } };
        code?: unknown;
        shortMessage?: unknown;
        message?: unknown;
    };
    const codes = [o.error?.code, o.info?.error?.code, o.code];
    if (codes.includes(-32601) || codes.includes(-32600)) return true;
    const msg = [o.error?.message, o.info?.error?.message, o.shortMessage, o.message]
        .filter((x): x is string => typeof x === 'string')
        .join(' ');
    return /(method|namespace)\b.{0,60}\b(not found|does not exist|not available|not supported|unsupported|disabled|not allowed)|unknown tracer|tracer\b.{0,30}\bnot (found|supported)/i.test(msg);
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

type Read =
    | { ok: true; trace: unknown; logs: unknown[] }
    | { ok: false; reason: string };

async function readProvider(rpc: RawRpc, action: FoundAction): Promise<Read> {
    const tx = action.txHash;
    const [receiptR, traceR] = await Promise.all([
        rpc.request({ method: 'eth_getTransactionReceipt', params: [tx] }).then(
            (v) => ({ ok: true as const, v }),
            () => ({ ok: false as const }),
        ),
        rpc.request({ method: 'debug_traceTransaction', params: [tx, TRACE_OPTS] }).then(
            (v) => ({ ok: true as const, v }),
            (e: unknown) => ({ ok: false as const, e }),
        ),
    ]);
    if (!receiptR.ok) return { ok: false, reason: `receipt read failed on ${rpc.name}` };
    if (!traceR.ok) {
        const reason = traceUnsupported(traceR.e) ? `trace unsupported on ${rpc.name}` : `trace read failed on ${rpc.name}`;
        return { ok: false, reason };
    }
    // Before checkReceipt, sameLog, attributeTx, or any other walk of the payloads.
    const budget = { nodes: MEASURE_NODES, bytes: MEASURE_BYTES };
    if (!measure(receiptR.v, budget) || !measure(traceR.v, budget)) {
        return { ok: false, reason: 'trace too large' };
    }
    const failure = jsonRpcFailure(traceR.v);
    if (failure) {
        const reason = traceUnsupported(failure) ? `trace unsupported on ${rpc.name}` : `trace read failed on ${rpc.name}`;
        return { ok: false, reason };
    }
    const checked = checkReceipt(receiptR.v, action, rpc.name);
    if ('reason' in checked) return { ok: false, reason: checked.reason };
    return { ok: true, trace: traceR.v, logs: checked.logs };
}

/** Attribute a found action from both providers' receipts and callTracer traces. */
export function traceAttributor(opts: { providers: readonly [RawRpc, RawRpc] }): Attributor {
    const [a, b] = opts.providers;
    return {
        async attribute(action) {
            try {
                const [ra, rb] = await Promise.all([readProvider(a, action), readProvider(b, action)]);
                if (!ra.ok) return ra;
                if (!rb.ok) return rb;
                const aa = attributeTx(ra.trace, ra.logs);
                const bb = attributeTx(rb.trace, rb.logs);
                if (!aa.aligned) return { ok: false, reason: aa.why };
                if (!bb.aligned) return { ok: false, reason: bb.why };
                const la = aa.byLogIndex.get(action.logIndex);
                const lb = bb.byLogIndex.get(action.logIndex);
                if (!la) return { ok: false, reason: `attribution missing on ${a.name}` };
                if (!lb) return { ok: false, reason: `attribution missing on ${b.name}` };
                if (!sameAttribution(la, lb)) return { ok: false, reason: 'providers disagree on attribution' };
                return { ok: true, attribution: la };
            } catch {
                return { ok: false, reason: 'attribution failed' };
            }
        },
    };
}
