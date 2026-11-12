import { getAddress, isAddress, numberToHex, type Address, type Hex } from 'viem';
import { mayContainAddress } from './bloom.js';
import { header, isHexData, isWord, pagedLogs, quantity, rawGetLogs, type BlockHeader, type RawLog, type RawRpc } from './rpc.js';
import { unresolvedId, type GuardianAuditStore, type UnresolvedAction } from './store.js';

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

/** Re-decode a stored row through the generation that owns its block. `null` = keep it unresolved. */
function revive(watched: readonly WatchedContract[], item: UnresolvedAction): FoundAction | null {
    const address = getAddress(item.address);
    const contract = watched.find((c) => covers(c, address, item.blockNumber));
    if (!contract) return null;
    const decoded = callDecode(contract, item.log, address, item.blockNumber);
    if (decoded === null || decoded === 'ignore') return null;
    return {
        blockNumber: item.blockNumber, blockHash: item.blockHash, txHash: item.txHash, logIndex: item.logIndex,
        address, kind: decoded.kind, decoded, log: item.log,
    };
}

function callDecode(contract: WatchedContract, log: RawLog, address: Address, block: number): DecodedAction | 'ignore' | null {
    try {
        return contract.decode(log);
    } catch {
        throw new Error(`decoder for ${address} threw at block ${block}`);
    }
}

