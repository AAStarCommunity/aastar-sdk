import { getAddress, isAddress, keccak256, numberToHex, stringToHex, type Address, type Hex } from 'viem';
import { mayContainAddress } from './bloom.js';
import {
    assertProviderName, header, isHexData, isWord, pagedLogs, quantity, requireAddress, responseLimits,
    snapshotReceipts, type BlockHeader, type RawLog, type RawRpc,
} from './rpc.js';
import {
    ScopeChangedError,
    StoreConflictError,
    unresolvedId,
    type AttributedAction,
    type Checkpoint,
    type GuardianAuditStore,
    type StoreSnapshot,
    type UnresolvedAction,
} from './store.js';
import { receiptsRootFromRpc } from './trie.js';

/** One generation. `toBlock` is the upgrade boundary; the topic table itself arrives in step 4. */
export interface WatchedContract {
    address: Address;
    fromBlock: number;
    toBlock?: number;
    /**
     * Decoder/ABI generation, for example `BLSAggregator-4.12.0`. Part of the stored scope.
     * Windows of one address must be contiguous and non-overlapping. A gap is a config error.
     */
    generation: string;
    /**
     * `null` = unknown topic0 for this generation. `'ignore'` = known, not a guardian action.
     * Returning `'ignore'` is a trusted classification. An unknown topic must return null,
     * which makes the scan INCOMPLETE. A decoder that labels a real guardian topic `'ignore'`
     * is trusted; that mistake is not covered by the unknown-topic check.
     */
    decode(log: RawLog): DecodedAction | 'ignore' | null;
}

export interface DecodedAction { kind: string; [k: string]: unknown }

export interface FoundAction {
    blockNumber: number;
    blockHash: Hex;
    txHash: Hex;
    logIndex: number;
    address: Address;
    kind: string;
    decoded: DecodedAction;
    log: RawLog;
    /** Set when an attributor accepts the action, including a later retry. */
    attribution?: unknown;
}

/** Step 3 seam. A miss is stored, not dropped. An accept carries `attribution` on the action. */
export interface Attributor {
    attribute(action: FoundAction): Promise<{ ok: true; attribution: unknown } | { ok: false; reason: string }>;
}

export interface ScanRangeOptions {
    providers: readonly [RawRpc, RawRpc];
    watched: WatchedContract[];
    store: GuardianAuditStore;
    startBlock: number;
    maxBlocks: number;
    /** Chain the providers must report from `eth_chainId`. Part of the stored scope. */
    chainId: number;
    attributor?: Attributor;
    page?: number;
    /**
     * Most blocks the parent-hash walk may cover from the scanned tip up to finalized.
     * Default 100_000. See `scanRange` for the cost and the catch-up recovery.
     */
    maxAnchorBlocks?: number;
}

interface ScanStats {
    count: number;
    from: number;
    to: number;
    actions: FoundAction[];
    bloomFalsePositives: number;
    ignored: number;
    /** Priors accepted on this run. Same sort as `actions`: blockNumber, then logIndex. */
    resolvedPrior: FoundAction[];
}

export type ScanResult =
    | (ScanStats & { state: 'COMPLETE'; range?: { from: number; to: number; empty: true } })
    | (ScanStats & { state: 'UNATTRIBUTED'; unattributed: number; range?: { from: number; to: number; empty: true } })
    | { state: 'INCOMPLETE'; reasons: string[]; from: number; to?: number };

export class FinalityConflictError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FinalityConflictError';
    }
}

interface Norm {
    address: Address;
    topics: Hex[];
    data: Hex;
    blockNumber: number;
    blockHash: Hex;
    txHash: Hex;
    logIndex: number;
    removed: boolean;
    raw: RawLog;
}

interface Bucket { contract: WatchedContract; address: Address; lo: number; hi: number; logs: Norm[] }

const bad = (from: number, to: number, reason: string): ScanResult =>
    ({ state: 'INCOMPLETE', reasons: [reason], from, to });

function safeInt(n: number, min: number): boolean {
    return Number.isSafeInteger(n) && n >= min;
}

function keyOf(log: Norm): string {
    return [
        log.blockHash, log.logIndex, log.txHash, log.address, log.topics.join(','), log.data,
        log.removed ? '1' : '0',
    ].join('|').toLowerCase();
}

function parseLog(raw: unknown): Norm | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const o = raw as Record<string, unknown>;
    const blockNumber = quantity(o.blockNumber);
    const logIndex = quantity(o.logIndex);
    if (blockNumber === null || logIndex === null) return null;
    if (typeof o.address !== 'string' || o.address.length !== 42 || !isAddress(o.address)) return null;
    if (!isWord(o.blockHash) || !isWord(o.transactionHash) || !isHexData(o.data)) return null;
    if (!Array.isArray(o.topics) || o.topics.length > responseLimits.topics || o.topics.some((t) => !isWord(t))) return null;
    const address = getAddress(o.address);
    const blockHash = o.blockHash.toLowerCase() as Hex;
    const txHash = o.transactionHash.toLowerCase() as Hex;
    const topics = (o.topics as string[]).map((t) => t.toLowerCase() as Hex);
    const data = o.data.toLowerCase() as Hex;
    return {
        address, topics, data, blockNumber, blockHash, txHash, logIndex, removed: o.removed === true,
        raw: {
            address, topics, data, blockHash, transactionHash: txHash, removed: o.removed === true,
            blockNumber: numberToHex(blockNumber), logIndex: numberToHex(logIndex),
        },
    };
}

