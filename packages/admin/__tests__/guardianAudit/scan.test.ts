import { describe, expect, it } from 'vitest';
import { getAddress, keccak256, numberToHex, stringToHex, type Address, type Hex } from 'viem';
import { bloomOf } from '../../src/guardianAudit/bloom';
import { EMPTY_RECEIPTS_ROOT, receiptsRootFromRpc } from '../../src/guardianAudit/trie';
import {
    CheckpointConflictError,
    FinalityConflictError,
    memoryStore,
    scanRange,
    unresolvedId,
    type Attributor,
    type Checkpoint,
    type Commit,
    type FoundAction,
    type GuardianAuditStore,
    type RawLog,
    type RawRpc,
    type ScanResult,
    type UnresolvedAction,
    type WatchedContract,
} from '../../src/guardianAudit';

const ADDR = '0x1111111111111111111111111111111111111111' as Address;
const OTHER = '0x2222222222222222222222222222222222222222' as Address;
const TOPIC = `0x${'ab'.repeat(32)}` as Hex;
const IGNORE = `0x${'cd'.repeat(32)}` as Hex;
const UNKNOWN = `0x${'ef'.repeat(32)}` as Hex;

function bhash(n: number, salt = ''): Hex {
    return keccak256(stringToHex(`blk${salt}:${n}`));
}

function tx(n: number, index: number): Hex {
    return keccak256(stringToHex(`tx:${n}:${index}`));
}

function makeLog(n: number, hash: Hex, index: number, topic: Hex, patch?: Partial<RawLog>): RawLog {
    return {
        address: ADDR,
        topics: [topic],
        data: '0x',
        blockNumber: numberToHex(n),
        blockHash: hash,
        transactionHash: tx(n, index),
        logIndex: numberToHex(index),
        removed: false,
        ...patch,
    };
}

interface Block {
    hash: Hex;
    parent: Hex;
    logs: RawLog[];
    bloom: Hex | null;
    hide: Set<number>;
    receipts: unknown[];
    receiptsRoot: Hex;
}

class Fake implements RawRpc {
    calls: { method: string; params: unknown[] }[] = [];
    blocks = new Map<number, Block>();
    includeMismatch = false;
    garbage = false;
    leak: RawLog | null = null;
    failFinalized = false;
    failHeader = false;
    failRange = false;
    failReceipts = false;
    /** Replaces eth_getBlockReceipts for every known hash. The header root stays put. */
    receiptsOverride: unknown[] | null = null;
    finalizedHash: Hex | null = null;
    finalizedRereadHash: Hex | null = null;
    rewindFinalized = false;
    finalizedReads = 0;
    gate: Promise<void> | null = null;
    constructor(public name: string, public finalized: number) {}

    parentOf(n: number): Hex {
        return this.blocks.get(n)?.parent ?? bhash(0);
    }

    fill(upTo: number, hashOf: (n: number) => Hex = bhash): void {
        for (let n = 1; n <= upTo; n++) {
            if (this.blocks.has(n)) continue;
            this.blocks.set(n, {
                hash: hashOf(n),
                parent: n > 1 ? hashOf(n - 1) : bhash(0),
                logs: [],
                bloom: bloomOf([]),
                hide: new Set(),
                receipts: [],
                receiptsRoot: EMPTY_RECEIPTS_ROOT,
            });
        }
    }

    private rebuild(block: Block): void {
        block.bloom = bloomOf(block.logs.map((item) => ({ address: item.address, topics: item.topics })));
        if (block.logs.length === 0) {
            block.receipts = [];
            block.receiptsRoot = EMPTY_RECEIPTS_ROOT;
            return;
        }
        block.receipts = [{
            type: '0x2',
            status: '0x1',
            cumulativeGasUsed: '0x1',
            logsBloom: `0x${'00'.repeat(256)}`,
            transactionIndex: '0x0',
            logs: block.logs.map((log) => ({
                address: log.address,
                topics: log.topics,
                data: log.data,
                logIndex: log.logIndex,
                blockNumber: log.blockNumber,
                blockHash: log.blockHash,
                transactionHash: log.transactionHash,
                removed: log.removed ?? false,
            })),
        }];
        block.receiptsRoot = receiptsRootFromRpc(block.receipts) ?? EMPTY_RECEIPTS_ROOT;
    }

    addLog(n: number, log: RawLog, hide = false): void {
        const block = this.blocks.get(n);
        if (!block) throw new Error(`missing block ${n}`);
        block.logs.push(log);
        if (hide) block.hide.add(Number.parseInt(log.logIndex, 16));
        this.rebuild(block);
    }

    setBloom(n: number, bloom: Hex | null): void {
        const block = this.blocks.get(n);
        if (!block) throw new Error(`missing block ${n}`);
        block.bloom = bloom;
    }

    setHash(n: number, hash: Hex): void {
        const block = this.blocks.get(n);
        if (!block) throw new Error(`missing block ${n}`);
        block.hash = hash;
    }

    setReceiptsRoot(n: number, root: Hex): void {
        const block = this.blocks.get(n);
        if (!block) throw new Error(`missing block ${n}`);
        block.receiptsRoot = root;
    }

    /** Range logs stay. Receipts become empty and the header root follows them. */
    dropReceipts(n: number): void {
        const block = this.blocks.get(n);
        if (!block) throw new Error(`missing block ${n}`);
        block.receipts = [];
        block.receiptsRoot = EMPTY_RECEIPTS_ROOT;
    }

