import { keccak256, stringToBytes, type Hex } from 'viem';

/**
 * Byte-stable JSON for evidence digests.
 * Object keys sort by UTF-16 code unit. `undefined` object properties are omitted.
 * An `undefined` array element is an error.
 *
 * Representation (honest reruns must agree on these):
 * - A string value matching `^0x[0-9a-fA-F]*$` is lower-cased. Keys are not. `0X` is not hex.
 * - A bigint is a JSON string of its base-10 digits, so a uint256 is not rounded into a JSON number.
 *   `123n` and the string `'123'` therefore collide by design. A JSON number and a bigint do not:
 *   `canonicalJson(1)` is `1` and `canonicalJson(1n)` is `"1"`.
 * - {@link snapshotPlain} copies caller data before encoding. Each accessor runs once, inside try/catch.
 *   An array's length is read once before any element. Later growth is not walked.
 * - A shared acyclic reference is copied again on each visit. A cycle is rejected.
 *
 * Encoding is iterative. More than {@link MAX_NODES} nodes in the snapshot is rejected.
 * A null-prototype object is plain JSON, same as `Object.prototype`.
 * Encoding stops once the UTF-8 size would pass {@link MAX_EVIDENCE_FILE_BYTES}. The capped text is not joined.
 */
const MAX_NODES = 1_000_000;
/** One string or object key. Checked before the hex regex and before `JSON.stringify`. */
const MAX_STRING = 1_048_576;
/** Nested containers deeper than this are rejected before a recursive walk can overflow. */
const MAX_SNAPSHOT_DEPTH = 32;
/** Decimal form of a larger bigint is not produced. uint256 fits. */
const MAX_BIGINT_BITS = 1024;
const HEX_RE = /^0x[0-9a-fA-F]*$/;

/** Fixed failure for hostile or oversized caller data. The message is constant. There is no cause. */
export class GuardianAuditInputError extends Error {
    constructor() {
        super('input rejected');
        this.name = 'GuardianAuditInputError';
    }
}

export interface SnapshotBudget {
    nodes: number;
    bytes: number;
}

/**
 * Armed by our own throws, then read by a catch that never inspects the caught value.
 * A foreign throw leaves this unset, so the catch builds a fresh `input rejected`.
 * `instanceof` is not used: a proxy's getPrototypeOf trap must not run.
 */
const ARM_NONE = 0;
const ARM_INPUT = 1;
const ARM_OUTPUT = 2;
const ARM_NOTE = 3;
let arm: typeof ARM_NONE | typeof ARM_INPUT | typeof ARM_OUTPUT | typeof ARM_NOTE = ARM_NONE;
let armNote = '';

function clearArm(): void {
    arm = ARM_NONE;
    armNote = '';
}

function rejectInput(): never {
    arm = ARM_INPUT;
    armNote = '';
    throw new GuardianAuditInputError();
}

function rejectCanonical(message: string): never {
    arm = message === 'canonical: output too large' ? ARM_OUTPUT : ARM_NOTE;
    armNote = message;
    throw new Error(message);
}

/** Fresh error for whatever this module armed. Does not read a caught object. */
function rethrowArmed(): never {
    if (arm === ARM_OUTPUT) throw new Error('canonical: output too large');
    if (arm === ARM_NOTE) throw new Error(armNote);
    throw new GuardianAuditInputError();
}

/**
 * Message armed by the last canonical failure, or `input rejected` when the failure was foreign.
 * Clears the arm. The caught object is not an argument.
 */
export function consumeCanonicalFailure(): string {
    const kind = arm;
    const note = armNote;
    clearArm();
    if (kind === ARM_OUTPUT) return 'canonical: output too large';
    if (kind === ARM_NOTE) return note;
    return 'input rejected';
}

interface Counters {
    nodes: number;
    bytes: number;
}