/** Reject a removed log, a foreign address, or a log outside the queried window. */
function problem(log: Norm, queried: Address, lo: number, hi: number): string | null {
    if (log.removed) return `removed log from ${queried} at block ${log.blockNumber}`;
    if (log.address !== queried) return `log address is not the queried address ${queried}`;
    if (log.blockNumber < lo || log.blockNumber > hi) return `log from ${queried} outside queried range at block ${log.blockNumber}`;
    return null;
}

function parseAll(raws: unknown[], queried: Address, lo: number, hi: number): { logs: Norm[] } | { error: string } {
    if (raws.length > responseLimits.logs) return { error: `malformed log from ${queried}` };
    const logs: Norm[] = [];
    for (let i = 0; i < raws.length; i++) {
        const raw = raws[i];
        const log = parseLog(raw);
        if (!log) return { error: `malformed log from ${queried}` };
        const why = problem(log, queried, lo, hi);
        if (why) return { error: why };
        logs.push(log);
    }
    return { logs };
}

function sameLogs(a: Norm[], b: Norm[]): boolean {
    const ak = a.map(keyOf).sort();
    const bk = b.map(keyOf).sort();
    return ak.length === bk.length && ak.every((k, i) => k === bk[i]);
}

function covers(contract: WatchedContract, address: Address, block: number): boolean {
    if (getAddress(contract.address) !== address) return false;
    if (block < contract.fromBlock) return false;
    return contract.toBlock === undefined || block <= contract.toBlock;
}

/**
 * The decoder and the stored log are different copies of `input`.
 * A decoder that mutates its argument cannot change the log we keep.
 */
function callDecode(
    contract: WatchedContract, input: RawLog, address: Address, block: number,
): { ok: true; value: DecodedAction | 'ignore' | null; log: RawLog } | { ok: false; reason: string } {
    const log = structuredClone(input);
    const failed = { ok: false as const, reason: `decoder threw for ${address} at block ${block}` };
    try {
        const produced = contract.decode(structuredClone(log));
        if (produced === null || produced === 'ignore') return { ok: true, value: produced, log };
        if (typeof produced !== 'object') return failed;
        return { ok: true, value: structuredClone(produced), log };
    } catch {
        return failed;
    }
}

/** A decoder kind callers can store. Anything else is not an action. */
function actionKind(decoded: DecodedAction): string | null {
    return typeof decoded.kind === 'string' && decoded.kind.length > 0 ? decoded.kind : null;
}

/** Re-decode a stored row through the generation that owns its block. `null` = keep it unresolved. */
function revive(
    watched: readonly WatchedContract[], item: UnresolvedAction,
): FoundAction | { incomplete: string } | null {
    let address: Address;
    try {
        address = requireAddress(item.address);
    } catch {
        return { incomplete: 'stored action malformed' };
    }
    const contract = watched.find((c) => covers(c, address, item.blockNumber));
    if (!contract) return null;
    const decoded = callDecode(contract, item.log, address, item.blockNumber);
    if (!decoded.ok) return { incomplete: decoded.reason };
    if (decoded.value === null || decoded.value === 'ignore') return null;
    const kind = actionKind(decoded.value);
    if (!kind) return { incomplete: 'decoder returned an invalid kind' };
    return {
        blockNumber: item.blockNumber, blockHash: item.blockHash, txHash: item.txHash, logIndex: item.logIndex,
        address, kind, decoded: decoded.value, log: decoded.log,
    };
}

/** Labels that appear in reasons. A URL or credential must not get through. The error does not echo `name`. */
function assertName(name: string): void {
    assertProviderName(name);
}

/**
 * Hash of `chainId`, `startBlock`, and the watched set. Address is lower case, `toBlock` is null when open.
 * The list is sorted so input order does not change the scope.
 */
export function watchScope(watched: readonly WatchedContract[], startBlock: number, chainId: number): Hex {
    assertChainId(chainId);
    assertWatched(watched, startBlock);
    const rows = watched.map((contract) => ({
        address: requireAddress(contract.address).toLowerCase(),
        fromBlock: contract.fromBlock,
        generation: contract.generation,
        toBlock: contract.toBlock ?? null,
    }));
    rows.sort((a, b) => {
        if (a.address !== b.address) return a.address < b.address ? -1 : 1;
        if (a.fromBlock !== b.fromBlock) return a.fromBlock - b.fromBlock;
        if (a.toBlock !== b.toBlock) {
            if (a.toBlock === null) return 1;
            if (b.toBlock === null) return -1;
            return a.toBlock - b.toBlock;
        }
        if (a.generation !== b.generation) return a.generation < b.generation ? -1 : 1;
        return 0;
    });
    return keccak256(stringToHex(JSON.stringify({ chainId, startBlock, watched: rows })));
}

function assertChainId(chainId: number): void {
    if (!safeInt(chainId, 1)) throw new Error('chainId must be a positive safe integer');
}

