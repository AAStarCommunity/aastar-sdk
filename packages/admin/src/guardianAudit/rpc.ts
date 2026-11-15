import { getAddress, numberToHex, type Address, type Hex } from 'viem';

/**
 * Provider `name` and evidence `runMetadata.providers` entries.
 * A short label: a letter or digit, then letters, digits, `.`, `_`, or `-`. A URL cannot match.
 * Module-private. Callers use {@link isProviderName}; a shared RegExp can be retargeted with `compile`.
 */
const PROVIDER_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/** True when `name` is a provider label. Length is checked before the pattern runs. */
export function isProviderName(name: unknown): name is string {
    return typeof name === 'string' && name.length >= 1 && name.length <= 64 && PROVIDER_NAME_RE.test(name);
}

/**
 * EIP-1193 transport. `name` must pass {@link isProviderName}. It is a label for run metadata, never a URL.
 * Request timeouts belong to the caller's transport. This scanner does not time out `request`.
 * viem: `{ name, request: client.request }`
 * ethers v6 (not imported): `{ name, request: ({ method, params }) => provider.send(method, params ?? []) }`
 *
 * The decoded JSON is already allocated by the transport, so callers must use a transport with a
 * response-size cap. guardian-audit bounds its own work after decoding.
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
    /** Block gas limit, or null when missing or not a bounded quantity. Sizes the receipt budget. */
    gasLimit: number | null;
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
    /** data + topics + logsBloom bytes of one receipt, before any encoding. */
    receiptPayload: 1_048_576,
    /** Those same bytes summed across one block. */
    blockPayload: 32 * 1_048_576,
    /** data + topics bytes of one `eth_getLogs` answer, and of all pages of one `pagedLogs` call (#445 M2). */
    logsPayload: 32 * 1_048_576,
} as const;

/**
 * Caps for one block's receipts. One receipt may use the whole block budget when derived from gas.
 * `dataChars` is the longest `data` string of one log, `0x` included.
 * `encodedReceipt` is the longest consensus encoding of one receipt.
 */
export interface ReceiptBudget {
    receipts: number;
    logs: number;
    logsPerReceipt: number;
    receiptPayload: number;
    blockPayload: number;
    dataChars: number;
    encodedReceipt: number;
}

/** The fixed caps used before FU-101. Also the budget when a header has no readable gasLimit. */
export const FIXED_RECEIPT_BUDGET: ReceiptBudget = Object.freeze({
    receipts: responseLimits.receipts,
    logs: responseLimits.logs,
    logsPerReceipt: responseLimits.logsPerReceipt,
    receiptPayload: responseLimits.receiptPayload,
    blockPayload: responseLimits.blockPayload,
    dataChars: responseLimits.hex,
    // Payload plus RLP overhead (see receiptBudget). It was 1 MiB, which refused a receipt whose payload fit.
    encodedReceipt: responseLimits.receiptPayload + 64 * responseLimits.logsPerReceipt + 1024,
});

/** Default and largest `maxProofGas`. At the largest value the receipt count stays below the trie pair cap. */
export const DEFAULT_MAX_PROOF_GAS = 100_000_000;
export const MAX_PROOF_GAS_CEILING = 1_000_000_000;

/** Gas floors from the EVM: LOG base and per topic, per data byte, and the intrinsic transaction cost. */
const LOG_GAS = 375;
const LOG_DATA_GAS = 8;
const TX_GAS = 21_000;

/**
 * Budget that every valid block with this gas limit fits in (FU-101).
 * Gas refunds return at most half of the gas a transaction consumed (a fifth since London), so execution
 * gas consumed in one block is at most `2 * gasLimit`. A log consumes at least `375 + 375 * topics + 8 * bytes`,
 * so a block holds at most `2G / 375` logs and `2G / 8` data and topic bytes (a topic byte costs more than a data byte).
 * A transaction consumes at least 21000, so a block holds at most `2G / 21000` of them; one more covers an OP system
 * transaction whose gas is not counted. Each bloom adds 256 bytes. `G` is clamped to `maxProofGas` to bound memory.
 * Every field is at least the fixed cap, so a block that fit before still fits.
 * The budget decides only whether a proof is attempted. The proof itself is the receiptsRoot match.
 */