function isBudgetCount(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** One read of each counter. Later walks use the returned locals. */
function copyBudget(budget: SnapshotBudget): Counters {
    let nodes: unknown;
    let bytes: unknown;
    try {
        nodes = budget.nodes;
        bytes = budget.bytes;
    } catch {
        rethrowArmed();
    }
    if (!isBudgetCount(nodes) || !isBudgetCount(bytes)) rejectInput();
    return { nodes, bytes };
}

function commitBudget(budget: SnapshotBudget, counters: Counters): void {
    try {
        budget.nodes = counters.nodes;
        budget.bytes = counters.bytes;
    } catch {
        rethrowArmed();
    }
}

function chargeNodes(counters: Counters, n: number): void {
    counters.nodes += n;
    if (counters.nodes > MAX_NODES) rejectInput();
}

/** Count UTF-8 bytes into `counters`. A string past {@link MAX_STRING} or the file cap is rejected. */
function chargeString(counters: Counters, text: string): void {
    if (text.length > MAX_STRING) rejectInput();
    const room = MAX_EVIDENCE_FILE_BYTES - counters.bytes;
    if (room < 0 || text.length > room) rejectInput();
    let bytes = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        let n: number;
        if (c <= 0x7f) n = 1;
        else if (c <= 0x7ff) n = 2;
        else if (c >= 0xd800 && c <= 0xdbff) {
            const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
            if (next >= 0xdc00 && next <= 0xdfff) {
                n = 4;
                i += 1;
            } else n = 3;
        } else n = 3;
        bytes += n;
        if (bytes > room) rejectInput();
    }
    counters.bytes += bytes;
}

function ownData(value: object, key: string): unknown {
    let desc: PropertyDescriptor | undefined;
    try {
        desc = Object.getOwnPropertyDescriptor(value, key);
    } catch {
        rethrowArmed();
    }
    if (desc === undefined) return undefined;
    if ('value' in desc) return desc.value;
    if (typeof desc.get !== 'function') return undefined;
    try {
        return desc.get.call(value);
    } catch {
        rethrowArmed();
    }
}

function arrayLength(value: unknown[]): number {
    let length = 0;
    try {
        length = value.length;
    } catch {
        rethrowArmed();
    }
    if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) rejectInput();
    return length;
}

function enumerableKeys(counters: Counters, value: object): string[] {
    try {
        const keys: string[] = [];
        for (const key in value) {
            if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
            chargeString(counters, key);
            keys.push(key);
            if (keys.length > MAX_NODES) rejectInput();
        }
        return keys;
    } catch {
        rethrowArmed();
    }
}

interface ValueTask {
    op: 'value';
    value: unknown;
    depth: number;
    element: boolean;
    apply: (v: unknown) => void;
}

interface ArrayTask {
    op: 'array';
    source: unknown[];
    out: unknown[];
    index: number;
    length: number;
    depth: number;
}

interface ObjectTask {
    op: 'object';
    source: object;
    out: Record<string, unknown>;
    keys: string[];
    index: number;
    depth: number;
}

type SnapshotTask = ValueTask | ArrayTask | ObjectTask;

/**
 * One bounded copy of caller data. Objects are null-prototype and written with defineProperty,
 * so an own `__proto__` key stays an own data property. Arrays are real arrays; length is read once.
 * A function is kept by reference and not walked (a classifier is a leaf). Every other non-plain
 * object is rejected. Accessors run once inside try/catch. Any throw or budget breach becomes
 * {@link GuardianAuditInputError} and nothing else.
 * The seen set is the path: a DAG is copied on each visit and a cycle is rejected.
 */
export function snapshotPlain(value: unknown, budget: SnapshotBudget): unknown {
    clearArm();
    return snapshotWalk(value, budget);
}

