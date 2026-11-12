import { getAddress, type Address, type Hex } from 'viem';

/**
 * Attribute each receipt log to the call that emitted it, from a callTracer trace (`withLog`).
 * Pure: no I/O. A reverted frame is dropped with its subtree (the receipt drops those logs).
 * CALL / STATICCALL / CREATE / CREATE2 enter `to`. DELEGATECALL / CALLCODE keep the caller's
 * storage context and msg.sender, so a module log is still the proxy's. Any doubt returns aligned: false.
 */

export interface CallHop {
    type: 'CALL' | 'DELEGATECALL' | 'STATICCALL' | 'CALLCODE' | 'CREATE' | 'CREATE2';
    from: Address;
    to: Address;
    selector: Hex | null;
}

export interface LogAttribution {
    /** Root frame `from`. */
    transactionSender: Address;
    /** `from` of the nearest frame that entered the emitter's context by a non-delegate call. */
    immediateCaller: Address;
    /** Root frame through the emitting frame, delegatecalls included. */
    forwardingPath: CallHop[];
    /** Storage context of the emitting frame. Equals the log address when aligned. */
    emitter: Address;
}

export type AttributeTxResult =
    | { aligned: true; byLogIndex: Map<number, LogAttribution> }
    | { aligned: false; why: string };

const CALL_TYPES = ['CALL', 'DELEGATECALL', 'STATICCALL', 'CALLCODE', 'CREATE', 'CREATE2'] as const;
type CallType = typeof CALL_TYPES[number];

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const TOPIC_RE = /^0x[0-9a-fA-F]{64}$/;
const DATA_RE = /^0x([0-9a-fA-F]{2})*$/;
/** One deeper than the EVM's 1024 call frames. A real trace cannot exceed this. */
const MAX_TRACE_DEPTH = 1025;
const ZERO = '0x0000000000000000000000000000000000000000' as Address;

function lc(v: unknown): string {
    return typeof v === 'string' ? v.toLowerCase() : '';
}

function asAddress(v: unknown): Address | null {
    if (typeof v !== 'string' || !ADDR_RE.test(v)) return null;
    return getAddress(v);
}

function callType(v: unknown): CallType | null {
    if (typeof v !== 'string') return null;
    const upper = v.toUpperCase();
    return (CALL_TYPES as readonly string[]).includes(upper) ? upper as CallType : null;
}

function selectorOf(input: unknown): Hex | null {
    if (typeof input !== 'string') return null;
    const m = /^0x[0-9a-fA-F]{8}/.exec(input);
    return m ? m[0].toLowerCase() as Hex : null;
}

/** Non-negative safe integer, or a decimal / 0x string of one. Nothing else. */
function parsePosition(v: unknown): number | null {
    if (typeof v === 'number') return Number.isSafeInteger(v) && v >= 0 ? v : null;
    if (typeof v !== 'string' || !/^(0x[0-9a-fA-F]+|[0-9]+)$/.test(v)) return null;
    const n = Number(v);
    return Number.isSafeInteger(n) ? n : null;
}

/** `index` (ethers v6) or `logIndex`. Both present must agree. */
export function receiptPos(l: unknown): number | null {
    if (l === null || typeof l !== 'object') return null;
    const o = l as Record<string, unknown>;
    const has = (k: string) => o[k] !== undefined && o[k] !== null;
    const a = has('index') ? parsePosition(o.index) : undefined;
    const b = has('logIndex') ? parsePosition(o.logIndex) : undefined;
    if (a === null || b === null) return null;
    if (a !== undefined && b !== undefined && a !== b) return null;
    return a ?? b ?? null;
}

function validLog(l: unknown): l is { address: string; topics: string[]; data: string } {
    if (l === null || typeof l !== 'object') return false;
    const o = l as Record<string, unknown>;
    return typeof o.address === 'string' && ADDR_RE.test(o.address)
        && Array.isArray(o.topics) && o.topics.length <= 4
        && o.topics.every((t) => typeof t === 'string' && TOPIC_RE.test(t))
        && typeof o.data === 'string' && DATA_RE.test(o.data);
}