export function receiptBudget(gasLimit: number | null, maxProofGas: number = DEFAULT_MAX_PROOF_GAS): ReceiptBudget {
    if (gasLimit === null || !Number.isSafeInteger(gasLimit) || gasLimit < 0) return FIXED_RECEIPT_BUDGET;
    if (!Number.isSafeInteger(maxProofGas) || maxProofGas < 1 || maxProofGas > MAX_PROOF_GAS_CEILING) {
        throw new Error(`maxProofGas must be >= 1 and <= ${MAX_PROOF_GAS_CEILING}`);
    }
    const gas = 2 * Math.min(gasLimit, maxProofGas);
    const logs = Math.floor(gas / LOG_GAS);
    const bytes = Math.floor(gas / LOG_DATA_GAS);
    const receipts = Math.floor(gas / TX_GAS) + 1;
    const fixed = FIXED_RECEIPT_BUDGET;
    const receiptPayload = Math.max(fixed.receiptPayload, bytes + 256);
    const logsPerReceipt = Math.max(fixed.logsPerReceipt, logs);
    return {
        receipts: Math.max(fixed.receipts, receipts),
        logs: Math.max(fixed.logs, logs),
        logsPerReceipt,
        receiptPayload,
        blockPayload: Math.max(fixed.blockPayload, bytes + 256 * receipts),
        dataChars: Math.max(fixed.dataChars, 2 + 2 * bytes),
        // RLP overhead: at most 64 bytes per log and 1024 per receipt on top of its payload.
        encodedReceipt: receiptPayload + 64 * logsPerReceipt + 1024,
    };
}

const WORD_LEN = 66;
const BLOOM_LEN = 514;
const ADDR_LEN = 42;

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
    if (!isProviderName(name)) throw new Error('provider name is not a safe label');
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