    async request(args: { method: string; params?: unknown[] }): Promise<unknown> {
        const params = args.params ?? [];
        this.calls.push({ method: args.method, params });
        if (this.gate && args.method === 'eth_getLogs') await this.gate;
        if (args.method === 'eth_getBlockByNumber') {
            const tag = params[0];
            const finalized = tag === 'finalized';
            if (finalized && this.failFinalized) throw new Error('https://rpc.example/finalized');
            if (!finalized && this.failHeader) throw new Error('https://rpc.example/header');
            let n = finalized ? this.finalized : Number.parseInt(String(tag), 16);
            if (finalized) {
                this.finalizedReads++;
                if (this.rewindFinalized && this.finalizedReads > 1) n = 1;
            }
            const block = this.blocks.get(n);
            if (!block) return null;
            let hash = block.hash;
            if (finalized && this.finalizedReads === 1 && this.finalizedHash) hash = this.finalizedHash;
            if (finalized && this.finalizedReads > 1 && this.finalizedRereadHash) hash = this.finalizedRereadHash;
            return {
                number: numberToHex(n),
                hash,
                parentHash: this.parentOf(n),
                receiptsRoot: block.receiptsRoot,
                logsBloom: block.bloom,
            };
        }
        if (args.method === 'eth_getBlockReceipts') {
            if (this.failReceipts) throw new Error('https://rpc.example/receipts');
            const want = String(params[0]).toLowerCase();
            for (const block of this.blocks.values()) {
                if (block.hash.toLowerCase() === want) return this.receiptsOverride ?? block.receipts;
            }
            throw new Error('unknown block hash');
        }
        if (args.method === 'eth_getLogs') {
            const filter = params[0] as Record<string, unknown>;
            if ('topics' in filter) throw new Error('topics filter is not allowed');
            if (typeof filter.blockHash !== 'string' && this.failRange) throw new Error('https://rpc.example/logs');
            if (this.garbage) return [null];
            const from = Number.parseInt(String(filter.fromBlock), 16);
            const to = Number.parseInt(String(filter.toBlock), 16);
            const out: RawLog[] = [];
            for (let n = from; n <= to; n++) {
                const block = this.blocks.get(n);
                if (!block) continue;
                for (const log of block.logs) {
                    if (block.hide.has(Number.parseInt(log.logIndex, 16))) continue;
                    const same = log.address.toLowerCase() === String(filter.address).toLowerCase();
                    if (!same && !this.includeMismatch) continue;
                    out.push(log);
                }
            }
            if (this.leak) {
                const leakAt = Number.parseInt(this.leak.blockNumber, 16);
                if (leakAt < from || leakAt > to) out.push(this.leak);
            }
            return out;
        }
        throw new Error(`unexpected ${args.method}`);
    }
}

function pair(finA = 5, finB = finA): { a: Fake; b: Fake } {
    const upTo = Math.max(finA, finB);
    const a = new Fake('primary', finA);
    const b = new Fake('secondary', finB);
    a.fill(upTo);
    b.fill(upTo);
    return { a, b };
}

function addBoth(a: Fake, b: Fake, n: number, topic: Hex, index = 0, hide = false, patch?: Partial<RawLog>): void {
    const log = makeLog(n, a.blocks.get(n)!.hash, index, topic, patch);
    a.addLog(n, log, hide);
    b.addLog(n, { ...log, topics: [...log.topics] }, hide);
}

function watched(over: Partial<WatchedContract> = {}): WatchedContract {
    return {
        address: ADDR,
        fromBlock: 1,
        decode(log) {
            const topic = log.topics[0]?.toLowerCase();
            if (topic === TOPIC) return { kind: 'guardian-added' };
            if (topic === IGNORE) return 'ignore';
            return null;
        },
        ...over,
    };
}

function run(a: RawRpc, b: RawRpc, store: GuardianAuditStore = memoryStore(), over: Record<string, unknown> = {}) {
    return scanRange({
        providers: [a, b],
        watched: [watched()],
        store,
        startBlock: 1,
        maxBlocks: 50,
        ...over,
    });
}

function trace(inner: GuardianAuditStore = memoryStore()) {
    const events: string[] = [];
    const store: GuardianAuditStore = {
        getCheckpoint: () => inner.getCheckpoint(),
        listUnresolved: () => inner.listUnresolved(),
        listAttributed: () => inner.listAttributed(),
        commit: async (change) => { events.push('commit'); await inner.commit(change); },
    };
    return { store, events, inner };
}

async function save(
    store: GuardianAuditStore,
    next: Checkpoint | null,
    unresolved: UnresolvedAction[] = [],
    extra: Partial<Commit> = {},
): Promise<void> {
    await store.commit({
        expected: await store.getCheckpoint(),
        next,
        attributed: extra.attributed ?? [],
        unresolved,
        resolve: extra.resolve ?? [],
    });
}