export function sameLog(t: unknown, r: unknown): boolean {
    if (!validLog(t) || !validLog(r)) return false;
    if (lc(t.address) !== lc(r.address) || lc(t.data) !== lc(r.data)) return false;
    if (t.topics.length !== r.topics.length) return false;
    return t.topics.every((topic, i) => lc(topic) === lc(r.topics[i]));
}

function missingPos(l: unknown): boolean {
    if (l === null || typeof l !== 'object') return true;
    const p = (l as { position?: unknown }).position;
    return p === undefined || p === null;
}

/**
 * Iterative. `calls` / `logs`, when present, must be arrays — an object with `length` is not a trace.
 * Reverted subtrees still count toward the depth cap: they are part of the payload.
 */
function traceShape(trace: unknown): string | null {
    const st: [unknown, number][] = [[trace, 1]];
    while (st.length) {
        const [f, d] = st.pop()!;
        if (!f || typeof f !== 'object') continue;
        if (d > MAX_TRACE_DEPTH) return 'trace deeper than 1025';
        const o = f as Record<string, unknown>;
        if (o.calls !== undefined && o.calls !== null && !Array.isArray(o.calls)) return 'trace calls are not an array';
        if (o.logs !== undefined && o.logs !== null && !Array.isArray(o.logs)) return 'trace logs are not an array';
        if (Array.isArray(o.calls)) for (const c of o.calls) st.push([c, d + 1]);
    }
    return null;
}

interface Info {
    context: Address;
    enteredBy: Address;
    transactionSender: Address;
    path: CallHop[];
}

interface FrameNode {
    /** null until the frame's children have been exited. `[]` for a frame that emits nothing. */
    emit: Array<{ bucket: unknown[]; info: Info } | FrameNode> | null;
    has: boolean;
    logs: unknown[];
    calls: unknown[];
    info: Info;
}

interface FlatLog {
    raw: unknown;
    attribution: LogAttribution;
}

function emptyInfo(): Info {
    return { context: ZERO, enteredBy: ZERO, transactionSender: ZERO, path: [] };
}

function doneFrame(): FrameNode {
    return { emit: [], has: false, logs: [], calls: [], info: emptyInfo() };
}

