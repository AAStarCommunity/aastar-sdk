import { keccak256, stringToBytes, type Hex } from 'viem';

/**
 * Byte-stable JSON for evidence digests.
 * Object keys sort by UTF-16 code unit. `undefined` object properties are omitted.
 * An `undefined` array element is an error. A bigint is a JSON string of its base-10 digits
 * so a uint256 is not rounded into a JSON number. A string is lower-cased only when the whole
 * value matches `^0x[0-9a-fA-F]*$`.
 *
 * Iterative. One node for the root, one for each array element, one for each own property
 * (the same accounting as `measure` in attribute.ts). More than {@link MAX_NODES} throws.
 * Depth shares that cap. A cycle throws; a shared acyclic reference is written twice.
 */
const MAX_NODES = 1_000_000;
/** One string or object key. Checked before the hex regex and before `JSON.stringify`. */
const MAX_STRING = 1_048_576;
/** Decimal form of a larger bigint is not produced. uint256 fits. */
const MAX_BIGINT_BITS = 1024;
const HEX_RE = /^0x[0-9a-fA-F]*$/;

type Frame =
    | { op: 'array'; items: unknown[]; index: number; depth: number; ref: object; comma: boolean }
    | { op: 'object'; value: Record<string, unknown>; keys: string[]; index: number; depth: number; comma: boolean };

function plainObject(value: object): boolean {
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

function cmpKey(a: string, b: string): number {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
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

    const ownKeys = (value: object): string[] => {
        const keys: string[] = [];
        for (const key in value) {
            if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
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
        const keys = ownKeys(v);
        seen.add(v);
        parts.push('{');
        stack.push({ op: 'object', value: v as Record<string, unknown>, keys, index: 0, depth, comma: false });
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
            const el = frame.items[frame.index++];
            if (el === undefined) throw new Error('canonical: undefined array element');
            if (frame.comma) parts.push(',');
            frame.comma = true;
            stack.push(frame);
            write(el, frame.depth + 1);
            continue;
        }
        while (frame.index < frame.keys.length && frame.value[frame.keys[frame.index]!] === undefined) frame.index++;
        if (frame.index >= frame.keys.length) {
            parts.push('}');
            seen.delete(frame.value);
            continue;
        }
        const key = frame.keys[frame.index++]!;
        if (frame.comma) parts.push(',');
        frame.comma = true;
        parts.push(JSON.stringify(key), ':');
        stack.push(frame);
        write(frame.value[key], frame.depth + 1);
    }
    return parts.join('');
}

/** keccak256 of the UTF-8 bytes of {@link canonicalJson}. */
export function canonicalDigest(value: unknown): Hex {
    return keccak256(stringToBytes(canonicalJson(value)));
}
