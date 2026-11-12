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
 * - Each own property value is snapshotted once. A getter runs once per visit.
 *
 * Iterative. One node for the root, one for each array element, one for each own property
 * (the same accounting as `measure` in attribute.ts). More than {@link MAX_NODES} throws.
 * Depth shares that cap. A cycle throws; a shared acyclic reference is written twice.
 * A null-prototype object is plain JSON, same as `Object.prototype`.
 */
const MAX_NODES = 1_000_000;
/** One string or object key. Checked before the hex regex and before `JSON.stringify`. */
const MAX_STRING = 1_048_576;
/** Decimal form of a larger bigint is not produced. uint256 fits. */
const MAX_BIGINT_BITS = 1024;
const HEX_RE = /^0x[0-9a-fA-F]*$/;

type Entry = { key: string; value: unknown };
type Frame =
    | { op: 'array'; items: unknown[]; index: number; depth: number; ref: object; comma: boolean }
    | { op: 'object'; entries: Entry[]; index: number; depth: number; ref: object; comma: boolean };

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

export function canonicalJson(value: unknown): string {
    const parts: string[] = [];
    const seen = new Set<object>();
    const stack: Frame[] = [];
    let nodes = 0;

    const charge = (n: number): void => {
        nodes += n;
        if (nodes > MAX_NODES) throw new Error('canonical: node budget exceeded');
    };

    const ownEntries = (obj: object): Entry[] => {
        const entries: Entry[] = [];
        for (const key in obj) {
            if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
            charge(1);
            if (key.length > MAX_STRING) throw new Error('canonical: string too long');
            entries.push({ key, value: readOwn(obj, key) });
        }
        entries.sort((a, b) => cmpKey(a.key, b.key));
        return entries;
    };

    const write = (v: unknown, depth: number): void => {
        if (depth > MAX_NODES) throw new Error('canonical: depth budget exceeded');
        if (v === undefined) throw new Error('canonical: undefined value');
        if (v === null) {
            parts.push('null');
            return;
        }
        switch (typeof v) {
            case 'string':
                if (v.length > MAX_STRING) throw new Error('canonical: string too long');
                parts.push(JSON.stringify(HEX_RE.test(v) ? v.toLowerCase() : v));
                return;
            case 'boolean':
                parts.push(v ? 'true' : 'false');
                return;
            case 'number':
                if (!Number.isSafeInteger(v)) throw new Error('canonical: number must be a safe integer');
                parts.push(Object.is(v, -0) ? '0' : String(v));
                return;
            case 'bigint': {
                const mag = v < 0n ? -v : v;
                if ((mag >> BigInt(MAX_BIGINT_BITS)) !== 0n) throw new Error('canonical: bigint too long');
                parts.push(JSON.stringify(v.toString(10)));
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
            charge(v.length);
            seen.add(v);
            parts.push('[');
            stack.push({ op: 'array', items: v, index: 0, depth, ref: v, comma: false });
            return;
        }
        if (!plainObject(v)) throw new Error('canonical: unsupported value');
        const entries = ownEntries(v);
        seen.add(v);
        parts.push('{');
        stack.push({ op: 'object', entries, index: 0, depth, ref: v, comma: false });
    };

    charge(1);
    write(value, 0);
    while (stack.length) {
        const frame = stack.pop()!;
        if (frame.op === 'array') {
            if (frame.index >= frame.items.length) {
                parts.push(']');
                seen.delete(frame.ref);
                continue;
            }
            const el = readOwn(frame.items, String(frame.index));
            frame.index += 1;
            if (el === undefined) throw new Error('canonical: undefined array element');
            if (frame.comma) parts.push(',');
            frame.comma = true;
            stack.push(frame);
            write(el, frame.depth + 1);
            continue;
        }
        while (frame.index < frame.entries.length && frame.entries[frame.index]!.value === undefined) frame.index += 1;
        if (frame.index >= frame.entries.length) {
            parts.push('}');
            seen.delete(frame.ref);
            continue;
        }
        const entry = frame.entries[frame.index]!;
        frame.index += 1;
        if (frame.comma) parts.push(',');
        frame.comma = true;
        parts.push(JSON.stringify(entry.key), ':');
        stack.push(frame);
        write(entry.value, frame.depth + 1);
    }
    return parts.join('');
}

/** keccak256 of the UTF-8 bytes of {@link canonicalJson}. */
export function canonicalDigest(value: unknown): Hex {
    return keccak256(stringToBytes(canonicalJson(value)));
}
