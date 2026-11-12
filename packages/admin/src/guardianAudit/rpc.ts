import { numberToHex, type Address, type Hex } from 'viem';

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
    /** 256 bytes, or null when missing or the wrong size. */
    logsBloom: Hex | null;
}

const WORD = /^0x[0-9a-fA-F]{64}$/;
const BLOOM = /^0x[0-9a-fA-F]{512}$/;

export function quantity(v: unknown): number | null {
    if (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0) return v;
    if (typeof v !== 'string' || !/^0x[0-9a-fA-F]+$/.test(v)) return null;
    const n = Number.parseInt(v, 16);
    return Number.isSafeInteger(n) ? n : null;
}

export function isWord(v: unknown): v is string {
    return typeof v === 'string' && WORD.test(v);
}

/** `eth_getBlockByNumber`. Rejects null, a bad hash or parentHash, a bad height, or a different height. */
export async function header(rpc: RawRpc, tag: number | 'finalized'): Promise<BlockHeader> {
    const raw = await rpc.request({
        method: 'eth_getBlockByNumber',
        params: [typeof tag === 'number' ? numberToHex(tag) : tag, false],
    });
    if (raw == null || typeof raw !== 'object') throw new Error(`${rpc.name}: block ${String(tag)} unavailable`);
    const b = raw as { hash?: unknown; parentHash?: unknown; number?: unknown; logsBloom?: unknown };
    const number = quantity(b.number);
    if (typeof b.hash !== 'string' || !WORD.test(b.hash) || number === null) {
        throw new Error(`${rpc.name}: malformed block header`);
    }
    if (typeof tag === 'number' && number !== tag) throw new Error(`${rpc.name}: block header for another height`);
    if (typeof b.parentHash !== 'string' || !WORD.test(b.parentHash)) throw new Error(`${rpc.name}: malformed block header`);
    const logsBloom = typeof b.logsBloom === 'string' && BLOOM.test(b.logsBloom) ? b.logsBloom as Hex : null;
    return { number, hash: b.hash as Hex, parentHash: b.parentHash as Hex, logsBloom };
}

export type LogFilter =
    | { address: Address; fromBlock: number; toBlock: number }
    | { address: Address; blockHash: Hex };

/** Raw `eth_getLogs` (never a formatting helper). A non-array answer throws. */
export async function rawGetLogs(rpc: RawRpc, filter: LogFilter): Promise<unknown[]> {
    const body = 'blockHash' in filter
        ? { address: filter.address, blockHash: filter.blockHash }
        : { address: filter.address, fromBlock: numberToHex(filter.fromBlock), toBlock: numberToHex(filter.toBlock) };
    const r = await rpc.request({ method: 'eth_getLogs', params: [body] });
    if (!Array.isArray(r)) throw new Error(`${rpc.name}: eth_getLogs answer is not an array`);
    return r;
}

/** Page `[from, to]`. A failing page halves down to one block, then the error is rethrown. */
export async function pagedLogs(rpc: RawRpc, address: Address, from: number, to: number, page = 2000): Promise<unknown[]> {
    const out: unknown[] = [];
    let a = from;
    let size = page;
    while (a <= to) {
        const b = Math.min(to, a + size - 1);
        try {
            for (const log of await rawGetLogs(rpc, { address, fromBlock: a, toBlock: b })) out.push(log);
            a = b + 1;
            size = page;
        } catch (e) {
            if (size === 1) throw e;
            size = Math.max(1, Math.floor(size / 2));
        }
    }
    return out;
}

export function isHexData(v: unknown): v is string {
    return typeof v === 'string' && /^0x[0-9a-fA-F]*$/.test(v);
}