function assertWatched(watched: readonly WatchedContract[], startBlock: number): void {
    if (!safeInt(startBlock, 0)) throw new Error('startBlock must be >= 0');
    if (!Array.isArray(watched) || watched.length === 0) throw new Error('watched set is empty');
    const spans: { address: Address; from: number; to: number }[] = [];
    for (const contract of watched) {
        if (typeof contract.decode !== 'function') throw new Error('decoder is required');
        if (typeof contract.generation !== 'string' || contract.generation.length === 0 || contract.generation.length > 128) {
            throw new Error('generation is required');
        }
        const address = requireAddress(contract.address);
        if (!safeInt(contract.fromBlock, 0)) throw new Error(`invalid fromBlock for ${address}`);
        if (contract.toBlock !== undefined && !safeInt(contract.toBlock, 0)) throw new Error(`invalid toBlock for ${address}`);
        if (contract.toBlock !== undefined && contract.toBlock < contract.fromBlock) {
            throw new Error(`toBlock precedes fromBlock for ${address}`);
        }
        spans.push({ address, from: contract.fromBlock, to: contract.toBlock ?? Number.POSITIVE_INFINITY });
    }
    const byAddress = new Map<string, { from: number; to: number }[]>();
    for (let i = 0; i < spans.length; i++) {
        const span = spans[i]!;
        const list = byAddress.get(span.address);
        if (list) list.push(span);
        else byAddress.set(span.address, [span]);
    }
    for (const [address, list] of byAddress) {
        list.sort((a, b) => a.from - b.from);
        for (let i = 1; i < list.length; i++) {
            const prev = list[i - 1]!;
            const curr = list[i]!;
            if (curr.from <= prev.to) throw new Error(`watched address ${address} has overlapping generation windows`);
            if (curr.from > prev.to + 1) throw new Error(`watched address ${address} has a gap in generation windows`);
        }
    }
}

const DEFAULT_MAX_ANCHOR_BLOCKS = 100_000;
const HEADER_BATCH = 100;

function assertConfig(
    startBlock: number, maxBlocks: number, page: number | undefined, watched: readonly WatchedContract[],
    maxAnchorBlocks: number | undefined, chainId: number,
): void {
    assertChainId(chainId);
    assertWatched(watched, startBlock);
    if (!safeInt(maxBlocks, 1) || maxBlocks > responseLimits.ancestry) throw new Error('maxBlocks must be >= 1');
    if (page !== undefined && !safeInt(page, 1)) throw new Error('page must be >= 1');
    if (maxAnchorBlocks !== undefined && !safeInt(maxAnchorBlocks, 1)) throw new Error('maxAnchorBlocks must be >= 1');
}

/** Keep a short label. Anything else, including a credential, becomes a fixed reason. */
function safeReason(reason: unknown): string {
    if (typeof reason !== 'string' || reason.length < 1 || reason.length > 64) return 'attributor rejected';
    for (let i = 0; i < reason.length; i++) {
        const c = reason.charCodeAt(i);
        const ok = (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 32 || c === 46 || c === 95 || c === 45;
        if (!ok) return 'attributor rejected';
    }
    return reason;
}

function freezeAttributor(attributor: Attributor | undefined): Attributor | undefined {
    if (attributor === undefined) return undefined;
    const attribute = attributor.attribute;
    if (typeof attribute !== 'function') throw new Error('attributor is required');
    const bound = attribute.bind(attributor);
    return { attribute: (action) => bound(action) };
}

async function judge(
    attributor: Attributor | undefined, action: FoundAction,
): Promise<{ ok: true; attribution: unknown } | { ok: false; reason: string }> {
    if (!attributor) return { ok: false, reason: 'no attributor' };
    try {
        const result = await attributor.attribute(structuredClone(action));
        if (typeof result !== 'object' || result === null) return { ok: false, reason: 'attributor failed' };
        if (result.ok === true) {
            const attribution = result.attribution === undefined ? undefined : structuredClone(result.attribution);
            return { ok: true, attribution };
        }
        return { ok: false, reason: safeReason(result.reason) };
    } catch {
        return { ok: false, reason: 'attributor failed' };
    }
}

/** Evidence read. The string is a sanitized reason: stage and provider name, never the error text. */
/** `eth_chainId`. A bad answer is a config error and does not echo the payload. */
async function readChainId(rpc: RawRpc): Promise<number> {
    let raw: unknown;
    try {
        raw = await rpc.request({ method: 'eth_chainId', params: [] });
    } catch {
        throw new Error(`${rpc.name}: request failed`);
    }
    const got = quantity(raw);
    if (got === null || got < 1) throw new Error('chain id unreadable');
    return got;
}

async function readHeader(rpc: RawRpc, tag: number | 'finalized'): Promise<BlockHeader | string> {
    try {
        return await header(rpc, tag);
    } catch {
        return tag === 'finalized'
            ? `finalized read failed for ${rpc.name}`
            : `header read failed for ${rpc.name} at block ${tag}`;
    }
}

async function loadHeaders(rpc: RawRpc, from: number, to: number, limit: number): Promise<Map<number, BlockHeader> | string> {
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || to < from || to - from > limit) {
        return `finalized ancestry exceeds the bound on ${rpc.name}`;
    }
    const out = new Map<number, BlockHeader>();
    for (let start = from; start <= to; start += HEADER_BATCH) {
        const end = Math.min(to, start + HEADER_BATCH - 1);
        const nums = Array.from({ length: end - start + 1 }, (_, i) => start + i);
        const batch = await Promise.all(nums.map((n) => readHeader(rpc, n)));
        for (const item of batch) {
            if (typeof item === 'string') return item;
            out.set(item.number, item);
        }
    }
    return out;
}

async function readReceipts(rpc: RawRpc, hash: Hex): Promise<unknown[] | string> {
    try {
        const raw = await rpc.request({ method: 'eth_getBlockReceipts', params: [hash] });
        const copied = snapshotReceipts(raw);
        if (copied === 'too-large') return 'receipts too large';
        if (!copied) return `receipts read failed for ${rpc.name}`;
        return copied;
    } catch {
        return `receipts read failed for ${rpc.name}`;
    }
}

