import { getAddress, type Address, type Hex } from 'viem';

/**
 * Attribute each receipt log to the call that emitted it, from a callTracer trace (`withLog`).
 * Pure: no I/O. A reverted frame is dropped with its subtree (the receipt drops those logs).
 * CALL / CREATE / CREATE2 enter `to`. DELEGATECALL keeps the caller's storage and msg.sender.
 * CALLCODE keeps the caller's storage but sets msg.sender to the calling frame's context.
 * A successful STATICCALL cannot emit. SELFDESTRUCT is a non-emitting position slot.
 * Any doubt returns aligned: false.
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
    /** msg.sender of the emitting context. */
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
/** SELFDESTRUCT has no execution context. It is not a hop. */
const FRAME_TYPES = [...CALL_TYPES, 'SELFDESTRUCT'] as const;
type FrameType = typeof FRAME_TYPES[number];

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const TOPIC_RE = /^0x[0-9a-fA-F]{64}$/;
/** Flat scan. A repeated `{2}` capture overflows the regex stack on megabyte data. */
const DATA_RE = /^0x[0-9a-fA-F]*$/;
/** One deeper than the EVM's 1024 call frames. A real trace cannot exceed this. */
const MAX_TRACE_DEPTH = 1025;
/** Stop a wide or chatty trace before path materialization can blow up. */
const MAX_FRAMES = 100_000;
const MAX_LOGS = 10_000;
/** Cumulative string bytes across one raw receipt + trace, before any normalization. */
const MAX_LOG_BYTES = 8 * 1024 * 1024;
/** Structural cap for one raw JSON value. Pending stack slots are reserved up front. */
export const MEASURE_NODES = 250_000;
export const MEASURE_BYTES = MAX_LOG_BYTES;
const ZERO = '0x0000000000000000000000000000000000000000' as Address;

function lc(v: unknown): string {
    return typeof v === 'string' ? v.toLowerCase() : '';
}

function asAddress(v: unknown): Address | null {
    if (typeof v !== 'string' || !ADDR_RE.test(v)) return null;
    return getAddress(v);
}