function expectIncomplete(result: ScanResult, pattern: RegExp): void {
    expect(result.state).toBe('INCOMPLETE');
    if (result.state !== 'INCOMPLETE') return;
    expect(result.reasons[0]).toMatch(pattern);
    expect(result.reasons.join('\n')).not.toMatch(/:\/\//);
}

function logRanges(fake: Fake): { fromBlock: unknown; toBlock: unknown }[] {
    return fake.calls
        .filter((call) => call.method === 'eth_getLogs' && !('blockHash' in (call.params[0] as object)))
        .map((call) => call.params[0] as { fromBlock: unknown; toBlock: unknown });
}

function row(block: number, index: number): UnresolvedAction {
    const hash = bhash(block);
    return {
        id: unresolvedId(hash, index),
        blockNumber: block,
        blockHash: hash,
        txHash: tx(block, index),
        logIndex: index,
        address: ADDR,
        kind: 'guardian-added',
        reason: 'no attributor',
        log: makeLog(block, hash, index, TOPIC),
    };
}

async function prior(store: GuardianAuditStore, blockHash: Hex): Promise<void> {
    const item: UnresolvedAction = {
        id: unresolvedId(blockHash, 0),
        blockNumber: 1,
        blockHash,
        txHash: tx(1, 0),
        logIndex: 0,
        address: ADDR,
        kind: 'guardian-added',
        reason: 'no attributor',
        log: makeLog(1, blockHash, 0, TOPIC),
    };
    await save(store, null, [item]);
}

describe('guardian-audit completeness (unit, not acceptance)', () => {
    it('rejects the same provider object or the same name before any read', async () => {
        const { a } = pair();
        const store = memoryStore();
        await expect(run(a, a, store)).rejects.toThrow(/two distinct providers/);
        const twin = new Fake('primary', 5);
        twin.fill(5);
        await expect(run(a, twin, store)).rejects.toThrow(/two distinct providers/);
        expect(a.calls).toHaveLength(0);
        expect(twin.calls).toHaveLength(0);
    });

    it('returns COMPLETE(0) with no log reads when the cursor is already at finalized', async () => {
        const { a, b } = pair(5);
        const store = memoryStore();
        await save(store, { block: 5, hash: bhash(5) });
        const result = await run(a, b, store);
        expect(result).toMatchObject({ state: 'COMPLETE', count: 0, actions: [], from: 6, to: 5 });
        expect(a.calls.every((call) => call.method === 'eth_getBlockByNumber')).toBe(true);
        expect(a.calls).toHaveLength(2);
        expect(await store.getCheckpoint()).toEqual({ block: 5, hash: bhash(5) });
    });

    it('does not read logs when startBlock is past both finalized heads', async () => {
        const { a, b } = pair(4);
        const store = memoryStore();
        const result = await run(a, b, store, { startBlock: 20 });
        expect(result).toMatchObject({ state: 'COMPLETE', count: 0, from: 20, to: 4 });
        expect(a.calls.map((call) => call.method)).toEqual(['eth_getBlockByNumber']);
        expect(await store.getCheckpoint()).toBeNull();
    });

    it('clips to maxBlocks and to the lower finalized head', async () => {
        const clipped = pair(50, 40);
        const store = memoryStore();
        const first = await run(clipped.a, clipped.b, store, { maxBlocks: 4 });
        expect(first).toMatchObject({ state: 'COMPLETE', from: 1, to: 4, count: 0 });
        expect(await store.getCheckpoint()).toEqual({ block: 4, hash: bhash(4) });
        expect(logRanges(clipped.a)).toEqual([expect.objectContaining({ fromBlock: '0x1', toBlock: '0x4' })]);
        const tags = (node: Fake) => node.calls
            .filter((call) => call.method === 'eth_getBlockByNumber')
            .map((call) => call.params[0]);
        expect(tags(clipped.a)).toEqual(expect.arrayContaining(['0x5', numberToHex(50)]));
        expect(tags(clipped.b)).toEqual(expect.arrayContaining(['0x5', numberToHex(40)]));
        expect(tags(clipped.b)).not.toContain(numberToHex(41));

        const lower = pair(50, 6);
        const second = await run(lower.a, lower.b, memoryStore(), { maxBlocks: 100 });
        expect(second).toMatchObject({ state: 'COMPLETE', to: 6 });
        expect(tags(lower.a)).toContain('0x7');
        expect(tags(lower.b)).not.toContain('0x7');
    });

    it('resumes at checkpoint + 1 and clips a generation window', async () => {
        const { a, b } = pair(8);
        const store = memoryStore();
        await run(a, b, store, { maxBlocks: 2 });
        a.calls.length = 0;
        const contract = watched({ fromBlock: 4, toBlock: 5 });
        const result = await scanRange({
            providers: [a, b], watched: [contract], store, startBlock: 1, maxBlocks: 10,
        });
        expect(result).toMatchObject({ state: 'COMPLETE', from: 3, to: 8 });
        expect(logRanges(a)).toEqual([expect.objectContaining({ fromBlock: '0x4', toBlock: '0x5' })]);
    });

    it('halts with FinalityConflictError when either provider disagrees with the checkpoint hash', async () => {
        for (const side of ['a', 'b'] as const) {
            const { a, b } = pair(5);
            const store = memoryStore();
            const saved: Checkpoint = { block: 2, hash: bhash(2) };
            await save(store, saved);
            (side === 'a' ? a : b).setHash(2, bhash(2, 'reorg'));
            await expect(run(a, b, store)).rejects.toBeInstanceOf(FinalityConflictError);
            expect(await store.getCheckpoint()).toEqual(saved);
            expect(await store.listUnresolved()).toEqual([]);
            expect(a.calls.some((call) => call.method === 'eth_getLogs')).toBe(false);
        }
    });

    it('is INCOMPLETE when the providers disagree on logs, and writes nothing', async () => {
        const { a, b } = pair();
        addBoth(a, b, 2, TOPIC);
        b.blocks.get(2)!.logs = [];
        b.setBloom(2, bloomOf([]));
        const { store, events, inner } = trace();
        const result = await run(a, b, store);
        expectIncomplete(result, new RegExp(`providers disagree on logs of ${getAddress(ADDR)}`));
        expect(events).toEqual([]);
        expect(await inner.getCheckpoint()).toBeNull();
    });

    it('is INCOMPLETE when block hashes disagree', async () => {
        const { a, b } = pair();
        b.setHash(1, bhash(1, 'other'));
        expectIncomplete(await run(a, b), /providers disagree on block hash at 1/);
    });

    it('is INCOMPLETE when a header bloom is unreadable', async () => {
        const { a, b } = pair();
        a.setBloom(2, null);
        b.setBloom(2, null);
        expectIncomplete(await run(a, b), /unreadable logsBloom at block 2/);
    });

    it('is INCOMPLETE for a removed log, a foreign address, an out-of-window log, a bad blockHash, or a malformed entry', async () => {
        const removed = pair();
        addBoth(removed.a, removed.b, 2, TOPIC, 0, false, { removed: true });
        expectIncomplete(await run(removed.a, removed.b), /removed log from/);

        const foreign = pair();
        foreign.a.includeMismatch = true;
        foreign.b.includeMismatch = true;
        addBoth(foreign.a, foreign.b, 2, TOPIC, 0, false, { address: OTHER });
        expectIncomplete(await run(foreign.a, foreign.b), /not the queried address/);

        const leaked = pair(10);
        const leak = makeLog(8, bhash(8), 0, TOPIC);
        leaked.a.leak = leak;
        leaked.b.leak = leak;
        const leakResult = await run(leaked.a, leaked.b, memoryStore(), {
            watched: [watched({ toBlock: 4 })],
        });
        expectIncomplete(leakResult, /outside queried range at block 8/);

        const mismatched = pair();
        addBoth(mismatched.a, mismatched.b, 2, TOPIC, 0, false, { blockHash: bhash(50) });
        expectIncomplete(await run(mismatched.a, mismatched.b), /blockHash disagrees with/);

        const broken = pair();
        broken.a.garbage = true;
        broken.b.garbage = true;
        expectIncomplete(await run(broken.a, broken.b), /malformed log/);
    });

    it('is INCOMPLETE when a watched contract emits a guardian topic the decoder does not know', async () => {
        const { a, b } = pair();
        addBoth(a, b, 2, UNKNOWN);
        const store = memoryStore();
        const result = await run(a, b, store);
        expect(result.state).not.toBe('COMPLETE');
        expectIncomplete(result, new RegExp(`undecodable topic0 ${UNKNOWN} from ${getAddress(ADDR)} at block 2`));
        expect(await store.getCheckpoint()).toBeNull();
        expect(await store.listUnresolved()).toEqual([]);
    });

    it('is INCOMPLETE when both providers omit a range log that the receipts include', async () => {
        const { a, b } = pair(3);
        addBoth(a, b, 2, TOPIC, 0, true);
        const store = memoryStore();
        const result = await run(a, b, store, { attributor: ok });
        expectIncomplete(result, /range logs omit a log present in the verified receipts at block 2/);
        expect(await store.getCheckpoint()).toBeNull();
        expect(await store.listUnresolved()).toEqual([]);
    });

    it('counts a bloom hit when the verified receipts have no log from that address', async () => {
        const { a, b } = pair(3);
        const fake = bloomOf([{ address: ADDR, topics: [TOPIC] }]);
        a.setBloom(2, fake);
        b.setBloom(2, fake);
        const result = await run(a, b, memoryStore(), { attributor: ok });
        expect(result).toMatchObject({ state: 'COMPLETE', count: 0, bloomFalsePositives: 1 });
    });

    it('is INCOMPLETE when receipts do not match receiptsRoot or cannot be read', async () => {
        const mismatch = pair(3);
        addBoth(mismatch.a, mismatch.b, 2, TOPIC);
        mismatch.a.receiptsOverride = [];
        mismatch.b.receiptsOverride = [];
        const store = memoryStore();
        expectIncomplete(await run(mismatch.a, mismatch.b, store), /receipts do not match receiptsRoot at block 2/);
        expect(await store.getCheckpoint()).toBeNull();

        const failing = pair(3);
        addBoth(failing.a, failing.b, 2, TOPIC);
        failing.a.failReceipts = true;
        const right = await run(failing.a, failing.b);
        expectIncomplete(right, /receipts read failed for primary/);
        expect(right.state === 'INCOMPLETE' && right.reasons.join('\n')).not.toMatch(/rpc\.example/);

        const broken = pair(3);
        addBoth(broken.a, broken.b, 2, TOPIC);
        const badReceipt = [{
            type: '0x2', status: '0x2', cumulativeGasUsed: '0x1', transactionIndex: '0x0',
            logsBloom: `0x${'00'.repeat(256)}`, logs: [],
        }];
        broken.a.receiptsOverride = badReceipt;
        broken.b.receiptsOverride = badReceipt;
        expectIncomplete(await run(broken.a, broken.b), /cannot verify receipts at block 2/);
    });

    it('sorts actions and does not attribute an ignored event', async () => {
        const { a, b } = pair(4);
        addBoth(a, b, 1, TOPIC, 2);
        addBoth(a, b, 1, TOPIC, 1);
        addBoth(a, b, 3, IGNORE, 0);
        const seen: number[] = [];
        const attributor: Attributor = {
            async attribute(action) {
                seen.push(action.logIndex);
                return { ok: true, attribution: { who: 'guardian' } };
            },
        };
        const result = await run(a, b, memoryStore(), { attributor });
        expect(result).toMatchObject({ state: 'COMPLETE', count: 2, ignored: 1 });
        if (result.state !== 'COMPLETE') return;
        expect(result.actions.map((action) => [action.blockNumber, action.logIndex])).toEqual([[1, 1], [1, 2]]);
        expect(seen).toEqual([1, 2]);
        for (const call of [...a.calls, ...b.calls]) {
            if (call.method === 'eth_getLogs') expect(call.params[0]).not.toHaveProperty('topics');
            if (call.method === 'eth_getBlockByNumber') expect(call.params[1]).toBe(false);
        }
    });

    it('persists unresolved actions before the checkpoint when no attributor is configured', async () => {
        const { a, b } = pair(3);
        addBoth(a, b, 2, TOPIC, 4);
        const { store, events, inner } = trace();
        const result = await run(a, b, store);
        expect(result).toMatchObject({ state: 'UNATTRIBUTED', count: 1, unattributed: 1 });
        expect(events).toEqual(['commit']);
        const rows = await inner.listUnresolved();
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            id: unresolvedId(bhash(2), 4),
            reason: 'no attributor',
            blockNumber: 2,
            logIndex: 4,
        });
        expect(await inner.getCheckpoint()).toEqual({ block: 3, hash: bhash(3) });
    });

    it('does not move the checkpoint when commit throws', async () => {
        const { a, b } = pair(3);
        addBoth(a, b, 2, TOPIC);
        const inner = memoryStore();
        const events: string[] = [];
        const store: GuardianAuditStore = {
            getCheckpoint: () => inner.getCheckpoint(),
            listUnresolved: () => inner.listUnresolved(),
            listAttributed: () => inner.listAttributed(),
            commit: async () => { events.push('commit'); throw new Error('disk'); },
        };
        await expect(run(a, b, store)).rejects.toThrow(/disk/);
        expect(events).toEqual(['commit']);
        expect(await inner.getCheckpoint()).toBeNull();
        expect(await inner.listUnresolved()).toEqual([]);
    });

    it('stores an attributor miss or throw, and strips a URL out of the reason', async () => {
        const miss = pair(3);
        addBoth(miss.a, miss.b, 2, TOPIC);
        const missed = await run(miss.a, miss.b, memoryStore(), {
            attributor: { async attribute() { return { ok: false as const, reason: 'no trace' }; } },
        });
        expect(missed).toMatchObject({ state: 'UNATTRIBUTED', unattributed: 1 });

        const blown = pair(3);
        addBoth(blown.a, blown.b, 2, TOPIC);
        const store = memoryStore();
        const result = await run(blown.a, blown.b, store, {
            attributor: { async attribute() { throw new Error('https://evil.example/trace'); } },
        });
        expect(result).toMatchObject({ state: 'UNATTRIBUTED', unattributed: 1 });
        expect((await store.listUnresolved())[0]?.reason).toBe('attributor failed');
        expect(JSON.stringify(await store.listUnresolved())).not.toMatch(/:\/\//);
    });

    it('retries stored unresolved actions first and resolves them after the checkpoint', async () => {
        const { a, b } = pair(6);
        addBoth(a, b, 4, TOPIC, 0);
        const { store, events, inner } = trace();
        await prior(inner, bhash(1));
        const seen: number[] = [];
        const attributor: Attributor = {
            async attribute(action: FoundAction) {
                seen.push(action.blockNumber);
                if (action.blockNumber === 1) return { ok: true, attribution: { who: 'old' } };
                return { ok: false, reason: 'later' };
            },
        };
        const result = await run(a, b, store, { attributor });
        expect(seen[0]).toBe(1);
        expect(events).toEqual(['commit']);
        expect(result).toMatchObject({ state: 'UNATTRIBUTED', count: 1, unattributed: 1 });
        const rows = await inner.listUnresolved();
        expect(rows.map((row) => row.blockNumber)).toEqual([4]);
    });

    it('stays UNATTRIBUTED when a stored action is still unresolved, including a caught-up cursor', async () => {
        const open = pair(4);
        const store = memoryStore();
        await prior(store, bhash(1));
        const scanned = await run(open.a, open.b, store, {
            attributor: { async attribute() { return { ok: false as const, reason: 'no trace' }; } },
        });
        expect(scanned).toMatchObject({ state: 'UNATTRIBUTED', count: 0, unattributed: 1 });
        expect(await store.getCheckpoint()).toEqual({ block: 4, hash: bhash(4) });
        expect(await store.listUnresolved()).toHaveLength(1);

        const done = pair(4);
        const caught = memoryStore();
        await save(caught, { block: 4, hash: bhash(4) });
        await prior(caught, bhash(1));
        const result = await run(done.a, done.b, caught);
        expect(result).toMatchObject({ state: 'UNATTRIBUTED', count: 0, unattributed: 1 });
        expect(done.a.calls.every((call) => call.method === 'eth_getBlockByNumber')).toBe(true);
        expect(await caught.getCheckpoint()).toEqual({ block: 4, hash: bhash(4) });
    });

    it('re-decodes a stored action so the retry sees the same decoded fields', async () => {
        const rich = watched({
            decode(log) {
                return log.topics[0]?.toLowerCase() === TOPIC ? { kind: 'guardian-added', signer: 'alice' } : null;
            },
        });
        const { a, b } = pair(3);
        addBoth(a, b, 2, TOPIC);
        const store = memoryStore();
        const seen: FoundAction['decoded'][] = [];
        const attributor: Attributor = {
            async attribute(action) {
                seen.push(action.decoded);
                return seen.length === 1
                    ? { ok: false, reason: 'later' }
                    : { ok: true, attribution: { who: 'retry' } };
            },
        };
        const first = await run(a, b, store, { watched: [rich], attributor });
        expect(first).toMatchObject({ state: 'UNATTRIBUTED', count: 1 });
        if (first.state === 'INCOMPLETE') return;
        expect(first.actions[0]?.attribution).toBeUndefined();
        expect(first.actions[0]?.decoded).toEqual({ kind: 'guardian-added', signer: 'alice' });

        const second = await run(a, b, store, { watched: [rich], attributor });
        expect(second).toMatchObject({ state: 'COMPLETE', count: 0 });
        if (second.state === 'INCOMPLETE') return;
        expect(second.resolvedPrior).toHaveLength(1);
        expect(second.resolvedPrior[0]?.decoded).toEqual(seen[0]);
        expect(second.resolvedPrior[0]?.attribution).toEqual({ who: 'retry' });
        expect(await store.listUnresolved()).toEqual([]);
    });

    it('puts attribution on a newly accepted action', async () => {
        const { a, b } = pair(3);
        addBoth(a, b, 2, TOPIC, 1);
        const result = await run(a, b, memoryStore(), {
            attributor: { async attribute() { return { ok: true, attribution: { who: 'alice' } }; } },
        });
        expect(result).toMatchObject({
            state: 'COMPLETE',
            actions: [expect.objectContaining({ attribution: { who: 'alice' }, logIndex: 1 })],
            resolvedPrior: [],
        });
    });

    it('returns resolved priors sorted, with attribution', async () => {
        const { a, b } = pair(3);
        const store = memoryStore();
        await save(store, null, [row(2, 0), row(1, 3)]);
        const result = await run(a, b, store, {
            attributor: { async attribute() { return { ok: true, attribution: { who: 'prior' } }; } },
        });
        expect(result.state).not.toBe('INCOMPLETE');
        if (result.state === 'INCOMPLETE') return;
        expect(result.resolvedPrior.map((action) => [action.blockNumber, action.logIndex, action.attribution]))
            .toEqual([[1, 3, { who: 'prior' }], [2, 0, { who: 'prior' }]]);
    });

    it('keeps a stored action unresolved when it no longer decodes', async () => {
        const { a, b } = pair(4);
        const { store, events, inner } = trace();
        await prior(inner, bhash(1));
        const result = await run(a, b, store, { watched: [watched({ fromBlock: 3 })] });
        expect(result).toMatchObject({ state: 'UNATTRIBUTED', unattributed: 1 });
        expect(events).not.toContain('resolve');
        expect((await inner.listUnresolved())[0]?.reason).toBe('stored action no longer decodable');
        expect(await inner.listUnresolved()).toHaveLength(1);
    });

    it('is INCOMPLETE when the providers disagree on logsBloom, ignoring hex case', async () => {
        const bits = `0x${'ab'.repeat(256)}` as Hex;
        const other = `0x${'cd'.repeat(256)}` as Hex;
        const differ = pair(2);
        differ.a.setBloom(1, bits);
        differ.b.setBloom(1, other);
        expectIncomplete(await run(differ.a, differ.b), /providers disagree on logsBloom at block 1/);

        const cased = pair(2);
        cased.a.setBloom(1, bits);
        cased.b.setBloom(1, `0x${bits.slice(2).toUpperCase()}` as Hex);
        const result = await run(cased.a, cased.b, memoryStore(), { attributor: ok });
        expect(result).toMatchObject({ state: 'COMPLETE' });
    });

    it('is INCOMPLETE when the providers disagree on receiptsRoot', async () => {
        const { a, b } = pair(3);
        a.setReceiptsRoot(1, `0x${'ab'.repeat(32)}` as Hex);
        const store = memoryStore();
        expectIncomplete(await run(a, b, store), /providers disagree on receiptsRoot at block 1/);
        expect(await store.getCheckpoint()).toBeNull();
    });

    it('rejects overlapping windows and a bad range before any read', async () => {
        const { a, b } = pair();
        const providers = [a, b] as const;
        const store = memoryStore();
        await expect(scanRange({
            providers, store, startBlock: 1, maxBlocks: 5,
            watched: [watched({ fromBlock: 1, toBlock: 4 }), watched({ fromBlock: 4, toBlock: 6 })],
        })).rejects.toThrow(/overlapping generation windows/);
        await expect(scanRange({
            providers, store, startBlock: 1, maxBlocks: 5, watched: [watched({ fromBlock: 1.5 })],
        })).rejects.toThrow(/fromBlock/);
        await expect(scanRange({
            providers, store, startBlock: 1, maxBlocks: 5, watched: [watched({ fromBlock: -1 })],
        })).rejects.toThrow(/fromBlock/);
        await expect(scanRange({
            providers, store, startBlock: 1, maxBlocks: 5, watched: [watched({ fromBlock: 5, toBlock: 4 })],
        })).rejects.toThrow(/toBlock/);
        await expect(scanRange({
            providers, store, startBlock: 1, maxBlocks: 0, watched: [watched()],
        })).rejects.toThrow(/maxBlocks/);
        await expect(scanRange({
            providers, store, startBlock: -1, maxBlocks: 5, watched: [watched()],
        })).rejects.toThrow(/startBlock/);
        await expect(scanRange({
            providers, store, startBlock: Number.NaN, maxBlocks: 5, watched: [watched()],
        })).rejects.toThrow(/startBlock/);
        await expect(scanRange({
            providers, store, startBlock: 1.5, maxBlocks: 5, watched: [watched()],
        })).rejects.toThrow(/startBlock/);
        await expect(scanRange({
            providers, store, startBlock: 1, maxBlocks: Number.NaN, watched: [watched()],
        })).rejects.toThrow(/maxBlocks/);
        await expect(scanRange({
            providers, store, startBlock: 1, maxBlocks: 1.5, watched: [watched()],
        })).rejects.toThrow(/maxBlocks/);
        await expect(scanRange({
            providers, store, startBlock: 1, maxBlocks: 5, watched: [watched({ fromBlock: Number.NaN })],
        })).rejects.toThrow(/fromBlock/);
        await expect(scanRange({
            providers, store, startBlock: 1, maxBlocks: 5, watched: [watched({ toBlock: Number.NaN })],
        })).rejects.toThrow(/toBlock/);
        await expect(scanRange({
            providers, store, startBlock: 1, maxBlocks: 5, watched: [watched({ toBlock: 1.5 })],
        })).rejects.toThrow(/toBlock/);
        await expect(scanRange({
            providers, store, startBlock: 1, maxBlocks: 5, page: 0, watched: [watched()],
        })).rejects.toThrow(/page/);
        await expect(scanRange({
            providers, store, startBlock: 1, maxBlocks: 5, page: Number.NaN, watched: [watched()],
        })).rejects.toThrow(/page/);
        expect(a.calls).toHaveLength(0);
        expect(b.calls).toHaveLength(0);

        const adjacent = pair(8);
        addBoth(adjacent.a, adjacent.b, 6, TOPIC);
        const result = await scanRange({
            providers: [adjacent.a, adjacent.b], store: memoryStore(), startBlock: 1, maxBlocks: 20,
            watched: [watched({ fromBlock: 1, toBlock: 4 }), watched({ fromBlock: 5, toBlock: 8 })],
            attributor: ok,
        });
        expect(result).toMatchObject({ state: 'COMPLETE', count: 1 });
    });

    it('is INCOMPLETE when a decoder throws, and writes nothing', async () => {
        const { a, b } = pair(3);
        addBoth(a, b, 2, TOPIC);
        const { store, events, inner } = trace();
        const failing = watched({
            decode() { throw new Error('https://evil.example/decoder'); },
        });
        const result = await run(a, b, store, { watched: [failing] });
        expectIncomplete(result, new RegExp(`decoder threw for ${getAddress(ADDR)} at block 2`));
        expect(result.state === 'INCOMPLETE' && result.reasons.join('\n')).not.toMatch(/evil\.example/);
        expect(events).toEqual([]);
        expect(await inner.getCheckpoint()).toBeNull();
        expect(await inner.listUnresolved()).toEqual([]);
        expect(await inner.listAttributed()).toEqual([]);
    });

    it('is INCOMPLETE when a hidden guardian log sits beside an ignored log in the receipts', async () => {
        const { a, b } = pair(3);
        addBoth(a, b, 2, IGNORE, 0);
        addBoth(a, b, 2, TOPIC, 1, true);
        const store = memoryStore();
        expectIncomplete(await run(a, b, store, { attributor: ok }), /range logs omit a log present in the verified receipts at block 2/);
        expect(await store.getCheckpoint()).toBeNull();
    });

    it('is INCOMPLETE when a range log is missing from the verified receipts', async () => {
        const { a, b } = pair(3);
        addBoth(a, b, 2, TOPIC);
        a.dropReceipts(2);
        b.dropReceipts(2);
        const store = memoryStore();
        expectIncomplete(await run(a, b, store), /range logs disagree with verified receipts at block 2/);
        expect(await store.getCheckpoint()).toBeNull();
    });

    it('accepts range logs that the receipts verify when the bloom is empty', async () => {
        const { a, b } = pair(3);
        addBoth(a, b, 2, TOPIC);
        const empty = bloomOf([]);
        a.setBloom(2, empty);
        b.setBloom(2, empty);
        const store = memoryStore();
        const result = await run(a, b, store, { attributor: ok });
        expect(result).toMatchObject({ state: 'COMPLETE', count: 1, bloomFalsePositives: 0 });
        expect(await store.getCheckpoint()).toEqual({ block: 3, hash: bhash(3) });
    });

    it('is INCOMPLETE when parentHash breaks, including against the checkpoint', async () => {
        for (const side of ['a', 'b'] as const) {
            const nodes = pair(4);
            nodes[side].blocks.get(3)!.parent = bhash(9);
            const store = memoryStore();
            expectIncomplete(await run(nodes.a, nodes.b, store), /parentHash breaks at block 3/);
            expect(await store.getCheckpoint()).toBeNull();
        }
        const { a, b } = pair(5);
        const store = memoryStore();
        await save(store, { block: 2, hash: bhash(2) });
        a.blocks.get(3)!.parent = bhash(8);
        const result = await run(a, b, store);
        expect(result.state).toBe('INCOMPLETE');
        expectIncomplete(result, /parentHash breaks at block 3 on primary/);
        expect(await store.getCheckpoint()).toEqual({ block: 2, hash: bhash(2) });
    });

    it('is INCOMPLETE when a numeric header is not the finalized header that was read', async () => {
        for (const side of ['a', 'b'] as const) {
            const nodes = pair(3);
            nodes[side].finalizedHash = bhash(9);
            const store = memoryStore();
            expectIncomplete(await run(nodes.a, nodes.b, store), new RegExp(`finalized hash disagrees with header at block 3 on ${nodes[side].name}`));
            expect(await store.getCheckpoint()).toBeNull();
        }
        const behind = pair(4);
        behind.a.rewindFinalized = true;
        const behindStore = memoryStore();
        expectIncomplete(await run(behind.a, behind.b, behindStore), /finalized height fell behind block 4 on primary/);
        expect(await behindStore.getCheckpoint()).toBeNull();

        const moved = pair(3);
        moved.b.finalizedRereadHash = bhash(7);
        const movedStore = memoryStore();
        expectIncomplete(await run(moved.a, moved.b, movedStore), /finalized hash moved at block 3 on secondary/);
        expect(await movedStore.getCheckpoint()).toBeNull();
    });

    it('is INCOMPLETE for a finalized, header, or range read failure, without the error text', async () => {
        const fin = pair(3);
        fin.a.failFinalized = true;
        const finStore = memoryStore();
        const finResult = await run(fin.a, fin.b, finStore);
        expectIncomplete(finResult, /finalized read failed for primary/);
        expect(await finStore.getCheckpoint()).toBeNull();

        const heads = pair(3);
        heads.a.failHeader = true;
        expectIncomplete(await run(heads.a, heads.b), /header read failed for primary at block 1/);

        const logs = pair(3);
        logs.b.failRange = true;
        const logStore = memoryStore();
        const logResult = await run(logs.a, logs.b, logStore);
        expectIncomplete(logResult, /range log read failed for secondary/);
        expect(await logStore.getCheckpoint()).toBeNull();
        expect(await logStore.listUnresolved()).toEqual([]);
    });

    it('keeps the prior untouched when commit throws, then retries it', async () => {
        const { a, b } = pair(4);
        addBoth(a, b, 3, TOPIC);
        const inner = memoryStore();
        await prior(inner, bhash(1));
        let fault: string | null = 'disk';
        const store: GuardianAuditStore = {
            getCheckpoint: () => inner.getCheckpoint(),
            listUnresolved: () => inner.listUnresolved(),
            listAttributed: () => inner.listAttributed(),
            commit: async (change) => {
                if (fault) throw new Error('https://disk.example/commit');
                await inner.commit(change);
            },
        };
        const attributor: Attributor = {
            async attribute(action) {
                if (action.blockNumber === 1) return { ok: true, attribution: { who: 'old' } };
                return { ok: false, reason: 'later' };
            },
        };
        await expect(run(a, b, store, { attributor })).rejects.toThrow(/disk/);
        expect((await inner.listUnresolved()).map((item) => item.blockNumber)).toEqual([1]);
        expect(await inner.listAttributed()).toEqual([]);
        expect(await inner.getCheckpoint()).toBeNull();
        fault = null;
        const again = await run(a, b, store, { attributor });
        expect(again).toMatchObject({ state: 'UNATTRIBUTED', count: 1, unattributed: 1 });
        expect((await inner.listUnresolved()).map((item) => item.blockNumber)).toEqual([3]);
        expect(await inner.listAttributed()).toEqual([expect.objectContaining({ attribution: { who: 'old' } })]);
        expect(await inner.getCheckpoint()).toEqual({ block: 4, hash: bhash(4) });
    });

    it('rejects the later overlapping scan so the checkpoint cannot regress', async () => {
        const store = memoryStore();
        const slow = pair(5);
        const fast = pair(5);
        let release: () => void = () => {};
        slow.a.gate = new Promise<void>((resolve) => { release = resolve; });
        const first = run(slow.a, slow.b, store, { maxBlocks: 2 });
        for (let i = 0; i < 50 && !slow.a.calls.some((call) => call.method === 'eth_getLogs'); i++) {
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
        expect(slow.a.calls.some((call) => call.method === 'eth_getLogs')).toBe(true);
        const second = await run(fast.a, fast.b, store);
        expect(second).toMatchObject({ state: 'COMPLETE', to: 5 });
        release();
        await expect(first).rejects.toBeInstanceOf(CheckpointConflictError);
        expect(await store.getCheckpoint()).toEqual({ block: 5, hash: bhash(5) });
    });

    it('is INCOMPLETE when a clipped range follows a fork that does not reach the finalized header', async () => {
        const { a, b } = pair(5);
        const alt1 = bhash(1, 'fork');
        const alt2 = bhash(2, 'fork');
        for (const node of [a, b]) {
            node.setHash(1, alt1);
            node.setHash(2, alt2);
            node.blocks.get(2)!.parent = alt1;
        }
        const store = memoryStore();
        const result = await run(a, b, store, { maxBlocks: 2 });
        expectIncomplete(result, /finalized ancestry breaks at block 3/);
        expect(await store.getCheckpoint()).toBeNull();
    });

    it('a losing scan cannot overwrite attribution committed while it was paused', async () => {
        const store = memoryStore();
        await save(store, null, [row(1, 0)]);
        const slow = pair(3);
        const fast = pair(3);
        let release: () => void = () => {};
        let paused = false;
        const gate = new Promise<void>((resolve) => { release = resolve; });
        const first = run(slow.a, slow.b, store, {
            attributor: {
                async attribute() {
                    paused = true;
                    await gate;
                    return { ok: true, attribution: { who: 'A' } };
                },
            },
        });
        for (let i = 0; i < 100 && !paused; i++) await new Promise((resolve) => setTimeout(resolve, 10));
        expect(paused).toBe(true);
        const second = await run(fast.a, fast.b, store, {
            attributor: { async attribute() { return { ok: true, attribution: { who: 'B' } }; } },
        });
        expect(second).toMatchObject({ state: 'COMPLETE', count: 0 });
        release();
        await expect(first).rejects.toBeInstanceOf(CheckpointConflictError);
        expect(await store.listUnresolved()).toEqual([]);
        expect(await store.listAttributed()).toEqual([expect.objectContaining({ attribution: { who: 'B' } })]);
        expect(await store.getCheckpoint()).toEqual({ block: 3, hash: bhash(3) });
    });

    it('memoryStore reads do not share stored topic arrays', async () => {
        const store = memoryStore();
        const seeded = row(1, 0);
        await save(store, null, [seeded]);
        const listed = await store.listUnresolved();
        listed[0]!.log.topics.length = 0;
        expect((await store.listUnresolved())[0]?.log.topics).toEqual([TOPIC]);
    });

    it('a decoder that mutates topics and throws leaves the stored log unchanged', async () => {
        const inner = memoryStore();
        await save(inner, null, [row(1, 0)]);
        const box = (await inner.listUnresolved())[0]!;
        const store: GuardianAuditStore = {
            getCheckpoint: () => inner.getCheckpoint(),
            listUnresolved: async () => [box],
            listAttributed: () => inner.listAttributed(),
            commit: (change) => inner.commit(change),
        };
        const { a, b } = pair(3);
        const result = await run(a, b, store, {
            watched: [watched({
                decode(log) {
                    log.topics.length = 0;
                    throw new Error('boom');
                },
            })],
        });
        expectIncomplete(result, new RegExp(`decoder threw for ${getAddress(ADDR)} at block 1`));
        expect(box.log.topics).toEqual([TOPIC]);
    });

    it('an attributor that mutates topics does not change the stored log', async () => {
        const { a, b } = pair(3);
        addBoth(a, b, 2, TOPIC);
        const store = memoryStore();
        await run(a, b, store, {
            attributor: {
                async attribute(action) {
                    action.log.topics.length = 0;
                    return { ok: false, reason: 'no trace' };
                },
            },
        });
        expect((await store.listUnresolved())[0]?.log.topics).toEqual([TOPIC]);
    });

    it('memoryStore commit is idempotent by id and applies a conflict to nothing', async () => {
        const store = memoryStore();
        expect(unresolvedId('0xABCD', 10)).toBe('0xabcd:10');
        const seeded = row(1, 0);
        await store.commit({ expected: null, next: null, attributed: [], unresolved: [seeded], resolve: [] });
        await store.commit({
            expected: null, next: null, attributed: [], unresolved: [{ ...seeded, reason: 'second' }], resolve: [],
        });
        expect(await store.listUnresolved()).toEqual([expect.objectContaining({ reason: 'second' })]);
        await store.commit({ expected: null, next: null, attributed: [], unresolved: [], resolve: [seeded.id.toUpperCase()] });
        expect(await store.listUnresolved()).toEqual([]);
        await store.commit({ expected: null, next: { block: 1, hash: bhash(1) }, attributed: [], unresolved: [], resolve: [] });
        const cp = await store.getCheckpoint();
        cp!.block = 9;
        expect(await store.getCheckpoint()).toEqual({ block: 1, hash: bhash(1) });
        await store.commit({
            expected: { block: 1, hash: bhash(1).toUpperCase() as Hex },
            next: { block: 2, hash: bhash(2) },
            attributed: [], unresolved: [], resolve: [],
        });
        expect(await store.getCheckpoint()).toEqual({ block: 2, hash: bhash(2) });
        const intruder = row(4, 1);
        await expect(store.commit({
            expected: null,
            next: { block: 1, hash: bhash(1) },
            attributed: [],
            unresolved: [intruder],
            resolve: [],
        })).rejects.toBeInstanceOf(CheckpointConflictError);
        expect((await store.getCheckpoint())?.block).toBe(2);
        expect(await store.listUnresolved()).toEqual([]);
        const attributed = {
            id: unresolvedId(bhash(1), 0),
            blockNumber: 1, blockHash: bhash(1), txHash: tx(1, 0), logIndex: 0,
            address: ADDR, kind: 'guardian-added', decoded: { kind: 'guardian-added' },
            log: makeLog(1, bhash(1), 0, TOPIC), attribution: { who: 'guardian' },
        };
        const cursor = await store.getCheckpoint();
        await store.commit({ expected: cursor, next: null, attributed: [attributed], unresolved: [], resolve: [] });
        await store.commit({
            expected: cursor, next: null, attributed: [{ ...attributed, attribution: { who: 'again' } }], unresolved: [], resolve: [],
        });
        expect(await store.listAttributed()).toEqual([expect.objectContaining({ attribution: { who: 'again' } })]);
    });
});

const ok: Attributor = { async attribute() { return { ok: true, attribution: { who: 'guardian' } }; } };
