import { getAddress, isAddress, numberToHex, type Address, type Hex } from 'viem';
import { mayContainAddress } from './bloom.js';
import { header, isHexData, isWord, pagedLogs, quantity, type BlockHeader, type RawLog, type RawRpc } from './rpc.js';
import {
    unresolvedId,
    type AttributedAction,
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
    /** `null` = unknown topic0 for this generation. `'ignore'` = known, not a guardian action. */
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
    attributor?: Attributor;
    page?: number;
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
    | (ScanStats & { state: 'COMPLETE' })
    | (ScanStats & { state: 'UNATTRIBUTED'; unattributed: number })
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
    return [log.blockHash, log.logIndex, log.txHash, log.address, log.topics.join(','), log.data].join('|').toLowerCase();
}

function parseLog(raw: unknown): Norm | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const o = raw as Record<string, unknown>;
    const blockNumber = quantity(o.blockNumber);
    const logIndex = quantity(o.logIndex);
    if (blockNumber === null || logIndex === null) return null;
    if (typeof o.address !== 'string' || !isAddress(o.address)) return null;
    if (!isWord(o.blockHash) || !isWord(o.transactionHash) || !isHexData(o.data)) return null;
    if (!Array.isArray(o.topics) || o.topics.some((t) => !isWord(t))) return null;
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
    const logs: Norm[] = [];
    for (const raw of raws) {
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
    try {
        return { ok: true, value: contract.decode(structuredClone(log)), log };
    } catch {
        return { ok: false, reason: `decoder threw for ${address} at block ${block}` };
    }
}

/** Re-decode a stored row through the generation that owns its block. `null` = keep it unresolved. */
function revive(
    watched: readonly WatchedContract[], item: UnresolvedAction,
): FoundAction | { incomplete: string } | null {
    const address = getAddress(item.address);
    const contract = watched.find((c) => covers(c, address, item.blockNumber));
    if (!contract) return null;
    const decoded = callDecode(contract, item.log, address, item.blockNumber);
    if (!decoded.ok) return { incomplete: decoded.reason };
    if (decoded.value === null || decoded.value === 'ignore') return null;
    return {
        blockNumber: item.blockNumber, blockHash: item.blockHash, txHash: item.txHash, logIndex: item.logIndex,
        address, kind: decoded.value.kind, decoded: decoded.value, log: decoded.log,
    };
}

function assertConfig(opts: ScanRangeOptions): void {
    if (!safeInt(opts.startBlock, 0)) throw new Error('startBlock must be >= 0');
    if (!safeInt(opts.maxBlocks, 1)) throw new Error('maxBlocks must be >= 1');
    if (opts.page !== undefined && !safeInt(opts.page, 1)) throw new Error('page must be >= 1');
    const spans: { address: Address; from: number; to: number }[] = [];
    for (const contract of opts.watched) {
        const address = getAddress(contract.address);
        if (!safeInt(contract.fromBlock, 0)) throw new Error(`invalid fromBlock for ${address}`);
        if (contract.toBlock !== undefined && !safeInt(contract.toBlock, 0)) throw new Error(`invalid toBlock for ${address}`);
        if (contract.toBlock !== undefined && contract.toBlock < contract.fromBlock) {
            throw new Error(`toBlock precedes fromBlock for ${address}`);
        }
        const end = contract.toBlock ?? Number.POSITIVE_INFINITY;
        for (const prev of spans) {
            if (prev.address === address && prev.from <= end && contract.fromBlock <= prev.to) {
                throw new Error(`watched address ${address} has overlapping generation windows`);
            }
        }
        spans.push({ address, from: contract.fromBlock, to: end });
    }
}

/** Drop a URL if an attributor puts one in its reason. Our own reasons never have one. */
function safeReason(reason: string): string {
    return reason.includes('://') ? 'attributor rejected' : reason;
}

async function judge(
    attributor: Attributor | undefined, action: FoundAction,
): Promise<{ ok: true; attribution: unknown } | { ok: false; reason: string }> {
    if (!attributor) return { ok: false, reason: 'no attributor' };
    try {
        const result = await attributor.attribute(structuredClone(action));
        return result.ok ? { ok: true, attribution: result.attribution } : { ok: false, reason: safeReason(result.reason) };
    } catch {
        return { ok: false, reason: 'attributor failed' };
    }
}