function snapshotWalk(value: unknown, budget: SnapshotBudget): unknown {
    const counters = copyBudget(budget);
    const seen = new Set<object>();
    const holder: { current: unknown } = { current: undefined };
    const stack: SnapshotTask[] = [{
        op: 'value',
        value,
        depth: 0,
        element: false,
        apply: (v) => { holder.current = v; },
    }];
    while (stack.length > 0) {
        const task = stack.pop()!;
        if (task.op === 'array') {
            if (task.index >= task.length) {
                seen.delete(task.source);
                continue;
            }
            const index = task.index;
            task.index += 1;
            const child = ownData(task.source, String(index));
            stack.push(task);
            stack.push({
                op: 'value',
                value: child,
                depth: task.depth + 1,
                element: true,
                apply: (v) => { task.out[index] = v; },
            });
            continue;
        }
        if (task.op === 'object') {
            let pushed = false;
            while (task.index < task.keys.length) {
                const key = task.keys[task.index]!;
                task.index += 1;
                const child = ownData(task.source, key);
                if (child === undefined) continue;
                stack.push(task);
                stack.push({
                    op: 'value',
                    value: child,
                    depth: task.depth + 1,
                    element: false,
                    apply: (v) => {
                        if (v === undefined) return;
                        Object.defineProperty(task.out, key, {
                            value: v,
                            enumerable: true,
                            writable: true,
                            configurable: true,
                        });
                    },
                });
                pushed = true;
                break;
            }
            if (!pushed) seen.delete(task.source);
            continue;
        }
        if (task.depth > MAX_SNAPSHOT_DEPTH) rejectInput();
        if (task.value === undefined) {
            if (task.element) rejectInput();
            task.apply(undefined);
            continue;
        }
        if (task.value === null || typeof task.value === 'boolean' || typeof task.value === 'number' || typeof task.value === 'bigint') {
            chargeNodes(counters, 1);
            task.apply(task.value);
            continue;
        }
        if (typeof task.value === 'string') {
            chargeNodes(counters, 1);
            chargeString(counters, task.value);
            task.apply(task.value);
            continue;
        }
        if (typeof task.value === 'function') {
            chargeNodes(counters, 1);
            task.apply(task.value);
            continue;
        }
        if (typeof task.value !== 'object') rejectInput();
        chargeNodes(counters, 1);
        if (Array.isArray(task.value)) {
            const length = arrayLength(task.value);
            if (counters.nodes + length > MAX_NODES) rejectInput();
            if (seen.has(task.value)) rejectInput();
            seen.add(task.value);
            const out = new Array<unknown>(length);
            task.apply(out);
            stack.push({ op: 'array', source: task.value, out, index: 0, length, depth: task.depth });
            continue;
        }
        let proto: object | null;
        try {
            proto = Object.getPrototypeOf(task.value);
        } catch {
            rethrowArmed();
        }
        if (proto !== Object.prototype && proto !== null) rejectInput();
        const keys = enumerableKeys(counters, task.value);
        if (counters.nodes + keys.length > MAX_NODES) rejectInput();
        if (seen.has(task.value)) rejectInput();
        seen.add(task.value);
        const out = Object.create(null) as Record<string, unknown>;
        task.apply(out);
        stack.push({ op: 'object', source: task.value, out, keys, index: 0, depth: task.depth });
    }
    commitBudget(budget, counters);
    return holder.current;
}

/** UTF-8 byte cap for one published evidence file. Shared by canonical encoding, serialize, parse, and sha256. */
export const MAX_EVIDENCE_FILE_BYTES = 64 * 1024 * 1024;

type Frame =
    | { op: 'array'; source: unknown[]; length: number; index: number; depth: number; ref: object; comma: boolean }
    | { op: 'object'; keys: string[]; index: number; depth: number; ref: object; comma: boolean };

function plainObject(value: object): boolean {
    let proto: object | null;
    try {
        proto = Object.getPrototypeOf(value);
    } catch {
        rethrowArmed();
    }
    return proto === Object.prototype || proto === null;
}

function cmpKey(a: string, b: string): number {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

/** One read of an already snapshotted value. A leftover accessor cannot escape with its own message. */
function readOwn(value: object, key: string): unknown {
    try {
        const desc = Object.getOwnPropertyDescriptor(value, key);
        if (desc === undefined) return undefined;
        if ('value' in desc) return desc.value;
        if (typeof desc.get === 'function') return desc.get.call(value);
        return undefined;
    } catch {
        rethrowArmed();
    }
}

/**
 * True when `text` is more than `max` UTF-8 bytes.
 * An unpaired surrogate is U+FFFD (3 bytes) and does not consume the next code unit.
 * A real surrogate pair is 4 bytes.
 */
export function exceedsUtf8Bytes(text: string, max: number): boolean {
    if (typeof text !== 'string' || typeof max !== 'number' || !Number.isSafeInteger(max) || max < 0) rejectInput();
    const limit = max;
    let bytes = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        let n: number;
        if (c <= 0x7f) n = 1;
        else if (c <= 0x7ff) n = 2;
        else if (c >= 0xd800 && c <= 0xdbff) {
            const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
            if (next >= 0xdc00 && next <= 0xdfff) {
                n = 4;
                i += 1;
            } else n = 3;
        } else n = 3;
        bytes += n;
        if (bytes > limit) return true;
    }
    return false;
}

export function canonicalJson(value: unknown): string {
    clearArm();
    return encodeCanonical(snapshotPlain(value, { nodes: 0, bytes: 0 }));
}