function asNorm(
    address: Address, topics: Hex[], data: Hex, blockNumber: number, blockHash: Hex, txHash: Hex,
    logIndex: number, removed: boolean,
): Norm {
    return {
        address, topics, data, blockNumber, blockHash, txHash, logIndex, removed,
        raw: {
            address, topics, data, blockHash, transactionHash: txHash, removed,
            blockNumber: numberToHex(blockNumber), logIndex: numberToHex(logIndex),
        },
    };
}

/**
 * receiptsRoot authenticates only (address, topics, data).
 * blockNumber and blockHash are taken from the header the receipts were checked against.
 * logIndex is the log's position in receipt order: transactions must already be 0..n-1,
 * and logs are counted in that order. A provided blockNumber, blockHash, or logIndex that
 * disagrees is its own error — it is not dropped.
 * transactionHash is the receipt's transactionHash. It must be a 32-byte word and match
 * the other provider. receiptsRoot does not prove it.
 */
function deriveLogs(raw: unknown[], block: number, hash: Hex): { logs: Norm[]; txs: string[] } | { error: string } {
    const badIndex = `receipt logIndex disagrees with receipt order at block ${block}`;
    const cannot = `cannot verify receipts at block ${block}`;
    if (raw.length > responseLimits.receipts) return { error: cannot };
    let cursor = 0;
    const logs: Norm[] = [];
    const txs: string[] = [];
    for (let i = 0; i < raw.length; i++) {
        const item = raw[i];
        if (typeof item !== 'object' || item === null) return { error: cannot };
        const rec = item as Record<string, unknown>;
        if (quantity(rec.transactionIndex) !== i) {
            return { error: `receipts are not ordered by transactionIndex at block ${block}` };
        }
        if (!isWord(rec.transactionHash)) return { error: cannot };
        const txHash = rec.transactionHash.toLowerCase() as Hex;
        if (rec.blockNumber !== undefined && quantity(rec.blockNumber) !== block) {
            return { error: `receipt blockNumber disagrees at block ${block}` };
        }
        if (rec.blockHash !== undefined && (!isWord(rec.blockHash) || rec.blockHash.toLowerCase() !== hash.toLowerCase())) {
            return { error: `receipt blockHash disagrees at block ${block}` };
        }
        txs.push(txHash);
        if (!Array.isArray(rec.logs) || rec.logs.length > responseLimits.logsPerReceipt) return { error: cannot };
        for (let j = 0; j < rec.logs.length; j++) {
            const entry = rec.logs[j];
            if (typeof entry !== 'object' || entry === null) return { error: cannot };
            const row = entry as Record<string, unknown>;
            if (typeof row.address !== 'string' || row.address.length !== 42 || !isAddress(row.address)) return { error: cannot };
            if (!isHexData(row.data) || !Array.isArray(row.topics) || row.topics.length > responseLimits.topics || row.topics.some((t) => !isWord(t))) {
                return { error: cannot };
            }
            if (row.transactionHash !== undefined && (!isWord(row.transactionHash) || row.transactionHash.toLowerCase() !== txHash)) {
                return { error: `receipt log transactionHash disagrees at block ${block}` };
            }
            if (row.transactionIndex !== undefined && quantity(row.transactionIndex) !== i) {
                return { error: `receipt log transactionIndex disagrees at block ${block}` };
            }
            const derived = cursor++;
            if (quantity(row.logIndex) !== derived) return { error: badIndex };
            const blockHash = isWord(row.blockHash) ? row.blockHash.toLowerCase() : null;
            if (quantity(row.blockNumber) !== block) return { error: `receipt log blockNumber disagrees at block ${block}` };
            if (blockHash !== hash.toLowerCase()) return { error: `receipt log blockHash disagrees at block ${block}` };
            logs.push(asNorm(
                getAddress(row.address),
                (row.topics as string[]).map((t) => t.toLowerCase() as Hex),
                row.data.toLowerCase() as Hex,
                block, hash.toLowerCase() as Hex, txHash, derived, row.removed === true,
            ));
        }
    }
    return { logs, txs };
}

/** Both providers' receipts must encode to the agreed header receiptsRoot. */
async function prove(
    pa: RawRpc, pb: RawRpc, block: number, hash: Hex, root: Hex,
): Promise<{ logs: Norm[] } | { error: string }> {
    const rawA = await readReceipts(pa, hash);
    if (typeof rawA === 'string') return { error: rawA };
    const rawB = await readReceipts(pb, hash);
    if (typeof rawB === 'string') return { error: rawB };
    const rootA = receiptsRootFromRpc(rawA);
    const rootB = receiptsRootFromRpc(rawB);
    if (!rootA || !rootB) return { error: `cannot verify receipts at block ${block}` };
    const want = root.toLowerCase();
    if (rootA.toLowerCase() !== want || rootB.toLowerCase() !== want) {
        return { error: `receipts do not match receiptsRoot at block ${block}` };
    }
    const logsA = deriveLogs(rawA, block, hash);
    const logsB = deriveLogs(rawB, block, hash);
    if ('error' in logsA) return logsA;
    if ('error' in logsB) return logsB;
    if (logsA.txs.join() !== logsB.txs.join()) return { error: `providers disagree on transactionHash at block ${block}` };
    if (!sameLogs(logsA.logs, logsB.logs)) {
        const removed = logsA.logs.find((log) => log.removed) ?? logsB.logs.find((log) => log.removed);
        if (removed) return { error: `removed log from ${removed.address} at block ${block}` };
        return { error: `providers disagree on receipts at block ${block}` };
    }
    const agreed = logsA.logs.find((log) => log.removed);
    if (agreed) return { error: `removed log from ${agreed.address} at block ${block}` };
    return { logs: logsA.logs };
}