/** Evidence read. The string is a sanitized reason: stage and provider name, never the error text. */
async function readHeader(rpc: RawRpc, tag: number | 'finalized'): Promise<BlockHeader | string> {
    try {
        return await header(rpc, tag);
    } catch {
        return tag === 'finalized'
            ? `finalized read failed for ${rpc.name}`
            : `header read failed for ${rpc.name} at block ${tag}`;
    }
}

async function loadHeaders(rpc: RawRpc, from: number, to: number): Promise<Map<number, BlockHeader> | string> {
    const out = new Map<number, BlockHeader>();
    for (let start = from; start <= to; start += 100) {
        const end = Math.min(to, start + 99);
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
        if (!Array.isArray(raw)) return `receipts read failed for ${rpc.name}`;
        return raw;
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
 * disagrees is an error — it is not dropped.
 * transactionHash is the receipt's transactionHash. It must be a 32-byte word and match
 * the other provider. receiptsRoot does not prove it.
 */
function deriveLogs(raw: unknown[], block: number, hash: Hex): { logs: Norm[]; txs: string[] } | { error: string } {
    const badMeta = `receipt log metadata disagrees at block ${block}`;
    const badIndex = `receipt logIndex disagrees with receipt order at block ${block}`;
    const cannot = `cannot verify receipts at block ${block}`;
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
        txs.push(txHash);
        if (!Array.isArray(rec.logs)) return { error: cannot };
        for (const entry of rec.logs) {
            if (typeof entry !== 'object' || entry === null) return { error: cannot };
            const row = entry as Record<string, unknown>;
            if (typeof row.address !== 'string' || !isAddress(row.address)) return { error: cannot };
            if (!isHexData(row.data) || !Array.isArray(row.topics) || row.topics.some((t) => !isWord(t))) {
                return { error: cannot };
            }
            const derived = cursor++;
            if (quantity(row.logIndex) !== derived) return { error: badIndex };
            const blockHash = isWord(row.blockHash) ? row.blockHash.toLowerCase() : null;
            if (quantity(row.blockNumber) !== block || blockHash !== hash.toLowerCase()) return { error: badMeta };
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
    if (!sameLogs(logsA.logs, logsB.logs)) return { error: `providers disagree on receipts at block ${block}` };
    return { logs: logsA.logs };
}

/**
 * Parent hashes from `to + 1` through this provider's finalized height.
 * Cost is one header per block of (finalized - to), in batches of at most 100.
 */
async function anchor(rpc: RawRpc, fin: BlockHeader, tip: Hex, to: number): Promise<string | null> {
    if (fin.number <= to) return null;
    const headers = await loadHeaders(rpc, to + 1, fin.number);
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

function attributedOf(action: FoundAction): AttributedAction {
    return {
        id: unresolvedId(action.blockHash, action.logIndex),
        blockNumber: action.blockNumber, blockHash: action.blockHash, txHash: action.txHash,
        logIndex: action.logIndex, address: action.address, kind: action.kind,
        decoded: action.decoded, log: action.log, attribution: action.attribution,
    };
}

/**
 * Scan `(checkpoint, min(finalized A, finalized B)]`, at most `maxBlocks`.
 * COMPLETE / UNATTRIBUTED commit the checkpoint. INCOMPLETE writes nothing.
 *
 * receiptsRoot, logsBloom, and parentHash are trusted because both providers agree
 * on them and parentHash reaches each provider's finalized header. The header hash
 * itself is not recomputed: several header fields are fork-dependent.
 * A clipped range (`to` below finalized) reads every header from `to + 1` through
 * that provider's finalized height, so the cost grows with (finalized - to), per provider.
 * Each scan takes one snapshot and commits against that revision. The commit is
 * all-or-nothing: a stale revision throws StoreConflictError and writes nothing,
 * whether or not `next` moves the checkpoint. Two scans may run together. The one
 * that commits second fails, including a caught-up scan whose checkpoint does not change.
 * INCOMPLETE does not commit. The checkpoint value itself is not the concurrency token.
 */
export async function scanRange(opts: ScanRangeOptions): Promise<ScanResult> {
    const [pa, pb] = opts.providers;
    if (opts.providers.length !== 2 || pa === pb || pa.name === pb.name) {
        throw new Error('guardian audit requires two distinct providers');
    }
    assertConfig(opts);
    const finA = await readHeader(pa, 'finalized');
    if (typeof finA === 'string') return { state: 'INCOMPLETE', reasons: [finA], from: opts.startBlock };
    const finB = await readHeader(pb, 'finalized');
    if (typeof finB === 'string') return { state: 'INCOMPLETE', reasons: [finB], from: opts.startBlock };
    const snap = await opts.store.snapshot();
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
    const from = saved ? saved.block + 1 : opts.startBlock;
    const to = Math.min(finA.number, finB.number, from + opts.maxBlocks - 1);
    if (from > to) return finish(opts, [], from, to, 0, 0, null, snap);

    const buckets: Bucket[] = [];
    for (const contract of opts.watched) {
        const address = getAddress(contract.address);
        const lo = Math.max(from, contract.fromBlock);
        const hi = Math.min(to, contract.toBlock ?? to);
        if (lo <= hi) buckets.push({ contract, address, lo, hi, logs: [] });
    }
    const page = opts.page ?? 2000;
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
    const headersA = await loadHeaders(pa, from, to);
    if (typeof headersA === 'string') return bad(from, to, headersA);
    const headersB = await loadHeaders(pb, from, to);
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
            if (want.some((log) => log.removed)) return bad(from, to, `removed log from ${bucket.address} at block ${n}`);
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
    const breakA = await anchor(pa, againA, tipHeader.hash, to);
    if (breakA) return bad(from, to, breakA);
    const breakB = await anchor(pb, againB, tipB.hash, to);
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
            actions.push({
                blockNumber: log.blockNumber, blockHash: log.blockHash, txHash: log.txHash, logIndex: log.logIndex,
                address: bucket.address, kind: decoded.value.kind, decoded: decoded.value, log: decoded.log,
            });
        }
    }
    return finish(opts, actions, from, to, bloomFalsePositives, ignored, tipHeader.hash.toLowerCase() as Hex, snap);
}

async function finish(
    opts: ScanRangeOptions, actions: FoundAction[], from: number, to: number,
    bloomFalsePositives: number, ignored: number, tip: Hex | null,
    snap: StoreSnapshot,
): Promise<ScanResult> {
    actions.sort((x, y) => x.blockNumber - y.blockNumber || x.logIndex - y.logIndex);
    const resolvedPrior: FoundAction[] = [];
    const stale: UnresolvedAction[] = [];
    let stillPrior = 0;
    for (const item of snap.unresolved) {
        const again = revive(opts.watched, item);
        if (again && 'incomplete' in again) return bad(from, to, again.incomplete);
        if (!again) {
            stillPrior++;
            stale.push({ ...item, reason: 'stored action no longer decodable' });
            continue;
        }
        const outcome = await judge(opts.attributor, again);
        if (!outcome.ok) { stillPrior++; continue; }
        again.attribution = outcome.attribution;
        resolvedPrior.push(again);
    }
    resolvedPrior.sort((x, y) => x.blockNumber - y.blockNumber || x.logIndex - y.logIndex);
    const accepted: AttributedAction[] = resolvedPrior.map(attributedOf);
    const fresh: UnresolvedAction[] = [];
    for (const action of actions) {
        const outcome = await judge(opts.attributor, action);
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
    await opts.store.commit({
        expectedRevision: snap.revision,
        next: tip ? { block: to, hash: tip } : null,
        attributed: accepted,
        unresolved: [...stale, ...fresh],
        resolve: resolvedPrior.map((action) => unresolvedId(action.blockHash, action.logIndex)),
    });
    const stats: ScanStats = {
        bloomFalsePositives, ignored, count: actions.length, from, to, actions, resolvedPrior,
    };
    return stillPrior + fresh.length > 0
        ? { state: 'UNATTRIBUTED', unattributed: stillPrior + fresh.length, ...stats }
        : { state: 'COMPLETE', ...stats };
}
