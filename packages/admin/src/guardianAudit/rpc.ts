import { getAddress, numberToHex, type Address, type Hex } from 'viem';

/**
 * EIP-1193 transport. `name` is a provider name for run metadata, never a URL.
 * viem: `{ name, request: client.request }`
 * ethers v6 (not imported): `{ name, request: ({ method, params }) => provider.send(method, params ?? []) }`
 */
export interface RawRpc {
    name: string;
    request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

/** JSON-RPC log. Filters are address-only — never topics. */
export interface RawLog {
    address: Address;
    topics: Hex[];
    data: Hex;
    blockNumber: Hex;
    blockHash: Hex;
    transactionHash: Hex;
    logIndex: Hex;
    removed?: boolean;
}

export interface BlockHeader {
    number: number;
    hash: Hex;
    parentHash: Hex;
    receiptsRoot: Hex;
    /** 256 bytes, or null when missing or the wrong size. */
    logsBloom: Hex | null;
}

/** Hard caps checked before any walk, regex, or hash of an RPC value. */
export const responseLimits = {
    logs: 16384,
    receipts: 4096,
    logsPerReceipt: 1024,
    topics: 8,
    hex: 131072,
    quantity: 18,
    ancestry: 4096,
} as const;

const WORD_LEN = 66;
const BLOOM_LEN = 514;
const ADDR_LEN = 42;
const PROVIDER_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function hexOk(v: string): boolean {
    if (v.charCodeAt(0) !== 48 || v.charCodeAt(1) !== 120) return false;
    for (let i = 2; i < v.length; i++) {
        const c = v.charCodeAt(i);
        if ((c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102)) continue;
        return false;
    }
    return true;
}

/** A label safe to put in an error. The message does not echo `name`. */
export function assertProviderName(name: unknown): asserts name is string {
    if (typeof name !== 'string' || name.length < 1 || name.length > 64 || !PROVIDER_NAME.test(name)) {
        throw new Error('provider name is not a safe label');
    }
}

export function quantity(v: unknown): number | null {
    if (typeof v === 'number') return Number.isSafeInteger(v) && v >= 0 ? v : null;
    if (typeof v !== 'string' || v.length < 3 || v.length > responseLimits.quantity || !hexOk(v)) return null;
    const n = Number.parseInt(v, 16);
    return Number.isSafeInteger(n) ? n : null;
}

export function isWord(v: unknown): v is string {
    return typeof v === 'string' && v.length === WORD_LEN && hexOk(v);
}

export function isHexData(v: unknown): v is string {
    return typeof v === 'string' && v.length >= 2 && v.length <= responseLimits.hex && ((v.length - 2) & 1) === 0 && hexOk(v);
}

/** 20-byte hex address. The error does not echo the input. */
export function requireAddress(value: unknown): Address {
    if (typeof value !== 'string' || value.length !== ADDR_LEN || !hexOk(value)) throw new Error('invalid address');
    try {
        return getAddress(value);
    } catch {
        throw new Error('invalid address');
    }
}

function safeBound(n: number, min: number): boolean {
    return Number.isSafeInteger(n) && n >= min;
}

function clipStr(v: unknown, max: number): unknown {
    if (typeof v !== 'string') return v;
    return v.length > max ? 'oversize' : v;
}

function snapshotTopics(v: unknown): unknown {
    if (!Array.isArray(v)) return v;
    if (v.length > responseLimits.topics) return null;
    const out: unknown[] = [];
    for (let i = 0; i < v.length; i++) out.push(clipStr(v[i], WORD_LEN));
    return out;
}

/** Plain copy of one log. Oversized strings are replaced, not retained. */
export function snapshotLog(item: unknown): unknown {
    if (typeof item !== 'object' || item === null) return item;
    const o = item as Record<string, unknown>;
    return {
        address: clipStr(o.address, ADDR_LEN),
        topics: snapshotTopics(o.topics),
        data: clipStr(o.data, responseLimits.hex),
        blockNumber: clipStr(o.blockNumber, responseLimits.quantity),
        blockHash: clipStr(o.blockHash, WORD_LEN),
        transactionHash: clipStr(o.transactionHash, WORD_LEN),
        transactionIndex: clipStr(o.transactionIndex, responseLimits.quantity),
        logIndex: clipStr(o.logIndex, responseLimits.quantity),
        removed: o.removed === true,
    };
}

/** Plain copy of a receipt list. `null` when the list is not a bounded array. Does not read elements past the cap. */
export function snapshotReceipts(raw: unknown): unknown[] | null {
    if (!Array.isArray(raw) || raw.length > responseLimits.receipts) return null;
    const out: unknown[] = [];
    let logs = 0;
    for (let i = 0; i < raw.length; i++) {
        const item = raw[i];
        if (typeof item !== 'object' || item === null) {
            out.push(item);
            continue;
        }
        const rec = item as Record<string, unknown>;
        let copied: unknown = rec.logs;
        if (Array.isArray(rec.logs)) {
            if (rec.logs.length > responseLimits.logsPerReceipt) return null;
            logs += rec.logs.length;
            if (logs > responseLimits.logs) return null;
            const rows: unknown[] = [];
            for (let j = 0; j < rec.logs.length; j++) rows.push(snapshotLog(rec.logs[j]));
            copied = rows;
        }
        out.push({
            type: clipStr(rec.type, responseLimits.quantity),
            status: clipStr(rec.status, responseLimits.quantity),
            cumulativeGasUsed: clipStr(rec.cumulativeGasUsed, WORD_LEN),
            logsBloom: clipStr(rec.logsBloom, BLOOM_LEN),
            transactionHash: clipStr(rec.transactionHash, WORD_LEN),
            transactionIndex: clipStr(rec.transactionIndex, responseLimits.quantity),
            blockHash: clipStr(rec.blockHash, WORD_LEN),
            blockNumber: clipStr(rec.blockNumber, responseLimits.quantity),
            logs: copied,
        });
    }
    return out;
}

async function ask(rpc: RawRpc, method: string, params: unknown[]): Promise<unknown> {
    assertProviderName(rpc.name);
    if (typeof rpc.request !== 'function') throw new Error('invalid provider');
    try {
        return await rpc.request({ method, params });
    } catch {
        throw new Error(`${rpc.name}: request failed`);
    }
}

/** `eth_getBlockByNumber`. Rejects null, a bad hash, parentHash, or receiptsRoot, a bad height, or a different height. */
export async function header(rpc: RawRpc, tag: number | 'finalized'): Promise<BlockHeader> {
    assertProviderName(rpc.name);
    if (tag !== 'finalized' && !safeBound(tag, 0)) throw new Error('invalid block tag');
    const raw = await ask(rpc, 'eth_getBlockByNumber', [typeof tag === 'number' ? numberToHex(tag) : tag, false]);
    if (raw == null || typeof raw !== 'object') throw new Error(`${rpc.name}: block ${String(tag)} unavailable`);
    const b = raw as { hash?: unknown; parentHash?: unknown; receiptsRoot?: unknown; number?: unknown; logsBloom?: unknown };
    const number = quantity(b.number);
    const hash = typeof b.hash === 'string' && b.hash.length === WORD_LEN ? b.hash : '';
    if (!isWord(hash) || number === null) throw new Error(`${rpc.name}: malformed block header`);
    if (typeof tag === 'number' && number !== tag) throw new Error(`${rpc.name}: block header for another height`);
    if (!isWord(b.parentHash) || !isWord(b.receiptsRoot)) throw new Error(`${rpc.name}: malformed block header`);
    const bloom = b.logsBloom;
    const logsBloom = typeof bloom === 'string' && bloom.length === BLOOM_LEN && hexOk(bloom) ? bloom as Hex : null;
    return {
        number, hash: hash as Hex, parentHash: b.parentHash as Hex, receiptsRoot: b.receiptsRoot as Hex, logsBloom,
    };
}

export type LogFilter =
    | { address: Address; fromBlock: number; toBlock: number }
    | { address: Address; blockHash: Hex };

/** Raw `eth_getLogs` (never a formatting helper). The returned logs are copies. A non-array answer throws. */
export async function rawGetLogs(rpc: RawRpc, filter: LogFilter): Promise<unknown[]> {
    assertProviderName(rpc.name);
    requireAddress(filter.address);
    const body = 'blockHash' in filter
        ? { address: filter.address, blockHash: filter.blockHash }
        : { address: filter.address, fromBlock: numberToHex(filter.fromBlock), toBlock: numberToHex(filter.toBlock) };
    if ('blockHash' in filter) {
        if (!isWord(filter.blockHash)) throw new Error('invalid blockHash');
    } else {
        if (!safeBound(filter.fromBlock, 0) || !safeBound(filter.toBlock, 0)) throw new Error('invalid log range');
        if (filter.fromBlock > filter.toBlock) throw new Error('from must be <= to');
    }
    const r = await ask(rpc, 'eth_getLogs', [body]);
    if (!Array.isArray(r)) throw new Error(`${rpc.name}: eth_getLogs answer is not an array`);
    if (r.length > responseLimits.logs) throw new Error(`${rpc.name}: response too large`);
    const out: unknown[] = [];
    for (let i = 0; i < r.length; i++) out.push(snapshotLog(r[i]));
    return out;
}

/** Page `[from, to]`. A failing page halves down to one block, then a fixed error is thrown. */
export async function pagedLogs(rpc: RawRpc, address: Address, from: number, to: number, page = 2000): Promise<unknown[]> {
    assertProviderName(rpc.name);
    requireAddress(address);
    if (!safeBound(from, 0)) throw new Error('from must be >= 0');
    if (!safeBound(to, 0)) throw new Error('to must be >= 0');
    if (from > to) throw new Error('from must be <= to');
    if (to - from > responseLimits.ancestry) throw new Error('log range is too large');
    if (!safeBound(page, 1)) throw new Error('page must be >= 1');
    const out: unknown[] = [];
    let a = from;
    let size = page;
    while (a <= to) {
        const b = Math.min(to, a + size - 1);
        try {
            for (const log of await rawGetLogs(rpc, { address, fromBlock: a, toBlock: b })) out.push(log);
            a = b + 1;
            size = page;
        } catch (error) {
            if (size === 1) {
                if (error instanceof Error && error.message === `${rpc.name}: eth_getLogs answer is not an array`) throw error;
                if (error instanceof Error && error.message === `${rpc.name}: response too large`) throw error;
                throw new Error(`${rpc.name}: request failed`);
            }
            size = Math.max(1, Math.floor(size / 2));
        }
    }
    return out;
}