/**
 * Parent hashes from `to + 1` through this provider's finalized height.
 * Headers are read in batches of 100. A gap above `maxAnchorBlocks` is not fetched.
 */
async function anchor(rpc: RawRpc, fin: BlockHeader, tip: Hex, to: number, maxAnchorBlocks: number): Promise<string | null> {
    if (fin.number > to && fin.number - to > maxAnchorBlocks) {
        return `finalized ancestry exceeds the bound on ${rpc.name}`;
    }
    if (fin.number <= to) return null;
    const headers = await loadHeaders(rpc, to + 1, fin.number, maxAnchorBlocks);
    if (typeof headers === 'string') return headers;
    let prev = tip;
    for (let n = to + 1; n <= fin.number; n++) {
        const item = headers.get(n);
        if (!item || item.parentHash.toLowerCase() !== prev.toLowerCase()) {
            return `finalized ancestry breaks at block ${n} on ${rpc.name}`;
        }
        prev = item.hash;
    }
    if (prev.toLowerCase() !== fin.hash.toLowerCase()) {
        return `finalized ancestry breaks at block ${fin.number} on ${rpc.name}`;
    }
    return null;
}

/**
 * Caught-up window: finalized must still reach the checkpoint.
 * An equal height carries the checkpoint hash. A greater height walks parentHash
 * from finalized down to the checkpoint block. Nothing here commits.
 */
async function bindFinalized(
    pa: RawRpc, pb: RawRpc, finA: BlockHeader, finB: BlockHeader, saved: Checkpoint, maxAnchorBlocks: number,
): Promise<string | null> {
    const want = saved.hash.toLowerCase();
    for (const { rpc, fin } of [{ rpc: pa, fin: finA }, { rpc: pb, fin: finB }]) {
        if (fin.number < saved.block) return `finalized height fell behind block ${saved.block} on ${rpc.name}`;
        if (fin.number === saved.block && fin.hash.toLowerCase() !== want) {
            return `finalized hash disagrees with header at block ${saved.block} on ${rpc.name}`;
        }
        if (fin.number > saved.block) {
            const broken = await anchor(rpc, fin, saved.hash, saved.block, maxAnchorBlocks);
            if (broken) return broken;
        }
    }
    return null;
}

/**
 * Fresh store, nothing to scan: heights may differ. The headers at the lower
 * finalized height must carry the same hash. No log read.
 */
async function agreeFinalized(pa: RawRpc, pb: RawRpc, finA: BlockHeader, finB: BlockHeader): Promise<string | null> {
    const min = Math.min(finA.number, finB.number);
    const ha = await readHeader(pa, min);
    if (typeof ha === 'string') return ha;
    const hb = await readHeader(pb, min);
    if (typeof hb === 'string') return hb;
    if (ha.hash.toLowerCase() !== hb.hash.toLowerCase()) return `providers disagree on block hash at ${min}`;
    if (finA.number === min && finA.hash.toLowerCase() !== ha.hash.toLowerCase()) {
        return `finalized hash disagrees with header at block ${min} on ${pa.name}`;
    }
    if (finB.number === min && finB.hash.toLowerCase() !== hb.hash.toLowerCase()) {
        return `finalized hash disagrees with header at block ${min} on ${pb.name}`;
    }
    return null;
}

function attributedOf(action: FoundAction): AttributedAction {
    return {
        id: unresolvedId(action.blockHash, action.logIndex),
        blockNumber: action.blockNumber, blockHash: action.blockHash, txHash: action.txHash,
        logIndex: action.logIndex, address: action.address, kind: action.kind,
        decoded: action.decoded, log: action.log, attribution: action.attribution,
    };
}

function freezeProvider(rpc: RawRpc): RawRpc {
    const name = rpc.name;
    const request = rpc.request.bind(rpc);
    return { name, request };
}

/** Field copy. `decode` is the function reference from the call, not a later replacement. */
function freezeWatched(watched: readonly WatchedContract[]): WatchedContract[] {
    return watched.map((contract) => ({
        address: contract.address,
        fromBlock: contract.fromBlock,
        toBlock: contract.toBlock,
        generation: contract.generation,
        decode: contract.decode,
    }));
}

/**
 * Typed conflicts keep their class and lose the store's object.
 * A fixed message cannot carry an endpoint, and the new error has no cause.
 */
function storeFailure(stage: 'snapshot' | 'commit', error: unknown): never {
    if (error instanceof StoreConflictError) throw new StoreConflictError('store revision conflict');
    if (error instanceof ScopeChangedError) throw new ScopeChangedError();
    if (error instanceof FinalityConflictError) throw new FinalityConflictError('finality conflict');
    throw new Error(`guardian audit store ${stage} failed`);
}

