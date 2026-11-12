import { bytesToHex, concat, hexToBytes, keccak256, toRlp, type Hex } from 'viem';
import { responseLimits } from './rpc.js';

/** keccak256(rlp('')). Header receiptsRoot of a block with no receipts. */
export const EMPTY_RECEIPTS_ROOT: Hex = keccak256(hexToBytes('0x80'));

/** One consensus receipt. `null` from the builders means the value cannot be encoded. */
export interface ConsensusLog { address: Hex; topics: readonly Hex[]; data: Hex }

export interface ConsensusReceipt {
    /** 0 legacy, otherwise the EIP-2718 type byte. */
    type: number;
    /** Post-Byzantium status. A pre-Byzantium state root is not encoded. */
    ok: boolean;
    cumulativeGasUsed: bigint;
    logsBloom: Hex;
    logs: readonly ConsensusLog[];
}

type Nibbles = number[];
type Leaf = { t: 'leaf'; k: Nibbles; v: Uint8Array };
type Ext = { t: 'ext'; k: Nibbles; c: Node };
type Branch = { t: 'branch'; children: (Node | null)[]; v: Uint8Array | null };
type Node = Leaf | Ext | Branch;

const BLOOM = /^0x[0-9a-fA-F]{512}$/;

function rlpStr(data: Uint8Array): Uint8Array {
    return hexToBytes(toRlp(bytesToHex(data)));
}

function rlpList(items: Uint8Array[]): Uint8Array {
    const len = items.reduce((sum, item) => sum + item.length, 0);
    let head: Uint8Array;
    if (len < 56) head = Uint8Array.of(0xc0 + len);
    else {
        let hex = len.toString(16);
        if (hex.length % 2) hex = `0${hex}`;
        const width = hexToBytes(`0x${hex}` as Hex);
        head = concat([Uint8Array.of(0xf7 + width.length), width]);
    }
    return concat([head, ...items]);
}

function uintBytes(n: bigint): Uint8Array {
    if (n === 0n) return new Uint8Array();
    let hex = n.toString(16);
    if (hex.length % 2) hex = `0${hex}`;
    return hexToBytes(`0x${hex}` as Hex);
}

/** Hex-prefix (yellow paper). Terminator marks a leaf. */
function hexPrefix(nibbles: Nibbles, terminator: boolean): Uint8Array {
    const odd = nibbles.length % 2 === 1;
    const flag = (terminator ? 2 : 0) + (odd ? 1 : 0);
    const out: number[] = [];
    let i = 0;
    if (odd) { out.push((flag << 4) | nibbles[0]!); i = 1; }
    else out.push(flag << 4);
    for (; i < nibbles.length; i += 2) out.push((nibbles[i]! << 4) | nibbles[i + 1]!);
    return Uint8Array.from(out);
}

function nibblesOf(bytes: Uint8Array): Nibbles {
    const out: number[] = [];
    for (const byte of bytes) out.push(byte >> 4, byte & 0xf);
    return out;
}

function lcp(a: Nibbles, b: Nibbles): number {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i;
}

function branch(): Branch {
    return { t: 'branch', children: Array.from({ length: 16 }, () => null), v: null };
}

function place(node: Branch, key: Nibbles, value: Uint8Array): void {
    if (key.length === 0) { node.v = value; return; }
    node.children[key[0]!] = { t: 'leaf', k: key.slice(1), v: value };
}

function put(node: Node | null, key: Nibbles, value: Uint8Array): Node {
    if (!node) return { t: 'leaf', k: key, v: value };
    if (node.t === 'leaf') {
        const n = lcp(node.k, key);
        if (n === key.length && n === node.k.length) return { t: 'leaf', k: key, v: value };
        const next = branch();
        place(next, node.k.slice(n), node.v);
        place(next, key.slice(n), value);
        return n === 0 ? next : { t: 'ext', k: key.slice(0, n), c: next };
    }
    if (node.t === 'ext') {
        const n = lcp(node.k, key);
        if (n === node.k.length) return { t: 'ext', k: node.k, c: put(node.c, key.slice(n), value) };
        const next = branch();
        const rest = node.k.slice(n);
        next.children[rest[0]!] = rest.length === 1 ? node.c : { t: 'ext', k: rest.slice(1), c: node.c };
        const added = key.slice(n);
        if (added.length === 0) next.v = value;
        else next.children[added[0]!] = put(null, added.slice(1), value);
        return n === 0 ? next : { t: 'ext', k: key.slice(0, n), c: next };
    }
    if (key.length === 0) return { t: 'branch', children: node.children, v: value };
    const children = node.children.slice();
    children[key[0]!] = put(children[key[0]!] ?? null, key.slice(1), value);
    return { t: 'branch', children, v: node.v };
}

function ref(encoded: Uint8Array): Uint8Array {
    return encoded.length < 32 ? encoded : rlpStr(hexToBytes(keccak256(encoded)));
}