export function isHexData(v: unknown, maxChars: number = responseLimits.hex): v is string {
    return typeof v === 'string' && v.length >= 2 && v.length <= maxChars && ((v.length - 2) & 1) === 0 && hexOk(v);
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

/** Byte length of a hex string, from its length. Non-hex counts as 0. No character walk. */
function hexByteLen(v: unknown): number {
    if (typeof v !== 'string' || v.length < 2 || v.charCodeAt(0) !== 48 || v.charCodeAt(1) !== 120) return 0;
    return (v.length - 2) >> 1;
}

/** data + topics bytes of one raw log, from string lengths only. The topics count is checked before they are read. */
function logPayloadBytes(item: unknown): number {
    if (typeof item !== 'object' || item === null) return 0;
    const o = item as Record<string, unknown>;
    let bytes = hexByteLen(o.data);
    const topics = o.topics;
    if (Array.isArray(topics)) {
        if (topics.length > responseLimits.topics) return Infinity;
        for (let k = 0; k < topics.length; k++) bytes += hexByteLen(topics[k]);
    }
    return bytes;
}

/**
 * data, topics, and logsBloom bytes. `true` when one receipt or the block exceeds its payload budget,
 * when one data string is longer than the budget allows, or when any array is longer than its count limit
 * (checked before its elements are read). Returns before encoding. Defaults to the fixed caps.
 */
export function receiptPayloadTooLarge(raw: unknown[], budget: ReceiptBudget = FIXED_RECEIPT_BUDGET): boolean {
    if (raw.length > budget.receipts) return true;
    let total = 0;
    let logCount = 0;
    for (let i = 0; i < raw.length; i++) {
        const item = raw[i];
        if (typeof item !== 'object' || item === null) continue;
        const rec = item as Record<string, unknown>;
        let bytes = hexByteLen(rec.logsBloom);
        const logs = rec.logs;
        if (Array.isArray(logs)) {
            if (logs.length > budget.logsPerReceipt) return true;
            logCount += logs.length;
            if (logCount > budget.logs) return true;
            for (let j = 0; j < logs.length; j++) {
                const log = logs[j];
                if (typeof log === 'object' && log !== null) {
                    const row = log as Record<string, unknown>;
                    if (typeof row.data === 'string' && row.data.length > budget.dataChars) return true;
                    bytes += hexByteLen(row.data);
                    const topics = row.topics;
                    if (Array.isArray(topics)) {
                        if (topics.length > responseLimits.topics) return true;
                        for (let k = 0; k < topics.length; k++) bytes += hexByteLen(topics[k]);
                    }
                }
                if (bytes > budget.receiptPayload) return true;
            }
        }
        if (bytes > budget.receiptPayload || total + bytes > budget.blockPayload) return true;
        total += bytes;
    }
    return false;
}

function snapshotTopics(v: unknown): unknown {
    if (!Array.isArray(v)) return v;
    if (v.length > responseLimits.topics) return null;
    const out: unknown[] = [];
    for (let i = 0; i < v.length; i++) out.push(clipStr(v[i], WORD_LEN));
    return out;
}

/** Plain copy of one log. Oversized strings are replaced, not retained. `dataChars` caps `data`. */
export function snapshotLog(item: unknown, dataChars: number = responseLimits.hex): unknown {
    if (typeof item !== 'object' || item === null) return item;
    const o = item as Record<string, unknown>;
    return {
        address: clipStr(o.address, ADDR_LEN),
        topics: snapshotTopics(o.topics),
        data: clipStr(o.data, dataChars),
        blockNumber: clipStr(o.blockNumber, responseLimits.quantity),
        blockHash: clipStr(o.blockHash, WORD_LEN),
        transactionHash: clipStr(o.transactionHash, WORD_LEN),
        transactionIndex: clipStr(o.transactionIndex, responseLimits.quantity),
        logIndex: clipStr(o.logIndex, responseLimits.quantity),
        removed: o.removed === true,
    };
}

/**
 * A deposit quantity, or absent. Present values must be strict quantities.
 * `null` means the field is present and not a bounded quantity.
 */
function snapshotDeposit(v: unknown): { ok: true; value?: string } | { ok: false } {
    if (v === undefined) return { ok: true };
    const n = quantity(v);
    if (n === null) return { ok: false };
    return { ok: true, value: typeof v === 'string' ? v : numberToHex(n) };
}

/**
 * Plain copy of a receipt list. `null` when the answer is not an array.
 * `'too-large'` when a count or data, topics, and bloom exceed the budget.
 * The budget is checked before the copy. Does not read elements past the cap. Defaults to the fixed caps.
 */
export function snapshotReceipts(raw: unknown, budget: ReceiptBudget = FIXED_RECEIPT_BUDGET): unknown[] | 'too-large' | null {
    if (!Array.isArray(raw)) return null;
    if (receiptPayloadTooLarge(raw, budget)) return 'too-large';
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
            if (rec.logs.length > budget.logsPerReceipt) return null;
            logs += rec.logs.length;
            if (logs > budget.logs) return null;
            const rows: unknown[] = [];
            for (let j = 0; j < rec.logs.length; j++) rows.push(snapshotLog(rec.logs[j], budget.dataChars));
            copied = rows;
        }
        const depositNonce = snapshotDeposit(rec.depositNonce);
        const depositReceiptVersion = snapshotDeposit(rec.depositReceiptVersion);
        if (!depositNonce.ok || !depositReceiptVersion.ok) return null;
        const row: Record<string, unknown> = {
            type: clipStr(rec.type, responseLimits.quantity),
            status: clipStr(rec.status, responseLimits.quantity),
            cumulativeGasUsed: clipStr(rec.cumulativeGasUsed, WORD_LEN),
            logsBloom: clipStr(rec.logsBloom, BLOOM_LEN),
            transactionHash: clipStr(rec.transactionHash, WORD_LEN),
            transactionIndex: clipStr(rec.transactionIndex, responseLimits.quantity),
            blockHash: clipStr(rec.blockHash, WORD_LEN),
            blockNumber: clipStr(rec.blockNumber, responseLimits.quantity),
            logs: copied,
        };
        if (depositNonce.value !== undefined) row.depositNonce = depositNonce.value;
        if (depositReceiptVersion.value !== undefined) row.depositReceiptVersion = depositReceiptVersion.value;
        out.push(row);
    }
    return out;
}

/** Name and request captured before any await. Later mutations of `rpc.name` stay out of errors. */
function openRpc(rpc: RawRpc): { name: string; request: RawRpc['request'] } {
    const name = rpc.name;
    assertProviderName(name);
    const request = rpc.request;
    if (typeof request !== 'function') throw new Error('invalid provider');
    return { name, request: request.bind(rpc) };
}

async function ask(opened: { name: string; request: RawRpc['request'] }, method: string, params: unknown[]): Promise<unknown> {
    try {
        return await opened.request({ method, params });
    } catch {
        throw new Error(`${opened.name}: request failed`);
    }
}