function assertConfig(opts: ScanRangeOptions): void {
    if (!Number.isInteger(opts.startBlock) || opts.startBlock < 0) throw new Error('startBlock must be >= 0');
    if (!(opts.maxBlocks >= 1)) throw new Error('maxBlocks must be >= 1');
    const spans: { address: Address; from: number; to: number }[] = [];
    for (const contract of opts.watched) {
        const address = getAddress(contract.address);
        if (!Number.isInteger(contract.fromBlock) || contract.fromBlock < 0) throw new Error(`invalid fromBlock for ${address}`);
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

async function loadHeaders(rpc: RawRpc, from: number, to: number): Promise<Map<number, BlockHeader>> {
    const out = new Map<number, BlockHeader>();
    for (let start = from; start <= to; start += 100) {
        const end = Math.min(to, start + 99);
        const nums = Array.from({ length: end - start + 1 }, (_, i) => start + i);
        for (const h of await Promise.all(nums.map((n) => header(rpc, n)))) out.set(h.number, h);
    }
    return out;
}

async function reread(pa: RawRpc, pb: RawRpc, bucket: Bucket, block: number, hash: Hex): Promise<{ logs: Norm[] } | { error: string }> {
    try {
        const [rawA, rawB] = await Promise.all([
            rawGetLogs(pa, { address: bucket.address, blockHash: hash }),
            rawGetLogs(pb, { address: bucket.address, blockHash: hash }),
        ]);
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
    } catch {
        return { error: `by-hash log read failed for ${bucket.address} at block ${block}` };
    }
}

/**
 * Scan `(checkpoint, min(finalized A, finalized B)]`, at most `maxBlocks`.
 * COMPLETE / UNATTRIBUTED move the checkpoint. INCOMPLETE writes nothing.
 */
export async function scanRange(opts: ScanRangeOptions): Promise<ScanResult> {
    const [pa, pb] = opts.providers;
    if (opts.providers.length !== 2 || pa === pb || pa.name === pb.name) {
        throw new Error('guardian audit requires two distinct providers');
    }
    assertConfig(opts);
    const [finA, finB] = await Promise.all([header(pa, 'finalized'), header(pb, 'finalized')]);
    const saved = await opts.store.getCheckpoint();
    if (saved) {
        const [ha, hb] = await Promise.all([header(pa, saved.block), header(pb, saved.block)]);
        const want = saved.hash.toLowerCase();
        if (ha.hash.toLowerCase() !== want || hb.hash.toLowerCase() !== want) {
            throw new FinalityConflictError(`checkpoint block ${saved.block} hash conflict on ${pa.name}/${pb.name}`);
        }
    }
    const from = saved ? saved.block + 1 : opts.startBlock;
    const to = Math.min(finA.number, finB.number, from + opts.maxBlocks - 1);
    if (from > to) return finish(opts, [], from, to, 0, 0, 0, null);

    const buckets: Bucket[] = [];
    for (const contract of opts.watched) {
        const address = getAddress(contract.address);
        const lo = Math.max(from, contract.fromBlock);
        const hi = Math.min(to, contract.toBlock ?? to);
        if (lo <= hi) buckets.push({ contract, address, lo, hi, logs: [] });
    }
    const page = opts.page ?? 2000;
    for (const bucket of buckets) {
        const [rawA, rawB] = await Promise.all([
            pagedLogs(pa, bucket.address, bucket.lo, bucket.hi, page),
            pagedLogs(pb, bucket.address, bucket.lo, bucket.hi, page),
        ]);
        const a = parseAll(rawA, bucket.address, bucket.lo, bucket.hi);
        const b = parseAll(rawB, bucket.address, bucket.lo, bucket.hi);
        if ('error' in a) return bad(from, to, a.error);
        if ('error' in b) return bad(from, to, b.error);
        if (!sameLogs(a.logs, b.logs)) return bad(from, to, `providers disagree on logs of ${bucket.address}`);
        bucket.logs = a.logs;
    }

    // Headers of one provider at a time, ≤100 in flight.
    const headersA = await loadHeaders(pa, from, to);
    const headersB = await loadHeaders(pb, from, to);
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
        for (const bucket of buckets) {
            if (n < bucket.lo || n > bucket.hi || bucket.logs.some((log) => log.blockNumber === n)) continue;
            const mayA = mayContainAddress(ha.logsBloom, bucket.address);
            const mayB = mayContainAddress(hb.logsBloom, bucket.address);
            if (mayA !== true && mayB !== true) continue;
            const got = await reread(pa, pb, bucket, n, ha.hash);
            if ('error' in got) return bad(from, to, got.error);
            if (got.logs.length === 0) { bloomFalsePositives++; continue; }
            for (const log of got.logs) bucket.logs.push(log);
            bloomRecovered++;
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

    const actions: FoundAction[] = [];
    let ignored = 0;
    for (const bucket of buckets) {
        for (const log of bucket.logs) {
            const decoded = callDecode(bucket.contract, log.raw, bucket.address, log.blockNumber);
            if (decoded === null) {
                return bad(from, to, `undecodable topic0 ${log.topics[0] ?? '0x'} from ${bucket.address} at block ${log.blockNumber}`);
            }
            if (decoded === 'ignore') { ignored++; continue; }
            actions.push({
                blockNumber: log.blockNumber, blockHash: log.blockHash, txHash: log.txHash, logIndex: log.logIndex,
                address: bucket.address, kind: decoded.kind, decoded, log: log.raw,
            });
        }
    }
    const tip = headersA.get(to);
    if (!tip) return bad(from, to, `missing header for block ${to}`);
    return finish(opts, actions, from, to, bloomRecovered, bloomFalsePositives, ignored, tip.hash.toLowerCase() as Hex);
}

async function finish(
    opts: ScanRangeOptions, actions: FoundAction[], from: number, to: number,
    bloomRecovered: number, bloomFalsePositives: number, ignored: number, tip: Hex | null,
): Promise<ScanResult> {
    actions.sort((x, y) => x.blockNumber - y.blockNumber || x.logIndex - y.logIndex);
    const resolvedPrior: FoundAction[] = [];
    const stale: UnresolvedAction[] = [];
    let stillPrior = 0;
    for (const item of await opts.store.listUnresolved()) {
        const again = revive(opts.watched, item);
        if (!again) {
            stillPrior++;
            stale.push({ ...item, reason: 'stored action no longer decodable' });
            continue;
        }
        const outcome = await judge(opts.attributor, again);
        if (!outcome.ok) { stillPrior++; continue; }
        again.attribution = outcome.attribution;
        resolvedPrior.push(again);
        await opts.store.resolveUnresolved(item.id);
    }
    resolvedPrior.sort((x, y) => x.blockNumber - y.blockNumber || x.logIndex - y.logIndex);
    const fresh: UnresolvedAction[] = [];
    for (const action of actions) {
        const outcome = await judge(opts.attributor, action);
        if (outcome.ok) { action.attribution = outcome.attribution; continue; }
        fresh.push({
            id: unresolvedId(action.blockHash, action.logIndex),
            blockNumber: action.blockNumber, blockHash: action.blockHash, txHash: action.txHash,
            logIndex: action.logIndex, address: action.address, kind: action.kind, reason: outcome.reason, log: action.log,
        });
    }
    // Unresolved rows land before the checkpoint. A throw here leaves the cursor where it was.
    if (stale.length) await opts.store.putUnresolved(stale);
    if (fresh.length) await opts.store.putUnresolved(fresh);
    if (tip) await opts.store.setCheckpoint({ block: to, hash: tip });
    const stats: ScanStats = {
        bloomRecovered, bloomFalsePositives, ignored, count: actions.length, from, to, actions, resolvedPrior,
    };
    return stillPrior + fresh.length > 0
        ? { state: 'UNATTRIBUTED', unattributed: stillPrior + fresh.length, ...stats }
        : { state: 'COMPLETE', ...stats };
}