/**
 * Scan `(checkpoint, min(finalized A, finalized B)]`, at most `maxBlocks`.
 * COMPLETE / UNATTRIBUTED commit the checkpoint. INCOMPLETE writes nothing.
 *
 * Under the two-provider trust model (agreed headers are trusted; a block whose
 * agreed bloom excludes the watched address is not receipt-proven). receiptsRoot,
 * logsBloom, and parentHash are trusted because both providers agree on them and
 * parentHash reaches each provider's finalized header. The header hash itself is
 * not recomputed: several header fields are fork-dependent. Both providers may
 * share an upstream.
 * A clipped range (`to` below finalized) re-walks headers from `to + 1` through
 * finalized on every scan, on both providers. Headers walked per provider are about
 * `finalized - to`, in batches of 100. `maxAnchorBlocks` (default 100_000) caps that
 * walk. A larger gap is INCOMPLETE, the checkpoint stays, and the next scan walks
 * the same gap again. This scan does not cache anchor headers.
 * Recovery when `finalized - to > maxAnchorBlocks`: raise `maxAnchorBlocks` to at
 * least `finalized - to` for the catch-up run, or raise `maxBlocks` so the scanned
 * tip lands inside the bound. `to = min(finalized, from + maxBlocks - 1)`, and the
 * walk fits when `to >= finalized - maxAnchorBlocks`, so
 * `maxBlocks >= finalized - maxAnchorBlocks - from + 1`. A keeper more than
 * 100_000 blocks behind (about 2.3 days on OP at a 2 second block time) does not
 * recover on the defaults.
 * Request timeouts belong to the caller's transport. scanRange does not time out a request.
 * A fresh store whose `startBlock` is already past finalized still compares both
 * providers. Heights may differ. Header hashes must agree at the lower height.
 * That result is COMPLETE with count 0 only after the comparison, and it carries
 * `range: { from, to, empty: true }` so the caller can see that nothing was scanned.
 * Each scan takes one snapshot and commits against that revision. The commit is
 * all-or-nothing: a stale revision throws StoreConflictError and writes nothing,
 * whether or not `next` moves the checkpoint. Two scans may run together. The one
 * that commits second fails, including a caught-up scan whose checkpoint does not change.
 * INCOMPLETE does not commit. The checkpoint value itself is not the concurrency token.
 * A caught-up scan (`from > to`) still binds finalized to the checkpoint before it commits:
 * height must reach the checkpoint block, an equal height must carry its hash, and a
 * greater height must walk parentHash back to that block. A break commits nothing.
 * The stored scope hashes chainId, startBlock, and each watched generation
 * (address, fromBlock, toBlock). Windows of one address must be contiguous.
 * The first commit records the scope. A later scan whose scope differs throws
 * ScopeChangedError before any chain read. A changed watch set or chain needs a
 * new store (a backfill), never a silent resume.
 * The attributor runs before commit. Its side effects are not rolled back when
 * commit throws StoreConflictError.
 * Providers, watched entries, the attributor, and numeric options are copied before the first await.
 * Later reads use that copy, so the caller cannot clear the watch set or replace the attributor in flight.
 * The store snapshot is deep-copied once, immediately after it is read. Later reads use that copy.
 * Decoder and attributor results are cloned before the next callback. A provider response is copied
 * before the other provider is awaited.
 * A decoder returning `'ignore'` is a trusted classification. The unknown-topic guarantee
 * covers a null decode, not a decoder that misclassifies a known guardian topic as `'ignore'`.
 * `decoded.kind` must be a non-empty string. Anything else is INCOMPLETE.
 */