/** `eth_getBlockByNumber`. Rejects null, a bad hash, parentHash, or receiptsRoot, a bad height, or a different height. */
export async function header(rpc: RawRpc, tag: number | 'finalized'): Promise<BlockHeader> {
    const opened = openRpc(rpc);
    if (tag !== 'finalized' && !safeBound(tag, 0)) throw new Error('invalid block tag');
    const raw = await ask(opened, 'eth_getBlockByNumber', [typeof tag === 'number' ? numberToHex(tag) : tag, false]);
    if (raw == null || typeof raw !== 'object') throw new Error(`${opened.name}: block ${String(tag)} unavailable`);
    const b = raw as {
        hash?: unknown; parentHash?: unknown; receiptsRoot?: unknown; number?: unknown; logsBloom?: unknown; gasLimit?: unknown;
    };
    const number = quantity(b.number);
    const hash = typeof b.hash === 'string' && b.hash.length === WORD_LEN ? b.hash : '';
    if (!isWord(hash) || number === null) throw new Error(`${opened.name}: malformed block header`);
    if (typeof tag === 'number' && number !== tag) throw new Error(`${opened.name}: block header for another height`);
    if (!isWord(b.parentHash) || !isWord(b.receiptsRoot)) throw new Error(`${opened.name}: malformed block header`);
    const bloom = b.logsBloom;
    const logsBloom = typeof bloom === 'string' && bloom.length === BLOOM_LEN && hexOk(bloom) ? bloom as Hex : null;
    return {
        number, hash: hash as Hex, parentHash: b.parentHash as Hex, receiptsRoot: b.receiptsRoot as Hex, logsBloom,
        gasLimit: quantity(b.gasLimit),
    };
}

export type LogFilter =
    | { address: Address; fromBlock: number; toBlock: number }
    | { address: Address; blockHash: Hex };

/** Raw `eth_getLogs` (never a formatting helper). The returned logs are copies. A non-array answer throws. */
export async function rawGetLogs(rpc: RawRpc, filter: LogFilter): Promise<unknown[]> {
    const opened = openRpc(rpc);
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
    const r = await ask(opened, 'eth_getLogs', [body]);
    if (!Array.isArray(r)) throw new Error(`${opened.name}: eth_getLogs answer is not an array`);
    if (r.length > responseLimits.logs) throw new Error(`${opened.name}: response too large`);
    let bytes = 0;
    for (let i = 0; i < r.length; i++) {
        bytes += logPayloadBytes(r[i]);
        if (bytes > responseLimits.logsPayload) throw new Error(`${opened.name}: response too large`);
    }
    const out: unknown[] = [];
    for (let i = 0; i < r.length; i++) out.push(snapshotLog(r[i]));
    return out;
}

/** Page `[from, to]`. A failing page halves down to one block, then a fixed error is thrown. */
export async function pagedLogs(rpc: RawRpc, address: Address, from: number, to: number, page = 2000): Promise<unknown[]> {
    const opened = openRpc(rpc);
    requireAddress(address);
    if (!safeBound(from, 0)) throw new Error('from must be >= 0');
    if (!safeBound(to, 0)) throw new Error('to must be >= 0');
    if (from > to) throw new Error('from must be <= to');
    if (to - from > responseLimits.ancestry) throw new Error('log range is too large');
    if (!safeBound(page, 1)) throw new Error('page must be >= 1');
    const out: unknown[] = [];
    let bytes = 0;
    let a = from;
    let size = page;
    while (a <= to) {
        const b = Math.min(to, a + size - 1);
        let pageLogs: unknown[];
        try {
            pageLogs = await rawGetLogs(opened, { address, fromBlock: a, toBlock: b });
        } catch (error) {
            if (size === 1) {
                if (error instanceof Error && error.message === `${opened.name}: eth_getLogs answer is not an array`) throw error;
                if (error instanceof Error && error.message === `${opened.name}: response too large`) throw error;
                throw new Error(`${opened.name}: request failed`);
            }
            size = Math.max(1, Math.floor(size / 2));
            continue;
        }
        if (out.length + pageLogs.length > responseLimits.logs) throw new Error(`${opened.name}: response too large`);
        for (const log of pageLogs) {
            bytes += logPayloadBytes(log);
            if (bytes > responseLimits.logsPayload) throw new Error(`${opened.name}: response too large`);
        }
        for (const log of pageLogs) out.push(log);
        a = b + 1;
        size = page;
    }
    return out;
}
