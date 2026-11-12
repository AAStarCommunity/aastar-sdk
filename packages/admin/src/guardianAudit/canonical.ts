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
 * - Each own property value is snapshotted once, at the moment it is encoded. A getter runs once per visit.
 * - An array's length is snapshotted once before any element is read. Later growth is not walked.
 *
 * Iterative. One node for the root, one for each array element, one for each own property
 * (the same accounting as `measure` in attribute.ts). More than {@link MAX_NODES} throws.
 * Depth shares that cap. A cycle throws; a shared acyclic reference is written twice.
 * A null-prototype object is plain JSON, same as `Object.prototype`.
 * Encoding stops once the UTF-8 size would pass {@link MAX_EVIDENCE_FILE_BYTES}. The capped text is not joined.
 */
const MAX_NODES = 1_000_000;
/** One string or object key. Checked before the hex regex and before `JSON.stringify`. */
const MAX_STRING = 1_048_576;
/** Decimal form of a larger bigint is not produced. uint256 fits. */
const MAX_BIGINT_BITS = 1024;
const HEX_RE = /^0x[0-9a-fA-F]*$/;

/** UTF-8 byte cap for one published evidence file. Shared by canonical encoding, serialize, parse, and sha256. */
export const MAX_EVIDENCE_FILE_BYTES = 64 * 1024 * 1024;

type Frame =
    | { op: 'array'; source: unknown[]; length: number; index: number; depth: number; ref: object; comma: boolean }
    | { op: 'object'; keys: string[]; index: number; depth: number; ref: object; comma: boolean };

function plainObject(value: object): boolean {
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

function cmpKey(a: string, b: string): number {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

/** One read. Bracket access would treat an own `__proto__` key as the prototype. */
function readOwn(value: object, key: string): unknown {
    const desc = Object.getOwnPropertyDescriptor(value, key);
    if (desc === undefined) return undefined;
    if ('value' in desc) return desc.value;
    if (typeof desc.get === 'function') return desc.get.call(value);
    return undefined;
}

/**
 * True when `text` is more than `max` UTF-8 bytes.
 * An unpaired surrogate is U+FFFD (3 bytes) and does not consume the next code unit.
 * A real surrogate pair is 4 bytes.
 */
export function exceedsUtf8Bytes(text: string, max: number): boolean {
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
        if (bytes > max) return true;
    }
    return false;
}

export function canonicalJson(value: unknown): string {
    const parts: string[] = [];
    const seen = new Set<object>();
    const stack: Frame[] = [];
    let nodes = 0;
    let bytes = 0;

    const charge = (n: number): void => {
        nodes += n;
        if (nodes > MAX_NODES) throw new Error('canonical: node budget exceeded');
    };

    const push = (part: string): void => {
        if (exceedsUtf8Bytes(part, MAX_EVIDENCE_FILE_BYTES - bytes)) throw new Error('canonical: output too large');
        bytes += utf8Count(part);
        parts.push(part);
    };

    const ownKeys = (obj: object): string[] => {
        const keys: string[] = [];
        for (const key in obj) {
            if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
            charge(1);
            if (key.length > MAX_STRING) throw new Error('canonical: string too long');
            keys.push(key);
        }
        keys.sort(cmpKey);
        return keys;
    };

    const write = (v: unknown, depth: number): void => {
        if (depth > MAX_NODES) throw new Error('canonical: depth budget exceeded');
        if (v === undefined) throw new Error('canonical: undefined value');
        if (v === null) {
            push('null');
            return;
        }
        switch (typeof v) {
            case 'string':
                if (v.length > MAX_STRING) throw new Error('canonical: string too long');
                push(JSON.stringify(HEX_RE.test(v) ? v.toLowerCase() : v));
                return;
            case 'boolean':
                push(v ? 'true' : 'false');
                return;
            case 'number':
                if (!Number.isSafeInteger(v)) throw new Error('canonical: number must be a safe integer');
                push(Object.is(v, -0) ? '0' : String(v));
                return;
            case 'bigint': {
                const mag = v < 0n ? -v : v;
                if ((mag >> BigInt(MAX_BIGINT_BITS)) !== 0n) throw new Error('canonical: bigint too long');
                push(JSON.stringify(v.toString(10)));
                return;
            }
            case 'function':
            case 'symbol':
                throw new Error('canonical: unsupported value');
            case 'object':
                break;
            default:
                throw new Error('canonical: unsupported value');
        }
        if (seen.has(v)) throw new Error('canonical: cycle');
        if (Array.isArray(v)) {
            const length = v.length;
            charge(length);
            seen.add(v);
            push('[');
            stack.push({ op: 'array', source: v, length, index: 0, depth, ref: v, comma: false });
            return;
        }
        if (!plainObject(v)) throw new Error('canonical: unsupported value');
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
            if (el === undefined) throw new Error('canonical: undefined array element');
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