export async function scanRange(opts: ScanRangeOptions): Promise<ScanResult> {
    const providers = opts.providers;
    const count = providers.length;
    const left = providers[0];
    const right = providers[1];
    if (count !== 2 || !left || !right) throw new Error('guardian audit requires two distinct providers');
    const pa = freezeProvider(left);
    const pb = freezeProvider(right);
    const sharedRequest = left.request === right.request
        && Object.prototype.hasOwnProperty.call(left, 'request')
        && Object.prototype.hasOwnProperty.call(right, 'request');
    if (left === right || pa.name === pb.name || pa.request === pb.request || sharedRequest) {
        throw new Error('guardian audit requires two distinct providers');
    }
    const watched = freezeWatched(opts.watched);
    const startBlock = opts.startBlock;
    const maxBlocks = opts.maxBlocks;
    const pageOption = opts.page;
    const anchorOption = opts.maxAnchorBlocks;
    const chainId = opts.chainId;
    const store = opts.store;
    const attributor = freezeAttributor(opts.attributor);
    assertName(pa.name);
    assertName(pb.name);
    assertConfig(startBlock, maxBlocks, pageOption, watched, anchorOption, chainId);
    const page = pageOption ?? 2000;
    const maxAnchorBlocks = anchorOption ?? DEFAULT_MAX_ANCHOR_BLOCKS;
    const scope = watchScope(watched, startBlock, chainId);
    let snap: StoreSnapshot;
    try {
        snap = structuredClone(await store.snapshot());
    } catch (error) {
        storeFailure('snapshot', error);
    }
    if (snap.scope !== null && snap.scope.toLowerCase() !== scope.toLowerCase()) throw new ScopeChangedError();
    const [idA, idB] = await Promise.all([readChainId(pa), readChainId(pb)]);
    if (idA !== chainId || idB !== chainId) throw new Error('chain id mismatch');
    const finA = await readHeader(pa, 'finalized');
    if (typeof finA === 'string') return { state: 'INCOMPLETE', reasons: [finA], from: startBlock };
    const finB = await readHeader(pb, 'finalized');
    if (typeof finB === 'string') return { state: 'INCOMPLETE', reasons: [finB], from: startBlock };
    const saved = snap.checkpoint;
    if (saved) {
        const ha = await readHeader(pa, saved.block);
        if (typeof ha === 'string') return { state: 'INCOMPLETE', reasons: [ha], from: saved.block };
        const hb = await readHeader(pb, saved.block);
        if (typeof hb === 'string') return { state: 'INCOMPLETE', reasons: [hb], from: saved.block };
        const want = saved.hash.toLowerCase();
        if (ha.hash.toLowerCase() !== want || hb.hash.toLowerCase() !== want) {
            throw new FinalityConflictError(`checkpoint block ${saved.block} hash conflict on ${pa.name}/${pb.name}`);
        }
    }
    const from = saved ? saved.block + 1 : startBlock;
    const to = Math.min(finA.number, finB.number, from + maxBlocks - 1);
    if (from > to) {
        const why = saved
            ? await bindFinalized(pa, pb, finA, finB, saved, maxAnchorBlocks)
            : await agreeFinalized(pa, pb, finA, finB);
        if (why) return bad(from, to, why);
        return finish(watched, attributor, store, [], from, to, 0, 0, null, snap, scope, true);
    }

    const buckets: Bucket[] = [];
    for (const contract of watched) {
        const address = getAddress(contract.address);
        const lo = Math.max(from, contract.fromBlock);
        const hi = Math.min(to, contract.toBlock ?? to);
        if (lo <= hi) buckets.push({ contract, address, lo, hi, logs: [] });
    }
    for (const bucket of buckets) {
        let rawA: unknown[];
        let rawB: unknown[];
        try {
            rawA = await pagedLogs(pa, bucket.address, bucket.lo, bucket.hi, page);
        } catch {
            return bad(from, to, `range log read failed for ${pa.name}`);
        }
        try {
            rawB = await pagedLogs(pb, bucket.address, bucket.lo, bucket.hi, page);
        } catch {
            return bad(from, to, `range log read failed for ${pb.name}`);
        }
        const a = parseAll(rawA, bucket.address, bucket.lo, bucket.hi);
        const b = parseAll(rawB, bucket.address, bucket.lo, bucket.hi);
        if ('error' in a) return bad(from, to, a.error);
        if ('error' in b) return bad(from, to, b.error);
        if (!sameLogs(a.logs, b.logs)) return bad(from, to, `providers disagree on logs of ${bucket.address}`);
        bucket.logs = a.logs;
    }

    // Headers of one provider at a time, ≤100 in flight.
    const headersA = await loadHeaders(pa, from, to, responseLimits.ancestry);
    if (typeof headersA === 'string') return bad(from, to, headersA);
    const headersB = await loadHeaders(pb, from, to, responseLimits.ancestry);
    if (typeof headersB === 'string') return bad(from, to, headersB);
    let bloomFalsePositives = 0;
    for (let n = from; n <= to; n++) {
        const ha = headersA.get(n);
        const hb = headersB.get(n);
        if (!ha || !hb) return bad(from, to, `missing header for block ${n}`);
        if (ha.hash.toLowerCase() !== hb.hash.toLowerCase()) return bad(from, to, `providers disagree on block hash at ${n}`);
        if (ha.logsBloom === null || hb.logsBloom === null) return bad(from, to, `unreadable logsBloom at block ${n}`);
        if (ha.logsBloom.toLowerCase() !== hb.logsBloom.toLowerCase()) {
            return bad(from, to, `providers disagree on logsBloom at block ${n}`);
        }
        if (ha.receiptsRoot.toLowerCase() !== hb.receiptsRoot.toLowerCase()) {
            return bad(from, to, `providers disagree on receiptsRoot at block ${n}`);
        }
        const prevA = n === from ? (saved ? saved.hash : null) : headersA.get(n - 1)!.hash;
        const prevB = n === from ? (saved ? saved.hash : null) : headersB.get(n - 1)!.hash;
        if (prevA !== null && ha.parentHash.toLowerCase() !== prevA.toLowerCase()) {
            return bad(from, to, `parentHash breaks at block ${n} on ${pa.name}`);
        }
        if (prevB !== null && hb.parentHash.toLowerCase() !== prevB.toLowerCase()) {
            return bad(from, to, `parentHash breaks at block ${n} on ${pb.name}`);
        }
        let proved: { logs: Norm[] } | null = null;
        for (const bucket of buckets) {
            if (n < bucket.lo || n > bucket.hi) continue;
            const have = bucket.logs.filter((log) => log.blockNumber === n);
            const may = mayContainAddress(ha.logsBloom, bucket.address) === true
                || mayContainAddress(hb.logsBloom, bucket.address) === true;
            if (!may && have.length === 0) continue;
            if (!proved) {
                const got = await prove(pa, pb, n, ha.hash, ha.receiptsRoot);
                if ('error' in got) return bad(from, to, got.error);
                proved = got;
            }
            const want = proved.logs.filter((log) => log.address === bucket.address);
            if (!sameLogs(have, want)) {
                const seen = new Set(have.map(keyOf));
                const reason = want.some((log) => !seen.has(keyOf(log)))
                    ? `range logs omit a log present in the verified receipts at block ${n}`
                    : `range logs disagree with verified receipts at block ${n}`;
                return bad(from, to, reason);
            }
            if (may && want.length === 0) bloomFalsePositives++;
        }
    }
    for (const bucket of buckets) {
        for (const log of bucket.logs) {
            const h = headersA.get(log.blockNumber);
            if (!h || log.blockHash !== h.hash.toLowerCase()) {
                return bad(from, to, `log blockHash disagrees with header at block ${log.blockNumber}`);
            }
        }
    }
    const tipHeader = headersA.get(to);
    const tipB = headersB.get(to);
    if (!tipHeader || !tipB) return bad(from, to, `missing header for block ${to}`);
    if (to === finA.number && tipHeader.hash.toLowerCase() !== finA.hash.toLowerCase()) {
        return bad(from, to, `finalized hash disagrees with header at block ${to} on ${pa.name}`);
    }
    if (to === finB.number && tipB.hash.toLowerCase() !== finB.hash.toLowerCase()) {
        return bad(from, to, `finalized hash disagrees with header at block ${to} on ${pb.name}`);
    }
    const againA = await readHeader(pa, 'finalized');
    if (typeof againA === 'string') return bad(from, to, againA);
    const againB = await readHeader(pb, 'finalized');
    if (typeof againB === 'string') return bad(from, to, againB);
    if (againA.number < to) return bad(from, to, `finalized height fell behind block ${to} on ${pa.name}`);
    if (againB.number < to) return bad(from, to, `finalized height fell behind block ${to} on ${pb.name}`);
    if (againA.number === to && againA.hash.toLowerCase() !== tipHeader.hash.toLowerCase()) {
        return bad(from, to, `finalized hash moved at block ${to} on ${pa.name}`);
    }
    if (againB.number === to && againB.hash.toLowerCase() !== tipB.hash.toLowerCase()) {
        return bad(from, to, `finalized hash moved at block ${to} on ${pb.name}`);
    }
    const breakA = await anchor(pa, againA, tipHeader.hash, to, maxAnchorBlocks);
    if (breakA) return bad(from, to, breakA);
    const breakB = await anchor(pb, againB, tipB.hash, to, maxAnchorBlocks);
    if (breakB) return bad(from, to, breakB);

    const actions: FoundAction[] = [];
    let ignored = 0;
    for (const bucket of buckets) {
        for (const log of bucket.logs) {
            const decoded = callDecode(bucket.contract, log.raw, bucket.address, log.blockNumber);
            if (!decoded.ok) return bad(from, to, decoded.reason);
            if (decoded.value === null) {
                return bad(from, to, `undecodable topic0 ${log.topics[0] ?? '0x'} from ${bucket.address} at block ${log.blockNumber}`);
            }
            if (decoded.value === 'ignore') { ignored++; continue; }
            const kind = actionKind(decoded.value);
            if (!kind) return bad(from, to, 'decoder returned an invalid kind');
            actions.push({
                blockNumber: log.blockNumber, blockHash: log.blockHash, txHash: log.txHash, logIndex: log.logIndex,
                address: bucket.address, kind, decoded: decoded.value, log: decoded.log,
            });
        }
    }
    return finish(
        watched, attributor, store, actions, from, to, bloomFalsePositives, ignored,
        tipHeader.hash.toLowerCase() as Hex, snap, scope,
    );
}