function encodeCanonical(value: unknown): string {
    const parts: string[] = [];
    const seen = new Set<object>();
    const stack: Frame[] = [];
    let nodes = 0;
    let bytes = 0;

    const charge = (n: number): void => {
        nodes += n;
        if (nodes > MAX_NODES) rejectCanonical('canonical: node budget exceeded');
    };

    const push = (part: string): void => {
        if (exceedsUtf8Bytes(part, MAX_EVIDENCE_FILE_BYTES - bytes)) rejectCanonical('canonical: output too large');
        bytes += utf8Count(part);
        parts.push(part);
    };

    const ownKeys = (obj: object): string[] => {
        const keys: string[] = [];
        for (const key in obj) {
            if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
            charge(1);
            if (key.length > MAX_STRING) rejectCanonical('canonical: string too long');
            keys.push(key);
        }
        keys.sort(cmpKey);
        return keys;
    };

    const write = (v: unknown, depth: number): void => {
        if (depth > MAX_NODES) rejectCanonical('canonical: depth budget exceeded');
        if (v === undefined) rejectCanonical('canonical: undefined value');
        if (v === null) {
            push('null');
            return;
        }
        switch (typeof v) {
            case 'string':
                if (v.length > MAX_STRING) rejectCanonical('canonical: string too long');
                push(JSON.stringify(HEX_RE.test(v) ? v.toLowerCase() : v));
                return;
            case 'boolean':
                push(v ? 'true' : 'false');
                return;
            case 'number':
                if (!Number.isSafeInteger(v)) rejectCanonical('canonical: number must be a safe integer');
                push(Object.is(v, -0) ? '0' : String(v));
                return;
            case 'bigint': {
                const mag = v < 0n ? -v : v;
                if ((mag >> BigInt(MAX_BIGINT_BITS)) !== 0n) rejectCanonical('canonical: bigint too long');
                push(JSON.stringify(v.toString(10)));
                return;
            }
            case 'function':
            case 'symbol':
                rejectCanonical('canonical: unsupported value');
            case 'object':
                break;
            default:
                rejectCanonical('canonical: unsupported value');
        }
        if (seen.has(v)) rejectCanonical('canonical: cycle');
        if (Array.isArray(v)) {
            const length = v.length;
            charge(length);
            seen.add(v);
            push('[');
            stack.push({ op: 'array', source: v, length, index: 0, depth, ref: v, comma: false });
            return;
        }
        if (!plainObject(v)) rejectCanonical('canonical: unsupported value');
        const keys = ownKeys(v);
        seen.add(v);
        push('{');
        stack.push({ op: 'object', keys, index: 0, depth, ref: v, comma: false });
    };

    charge(1);
    write(value, 0);
    while (stack.length) {
        const frame = stack.pop()!;
        if (frame.op === 'array') {
            if (frame.index >= frame.length) {
                push(']');
                seen.delete(frame.ref);
                continue;
            }
            const el = readOwn(frame.source, String(frame.index));
            frame.index += 1;
            if (el === undefined) rejectCanonical('canonical: undefined array element');
            if (frame.comma) push(',');
            frame.comma = true;
            stack.push(frame);
            write(el, frame.depth + 1);
            continue;
        }
        let key = '';
        let child: unknown = undefined;
        while (frame.index < frame.keys.length) {
            key = frame.keys[frame.index]!;
            child = readOwn(frame.ref, key);
            frame.index += 1;
            if (child !== undefined) break;
        }
        if (child === undefined) {
            push('}');
            seen.delete(frame.ref);
            continue;
        }
        if (frame.comma) push(',');
        frame.comma = true;
        push(JSON.stringify(key));
        push(':');
        stack.push(frame);
        write(child, frame.depth + 1);
    }
    return parts.join('');
}

/** Byte length of `text`, which `push` has already proven fits in the remaining budget. */
function utf8Count(text: string): number {
    let bytes = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        if (c <= 0x7f) bytes += 1;
        else if (c <= 0x7ff) bytes += 2;
        else if (c >= 0xd800 && c <= 0xdbff) {
            const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
            if (next >= 0xdc00 && next <= 0xdfff) {
                bytes += 4;
                i += 1;
            } else bytes += 3;
        } else bytes += 3;
    }
    return bytes;
}

/** keccak256 of the UTF-8 bytes of {@link canonicalJson}. */
export function canonicalDigest(value: unknown): Hex {
    return keccak256(stringToBytes(canonicalJson(value)));
}