function encode(node: Node): Uint8Array {
    if (node.t === 'leaf') return rlpList([rlpStr(hexPrefix(node.k, true)), rlpStr(node.v)]);
    if (node.t === 'ext') return rlpList([rlpStr(hexPrefix(node.k, false)), ref(encode(node.c))]);
    const slots = node.children.map((child) => child ? ref(encode(child)) : rlpStr(new Uint8Array()));
    slots.push(node.v ? rlpStr(node.v) : rlpStr(new Uint8Array()));
    return rlpList(slots);
}

/** Merkle Patricia root. The header stores keccak256 of the root node, always. */
export function trieRoot(pairs: readonly { key: Uint8Array; value: Uint8Array }[]): Hex {
    let node: Node | null = null;
    for (const pair of pairs) node = put(node, nibblesOf(pair.key), pair.value);
    if (!node) return EMPTY_RECEIPTS_ROOT;
    return keccak256(encode(node));
}

function rlpUint(n: bigint): Uint8Array {
    return rlpStr(uintBytes(n));
}

/** Typed receipt encoding. `null` when a field cannot be represented. */
export function encodeReceipt(receipt: ConsensusReceipt, index: number): { key: Uint8Array; value: Uint8Array } | null {
    if (!Number.isInteger(receipt.type) || receipt.type < 0 || receipt.type > 0x7f) return null;
    if (!BLOOM.test(receipt.logsBloom)) return null;
    if (receipt.cumulativeGasUsed < 0n) return null;
    const logs = receipt.logs.map((log) => [log.address, [...log.topics], log.data]);
    let payload: Uint8Array;
    try {
        payload = hexToBytes(toRlp([
            receipt.ok ? '0x01' : '0x',
            bytesToHex(uintBytes(receipt.cumulativeGasUsed)),
            receipt.logsBloom,
            logs,
        ]));
    } catch {
        return null;
    }
    const value = receipt.type === 0 ? payload : concat([Uint8Array.of(receipt.type), payload]);
    return { key: rlpUint(BigInt(index)), value };
}

function hexChars(v: string): boolean {
    if (v.charCodeAt(0) !== 48 || v.charCodeAt(1) !== 120) return false;
    for (let i = 2; i < v.length; i++) {
        const c = v.charCodeAt(i);
        if ((c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102)) continue;
        return false;
    }
    return true;
}

function hexQty(v: unknown): bigint | null {
    if (typeof v === 'bigint') return v >= 0n && v <= (1n << 256n) - 1n ? v : null;
    if (typeof v !== 'string' || v.length < 2 || v.length > 66 || !hexChars(v)) return null;
    if (v === '0x') return 0n;
    return BigInt(v);
}

function asHex(v: unknown, max: number = responseLimits.hex): Hex | null {
    if (typeof v !== 'string' || v.length < 2 || v.length > max || ((v.length - 2) & 1) !== 0 || !hexChars(v)) return null;
    return v as Hex;
}

/** Build the receipts trie from an `eth_getBlockReceipts` answer. `null` = cannot encode. Length is checked before any element is read. */
export function receiptsRootFromRpc(raw: unknown): Hex | null {
    if (!Array.isArray(raw) || raw.length > responseLimits.receipts) return null;
    const pairs: { key: Uint8Array; value: Uint8Array }[] = [];
    const seen = new Set<number>();
    let logCount = 0;
    for (let i = 0; i < raw.length; i++) {
        const item = raw[i];
        if (typeof item !== 'object' || item === null) return null;
        const r = item as Record<string, unknown>;
        const index = hexQty(r.transactionIndex);
        const type = r.type === undefined ? 0 : hexQty(r.type);
        const status = hexQty(r.status);
        const gas = hexQty(r.cumulativeGasUsed);
        const bloom = asHex(r.logsBloom, 514);
        if (index === null || type === null || status === null || gas === null || !bloom) return null;
        if (status !== 0n && status !== 1n) return null;
        if (!Number.isSafeInteger(Number(index)) || seen.has(Number(index))) return null;
        if (!Array.isArray(r.logs) || r.logs.length > responseLimits.logsPerReceipt) return null;
        logCount += r.logs.length;
        if (logCount > responseLimits.logs) return null;
        const logs: ConsensusLog[] = [];
        for (let j = 0; j < r.logs.length; j++) {
            const log = r.logs[j];
            if (typeof log !== 'object' || log === null) return null;
            const row = log as Record<string, unknown>;
            const address = asHex(row.address, 66);
            const data = asHex(row.data);
            if (!address || !data || !Array.isArray(row.topics) || row.topics.length > responseLimits.topics) return null;
            const topics: Hex[] = [];
            for (let k = 0; k < row.topics.length; k++) {
                const word = asHex(row.topics[k], 66);
                if (!word) return null;
                topics.push(word);
            }
            logs.push({ address, topics, data });
        }
        const encoded = encodeReceipt({
            type: Number(type), ok: status === 1n, cumulativeGasUsed: gas, logsBloom: bloom, logs,
        }, Number(index));
        if (!encoded) return null;
        seen.add(Number(index));
        pairs.push(encoded);
    }
    return trieRoot(pairs);
}