async function finish(
    watched: readonly WatchedContract[], attributor: Attributor | undefined, store: GuardianAuditStore,
    actions: FoundAction[], from: number, to: number,
    bloomFalsePositives: number, ignored: number, tip: Hex | null,
    snap: StoreSnapshot, scope: Hex, emptyRange = false,
): Promise<ScanResult> {
    actions.sort((x, y) => x.blockNumber - y.blockNumber || x.logIndex - y.logIndex);
    const resolvedPrior: FoundAction[] = [];
    const stale: UnresolvedAction[] = [];
    let stillPrior = 0;
    for (const item of snap.unresolved) {
        const again = revive(watched, item);
        if (again && 'incomplete' in again) return bad(from, to, again.incomplete);
        if (!again) {
            stillPrior++;
            stale.push({ ...item, reason: 'stored action no longer decodable' });
            continue;
        }
        const outcome = await judge(attributor, again);
        if (!outcome.ok) { stillPrior++; continue; }
        again.attribution = outcome.attribution;
        resolvedPrior.push(again);
    }
    resolvedPrior.sort((x, y) => x.blockNumber - y.blockNumber || x.logIndex - y.logIndex);
    const accepted: AttributedAction[] = resolvedPrior.map(attributedOf);
    const fresh: UnresolvedAction[] = [];
    for (const action of actions) {
        const outcome = await judge(attributor, action);
        if (outcome.ok) {
            action.attribution = outcome.attribution;
            accepted.push(attributedOf(action));
            continue;
        }
        fresh.push({
            id: unresolvedId(action.blockHash, action.logIndex),
            blockNumber: action.blockNumber, blockHash: action.blockHash, txHash: action.txHash,
            logIndex: action.logIndex, address: action.address, kind: action.kind, reason: outcome.reason, log: action.log,
        });
    }
    const payload = {
        expectedRevision: snap.revision,
        next: tip ? { block: to, hash: tip } : null,
        scope,
        attributed: accepted,
        unresolved: [...stale, ...fresh],
        resolve: resolvedPrior.map((action) => unresolvedId(action.blockHash, action.logIndex)),
    };
    try {
        await store.commit(structuredClone(payload));
    } catch (error) {
        storeFailure('commit', error);
    }
    const stats: ScanStats = {
        bloomFalsePositives, ignored, count: actions.length, from, to, actions, resolvedPrior,
    };
    const range = emptyRange ? { from, to, empty: true as const } : undefined;
    return stillPrior + fresh.length > 0
        ? { state: 'UNATTRIBUTED', unattributed: stillPrior + fresh.length, ...stats, ...(range ? { range } : {}) }
        : { state: 'COMPLETE', ...stats, ...(range ? { range } : {}) };
}