function flatten(trace: unknown): { logs: FlatLog[] } | { why: string } {
    let why: string | null = null;
    const note = (w: string) => {
        why ??= w;
    };

    const enter = (f: unknown, parent: Info | null): FrameNode => {
        if (!f || typeof f !== 'object') {
            note('trace frame malformed');
            return doneFrame();
        }
        const o = f as Record<string, unknown>;
        // Receipt omits logs from a reverted frame and from everything it called.
        if (o.error) return doneFrame();

        const type = callType(o.type);
        const from = asAddress(o.from);
        const to = asAddress(o.to);
        if (!type) note('trace frame type invalid');
        if (!from || !to) note('trace frame address malformed');

        const hop: CallHop | null = type && from && to
            ? { type, from, to, selector: selectorOf(o.input) }
            : null;
        const delegate = type === 'DELEGATECALL' || type === 'CALLCODE';
        let info: Info;
        if (delegate) {
            if (!parent) note('delegatecall at trace root');
            // Context and msg.sender stay with the caller. `to` is code, not storage.
            info = {
                context: parent ? parent.context : ZERO,
                enteredBy: parent ? parent.enteredBy : ZERO,
                transactionSender: parent ? parent.transactionSender : (from ?? ZERO),
                path: parent && hop ? [...parent.path, hop] : (parent ? [...parent.path] : []),
            };
        } else if (hop && from && to) {
            info = {
                context: to,
                enteredBy: from,
                transactionSender: parent ? parent.transactionSender : from,
                path: [...(parent?.path ?? []), hop],
            };
        } else {
            info = parent
                ? { ...parent, path: [...parent.path] }
                : { context: to ?? ZERO, enteredBy: from ?? ZERO, transactionSender: from ?? ZERO, path: [] };
        }

        return {
            emit: null,
            has: false,
            logs: Array.isArray(o.logs) ? o.logs : [],
            calls: Array.isArray(o.calls) ? o.calls : [],
            info,
        };
    };

    const exit = (node: FrameNode, childNodes: FrameNode[]): void => {
        const { logs, calls, info } = node;
        // A missing position is "after the children", unambiguous only when no child kept a log.
        if (logs.some(missingPos) && childNodes.some((c) => c.has)) note('trace logs lack positions');
        const callCount = calls.length;
        const buckets: unknown[][] = Array.from({ length: callCount + 1 }, () => []);
        let prev = 0;
        for (const l of logs) {
            if (missingPos(l)) {
                buckets[callCount]!.push(l);
                continue;
            }
            const p = parsePosition((l as { position?: unknown }).position);
            // [0, calls.length], never decreasing. Do not repair a malformed trace.
            if (p === null || p > callCount || p < prev) note('trace log position invalid or out of order');
            else {
                prev = p;
                buckets[p]!.push(l);
            }
        }
        const emit: NonNullable<FrameNode['emit']> = [];
        for (let k = 0; k <= callCount; k++) {
            emit.push({ bucket: buckets[k]!, info });
            if (k < callCount) emit.push(childNodes[k]!);
        }
        node.emit = emit;
        node.has = logs.length > 0 || childNodes.some((c) => c.has);
    };

    const root = enter(trace, null);
    const st: { node: FrameNode; kids: FrameNode[]; i: number }[] = [{ node: root, kids: [], i: 0 }];
    while (st.length) {
        const top = st[st.length - 1]!;
        if (top.node.emit === null && top.i < top.node.calls.length) {
            const child = enter(top.node.calls[top.i++]!, top.node.info);
            top.kids.push(child);
            if (child.emit === null) st.push({ node: child, kids: [], i: 0 });
            continue;
        }
        st.pop();
        if (top.node.emit === null) exit(top.node, top.kids);
    }

    const out: FlatLog[] = [];
    const em: Array<{ bucket: unknown[]; info: Info } | FrameNode> = [root];
    while (em.length) {
        const x = em.pop()!;
        if ('bucket' in x) {
            for (const l of x.bucket) {
                const addr = l !== null && typeof l === 'object' ? (l as { address?: unknown }).address : undefined;
                if (lc(addr) !== lc(x.info.context)) note('log address is not its frame\'s context');
                out.push({
                    raw: l,
                    attribution: {
                        transactionSender: x.info.transactionSender,
                        immediateCaller: x.info.enteredBy,
                        forwardingPath: x.info.path,
                        emitter: x.info.context,
                    },
                });
            }
        } else if (x.emit) {
            for (let k = x.emit.length - 1; k >= 0; k--) em.push(x.emit[k]!);
        }
    }
    if (why) return { why };
    return { logs: out };
}

/**
 * Receipt positions (`index` or `logIndex`) must be strict, unique and contiguous.
 * Flattened trace logs, in emission order, must then equal those receipt logs 1:1.
 */
export function attributeTx(trace: unknown, receiptLogs: unknown[]): AttributeTxResult {
    if (!trace || typeof trace !== 'object') return { aligned: false, why: 'no trace' };
    const shape = traceShape(trace);
    if (shape) return { aligned: false, why: shape };
    if (!Array.isArray(receiptLogs)) return { aligned: false, why: 'receipt logs are not an array' };

    const pos = receiptLogs.map(receiptPos);
    const valid = pos.every((p) => p !== null) && new Set(pos).size === pos.length;
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of pos) {
        if (p === null) continue;
        if (p < lo) lo = p;
        if (p > hi) hi = p;
    }
    if (!valid || (pos.length > 0 && hi - lo + 1 !== pos.length)) {
        return { aligned: false, why: 'receipt log positions invalid or duplicated' };
    }

    const flat = flatten(trace);
    if ('why' in flat) return { aligned: false, why: flat.why };

    const rl = new Array<unknown>(receiptLogs.length);
    for (let i = 0; i < receiptLogs.length; i++) rl[pos[i]! - lo] = receiptLogs[i];
    if (flat.logs.length !== rl.length) {
        return { aligned: false, why: `trace has ${flat.logs.length} logs, receipt ${rl.length}` };
    }

    const byLogIndex = new Map<number, LogAttribution>();
    for (let i = 0; i < rl.length; i++) {
        if (!sameLog(flat.logs[i]!.raw, rl[i])) {
            return { aligned: false, why: `log ${i} differs between trace and receipt` };
        }
        byLogIndex.set(receiptPos(rl[i])!, flat.logs[i]!.attribution);
    }
    return { aligned: true, byLogIndex };
}