function frameType(v: unknown): FrameType | null {
    if (typeof v !== 'string') return null;
    const upper = v.toUpperCase();
    return (FRAME_TYPES as readonly string[]).includes(upper) ? upper as FrameType : null;
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
        && typeof o.data === 'string' && o.data.length % 2 === 0 && DATA_RE.test(o.data);
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
 * One iterative walk of a raw JSON value. Charges 1 node for the value itself, for each array
 * element, and for each object property; charges string length to bytes. `array.length` and the
 * object key count are compared to the remaining node budget before anything is pushed, so a wide
 * array cannot be enqueued while earlier siblings are still pending. Returns false at the first exceed.
 * Depth cannot outrun the node budget: every stacked value already spent a node.
 */
export function measure(value: unknown, budget: { nodes: number; bytes: number }): boolean {
    const st: unknown[] = [];
    const reserve = (n: number): boolean => {
        if (n > budget.nodes) return false;
        budget.nodes -= n;
        return true;
    };
    if (!reserve(1)) return false;
    st.push(value);
    while (st.length) {
        const v = st.pop()!;
        if (typeof v === 'string') {
            budget.bytes -= v.length;
            if (budget.bytes < 0) return false;
            continue;
        }
        if (v === null || typeof v !== 'object') continue;
        if (Array.isArray(v)) {
            // Pending stack entries were already reserved, so `budget.nodes` is what remains.
            // The frame cap is the same idea for call arrays: a wide `calls` list must not be
            // enqueued while earlier siblings are still queued.
            if (v.length > budget.nodes || v.length > MAX_FRAMES - st.length) return false;
            budget.nodes -= v.length;
            // Push low indices first so the last child is visited first, matching traceShape.
            for (let i = 0; i < v.length; i++) st.push(v[i]);
            continue;
        }
        const keys = Object.keys(v);
        if (!reserve(keys.length)) return false;
        for (let i = keys.length - 1; i >= 0; i--) st.push((v as Record<string, unknown>)[keys[i]!]);
    }
    return true;
}

/**
 * Iterative. `calls` / `logs`, when present, must be arrays — an object with `length` is not a trace.
 * Every child counts as a frame, including null and other non-objects. A `calls` array longer than
 * the remaining frame budget (visited frames and frames already queued) is rejected before any child
 * is visited. Reverted subtrees still count.
 */
function traceShape(trace: unknown): string | null {
    let frames = 0;
    let logs = 0;
    const st: [unknown, number][] = [[trace, 1]];
    while (st.length) {
        const [f, d] = st.pop()!;
        frames++;
        if (frames > MAX_FRAMES) return 'trace too large';
        if (!f || typeof f !== 'object') return 'trace frame malformed';
        if (d > MAX_TRACE_DEPTH) return 'trace deeper than 1025';
        const o = f as Record<string, unknown>;
        if (o.calls !== undefined && o.calls !== null && !Array.isArray(o.calls)) return 'trace calls are not an array';
        if (o.logs !== undefined && o.logs !== null && !Array.isArray(o.logs)) return 'trace logs are not an array';
        if (Array.isArray(o.logs)) {
            logs += o.logs.length;
            if (logs > MAX_LOGS) return 'trace too large';
        }
        if (Array.isArray(o.calls)) {
            if (o.calls.length > MAX_FRAMES - frames - st.length) return 'trace too large';
            for (const c of o.calls) st.push([c, d + 1]);
        }
    }
    return null;
}

/** Lengths only. Does not lowercase or run the data regex. */
function exceedsLogBytes(trace: unknown, receiptLogs: unknown[]): boolean {
    let used = 0;
    let frames = 0;
    const take = (logs: unknown): boolean => {
        if (!Array.isArray(logs)) return false;
        for (const l of logs) {
            if (l === null || typeof l !== 'object') continue;
            const o = l as Record<string, unknown>;
            if (typeof o.data === 'string') {
                used += o.data.length;
                if (used > MAX_LOG_BYTES) return true;
            }
            if (Array.isArray(o.topics)) {
                if (o.topics.length > 4) return true;
                for (const t of o.topics) {
                    if (typeof t !== 'string') continue;
                    used += t.length;
                    if (used > MAX_LOG_BYTES) return true;
                }
            }
        }
        return false;
    };
    const st: unknown[] = [trace];
    while (st.length) {
        const f = st.pop();
        if (!f || typeof f !== 'object') continue;
        frames++;
        const o = f as Record<string, unknown>;
        if (take(o.logs)) return true;
        if (Array.isArray(o.calls)) {
            if (o.calls.length > MAX_FRAMES - frames - st.length) return true;
            for (let i = 0; i < o.calls.length; i++) st.push(o.calls[i]);
        }
    }
    return take(receiptLogs);
}

/** Shared ancestry. The array is built only for a log that is actually emitted. */
interface PathLink {
    hop: CallHop;
    parent: PathLink | null;
}

interface Info {
    context: Address;
    /** msg.sender while this frame executes. */
    msgSender: Address;
    transactionSender: Address;
    path: PathLink | null;
    kind: CallType | null;
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
    return { context: ZERO, msgSender: ZERO, transactionSender: ZERO, path: null, kind: null };
}

function doneFrame(): FrameNode {
    return { emit: [], has: false, logs: [], calls: [], info: emptyInfo() };
}

function pathOf(tail: PathLink | null): CallHop[] {
    const hops: CallHop[] = [];
    for (let link = tail; link; link = link.parent) hops.push(link.hop);
    hops.reverse();
    return hops;
}

function flatten(trace: unknown): { logs: FlatLog[] } | { why: string } {
    let why: string | null = null;
    let frames = 0;
    const note = (w: string) => {
        why ??= w;
    };

    const enter = (f: unknown, parent: Info | null): FrameNode => {
        frames++;
        if (!f || typeof f !== 'object') {
            note('trace frame malformed');
            return doneFrame();
        }
        const o = f as Record<string, unknown>;
        // Receipt omits logs from a reverted frame and from everything it called.
        if (o.error) return doneFrame();

        const type = frameType(o.type);
        const from = asAddress(o.from);
        const to = asAddress(o.to);
        const logs = Array.isArray(o.logs) ? o.logs : [];
        const calls = Array.isArray(o.calls) ? o.calls : [];
        // Beneficiary is not an execution context. The frame still occupies a position slot.
        if (type === 'SELFDESTRUCT') {
            if (!from || !to) note('trace frame address malformed');
            if (logs.length > 0 || calls.length > 0) note('selfdestruct frame has logs or children');
            return doneFrame();
        }
        if (!type) note('trace frame type invalid');
        if (!from || !to) note('trace frame address malformed');

        const hop: CallHop | null = type && from && to
            ? { type, from, to, selector: selectorOf(o.input) }
            : null;
        const link: PathLink | null = hop ? { hop, parent: parent?.path ?? null } : (parent?.path ?? null);
        let info: Info;
        if (type === 'DELEGATECALL' || type === 'CALLCODE') {
            if (!parent) note(type === 'CALLCODE' ? 'callcode at trace root' : 'delegatecall at trace root');
            // Storage stays with the caller. CALLCODE, unlike DELEGATECALL, sets msg.sender
            // to the calling frame's context. Later delegatecalls inherit that sender.
            info = {
                context: parent ? parent.context : ZERO,
                msgSender: type === 'CALLCODE'
                    ? (parent ? parent.context : ZERO)
                    : (parent ? parent.msgSender : ZERO),
                transactionSender: parent ? parent.transactionSender : (from ?? ZERO),
                path: link,
                kind: type,
            };
        } else if (hop && from && to) {
            info = {
                context: to,
                msgSender: from,
                transactionSender: parent ? parent.transactionSender : from,
                path: link,
                kind: type,
            };
        } else {
            info = parent
                ? { ...parent, path: link }
                : { context: to ?? ZERO, msgSender: from ?? ZERO, transactionSender: from ?? ZERO, path: null, kind: null };
        }

        return { emit: null, has: false, logs, calls, info };
    };

    const exit = (node: FrameNode, childNodes: FrameNode[]): void => {
        const { logs, calls, info } = node;
        let missing = false;
        let present = false;
        for (const l of logs) {
            if (missingPos(l)) missing = true;
            else present = true;
        }
        // One frame may not mix "no position" with an explicit position: the array order and
        // the buckets would disagree. All-missing logs stay "after the children".
        if (missing && present) note('trace log positions are mixed');
        else if (missing && childNodes.some((c) => c.has)) note('trace logs lack positions');
        // Static context propagates. A surviving log anywhere under the frame is impossible.
        if (info.kind === 'STATICCALL' && (logs.length > 0 || childNodes.some((c) => c.has))) {
            note('staticcall emitted a log');
        }
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
            // Same budget as traceShape. Checked once, before any child is read: entering
            // children increases `frames`, which would make a later check a false positive.
            if (top.i === 0 && top.node.calls.length > MAX_FRAMES - frames) return { why: 'trace too large' };
            const raw = top.node.calls[top.i]!;
            if (!raw || typeof raw !== 'object') return { why: 'trace frame malformed' };
            top.i++;
            const child = enter(raw, top.node.info);
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
                        immediateCaller: x.info.msgSender,
                        forwardingPath: pathOf(x.info.path),
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
    if (Array.isArray(receiptLogs) && receiptLogs.length > MAX_LOGS) {
        return { aligned: false, why: 'trace too large' };
    }
    const budget = { nodes: MEASURE_NODES, bytes: MEASURE_BYTES };
    if (!measure(trace, budget) || !measure(receiptLogs, budget)) {
        return { aligned: false, why: 'trace too large' };
    }
    if (!trace || typeof trace !== 'object') return { aligned: false, why: 'no trace' };
    const shape = traceShape(trace);
    if (shape) return { aligned: false, why: shape };
    if (!Array.isArray(receiptLogs)) return { aligned: false, why: 'receipt logs are not an array' };
    if (receiptLogs.length > MAX_LOGS) return { aligned: false, why: 'trace too large' };
    if (exceedsLogBytes(trace, receiptLogs)) return { aligned: false, why: 'trace too large' };

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
