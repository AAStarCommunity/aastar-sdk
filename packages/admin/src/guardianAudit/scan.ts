import { getAddress, isAddress, numberToHex, type Address, type Hex } from 'viem';
import { mayContainAddress } from './bloom.js';
import { header, isHexData, isWord, pagedLogs, quantity, rawGetLogs, type BlockHeader, type RawLog, type RawRpc } from './rpc.js';
import {
    unresolvedId,
    type AttributedAction,
    type Checkpoint,
    type GuardianAuditStore,
    type UnresolvedAction,
} from './store.js';

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
    bloomRecovered: number;
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

/** Logs only in by-hash are merged. Logs only in the range answer are a disagreement. */
function reconcile(range: Norm[], byHash: Norm[]): { merge: Norm[] } | { error: string } {
    const seen = new Set(byHash.map(keyOf));
    if (range.some((log) => !seen.has(keyOf(log)))) return { error: 'range and by-hash logs disagree' };
    const have = new Set(range.map(keyOf));
    return { merge: byHash.filter((log) => !have.has(keyOf(log))) };
}

function covers(contract: WatchedContract, address: Address, block: number): boolean {
    if (getAddress(contract.address) !== address) return false;
    if (block < contract.fromBlock) return false;
    return contract.toBlock === undefined || block <= contract.toBlock;
}

function callDecode(
    contract: WatchedContract, log: RawLog, address: Address, block: number,
): { ok: true; value: DecodedAction | 'ignore' | null } | { ok: false; reason: string } {
    try {
        return { ok: true, value: contract.decode(log) };
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
        address, kind: decoded.value.kind, decoded: decoded.value, log: item.log,
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
        const result = await attributor.attribute(action);
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

async function reread(pa: RawRpc, pb: RawRpc, bucket: Bucket, block: number, hash: Hex): Promise<{ logs: Norm[] } | { error: string }> {
    let rawA: unknown[];
    let rawB: unknown[];
    try {
        rawA = await rawGetLogs(pa, { address: bucket.address, blockHash: hash });
    } catch {
        return { error: `by-hash log read failed for ${pa.name}` };
    }
    try {
        rawB = await rawGetLogs(pb, { address: bucket.address, blockHash: hash });
    } catch {
        return { error: `by-hash log read failed for ${pb.name}` };
    }
    const a = parseAll(rawA, bucket.address, bucket.lo, bucket.hi);
    const b = parseAll(rawB, bucket.address, bucket.lo, bucket.hi);
    if ('error' in a) return a;
    if ('error' in b) return b;
    if (!sameLogs(a.logs, b.logs)) return { error: `providers disagree on logs of ${bucket.address}` };
    const want = hash.toLowerCase();
    for (const log of a.logs) {
        if (log.blockNumber !== block) {
            return { error: `by-hash answer for ${bucket.address} contains block ${log.blockNumber}, not ${block}` };
        }
        if (log.blockHash !== want) {
            return { error: `by-hash log blockHash disagrees with the requested hash at block ${block}` };
        }
    }
    return { logs: a.logs };
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
 * COMPLETE / UNATTRIBUTED move the checkpoint. INCOMPLETE writes nothing.
 *
 * A clipped range (`to` below a provider's finalized height) is tied to finality
 * only by parentHash continuity from a checkpoint whose hash matched, and by the
 * post-read check that finalized height is still >= `to`. `setCheckpoint` is
 * compare-and-swap against the checkpoint read at the start; the store must apply
 * it atomically. An overlapping scan throws CheckpointConflictError instead of
 * moving the cursor backwards.
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
    const saved = await opts.store.getCheckpoint();
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
    if (from > to) return finish(opts, [], from, to, 0, 0, 0, null, saved);

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
    let bloomRecovered = 0;
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
        const prevA = n === from ? (saved ? saved.hash : null) : headersA.get(n - 1)!.hash;
        const prevB = n === from ? (saved ? saved.hash : null) : headersB.get(n - 1)!.hash;
        if (prevA !== null && ha.parentHash.toLowerCase() !== prevA.toLowerCase()) {
            return bad(from, to, `parentHash breaks at block ${n} on ${pa.name}`);
        }
        if (prevB !== null && hb.parentHash.toLowerCase() !== prevB.toLowerCase()) {
            return bad(from, to, `parentHash breaks at block ${n} on ${pb.name}`);
        }
        for (const bucket of buckets) {
            if (n < bucket.lo || n > bucket.hi) continue;
            const have = bucket.logs.filter((log) => log.blockNumber === n);
            const mayA = mayContainAddress(ha.logsBloom, bucket.address);
            const mayB = mayContainAddress(hb.logsBloom, bucket.address);
            if (mayA !== true && mayB !== true) {
                if (have.length) return bad(from, to, `bloom contradicts logs at block ${n}`);
                continue;
            }
            const got = await reread(pa, pb, bucket, n, ha.hash);
            if ('error' in got) return bad(from, to, got.error);
            const rec = reconcile(have, got.logs);
            if ('error' in rec) return bad(from, to, `${rec.error} at block ${n}`);
            if (rec.merge.length) {
                bucket.logs.push(...rec.merge);
                bloomRecovered++;
            } else if (have.length === 0) bloomFalsePositives++;
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
    if (!tipHeader) return bad(from, to, `missing header for block ${to}`);
    if (to === finA.number && tipHeader.hash.toLowerCase() !== finA.hash.toLowerCase()) {
        return bad(from, to, `finalized hash disagrees with header at block ${to} on ${pa.name}`);
    }
    const tipB = headersB.get(to);
    if (to === finB.number && tipB && tipB.hash.toLowerCase() !== finB.hash.toLowerCase()) {
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
    if (againB.number === to && againB.hash.toLowerCase() !== tipHeader.hash.toLowerCase()) {
        return bad(from, to, `finalized hash moved at block ${to} on ${pb.name}`);
    }

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
                address: bucket.address, kind: decoded.value.kind, decoded: decoded.value, log: log.raw,
            });
        }
    }
    return finish(opts, actions, from, to, bloomRecovered, bloomFalsePositives, ignored, tipHeader.hash.toLowerCase() as Hex, saved);
}

async function finish(
    opts: ScanRangeOptions, actions: FoundAction[], from: number, to: number,
    bloomRecovered: number, bloomFalsePositives: number, ignored: number, tip: Hex | null,
    expected: Checkpoint | null,
): Promise<ScanResult> {
    actions.sort((x, y) => x.blockNumber - y.blockNumber || x.logIndex - y.logIndex);
    const resolvedPrior: FoundAction[] = [];
    const stale: UnresolvedAction[] = [];
    let stillPrior = 0;
    for (const item of await opts.store.listUnresolved()) {
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
    // Attributed rows, then unresolved, then the cursor, then delete. A throw before the delete keeps the prior.
    const pending = [...stale, ...fresh];
    if (accepted.length) await opts.store.putAttributed(accepted);
    if (pending.length) await opts.store.putUnresolved(pending);
    if (tip) await opts.store.setCheckpoint({ block: to, hash: tip }, expected);
    for (const action of resolvedPrior) await opts.store.resolveUnresolved(unresolvedId(action.blockHash, action.logIndex));
    const stats: ScanStats = {
        bloomRecovered, bloomFalsePositives, ignored, count: actions.length, from, to, actions, resolvedPrior,
    };
    return stillPrior + fresh.length > 0
        ? { state: 'UNATTRIBUTED', unattributed: stillPrior + fresh.length, ...stats }
        : { state: 'COMPLETE', ...stats };
}
