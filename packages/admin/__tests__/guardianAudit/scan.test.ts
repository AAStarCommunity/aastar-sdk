import { describe, expect, it } from 'vitest';
import { getAddress, keccak256, numberToHex, stringToHex, type Address, type Hex } from 'viem';
import { bloomOf } from '../../src/guardianAudit/bloom';
import {
    FinalityConflictError,
    memoryStore,
    scanRange,
    unresolvedId,
    type Attributor,
    type Checkpoint,
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

interface Block { hash: Hex; logs: RawLog[]; bloom: Hex | null; hide: Set<number> }

class Fake implements RawRpc {
    calls: { method: string; params: unknown[] }[] = [];
    blocks = new Map<number, Block>();
    byHashEmpty = false;
    failByHash = false;
    /** Replaces the by-hash answer. Range reads still use the block logs. */
    byHashOverride: RawLog[] | null = null;
    includeMismatch = false;
    garbage = false;
    leak: RawLog | null = null;
    constructor(public name: string, public finalized: number) {}

    fill(upTo: number, hashOf: (n: number) => Hex = bhash): void {
        for (let n = 1; n <= upTo; n++) {
            if (!this.blocks.has(n)) this.blocks.set(n, { hash: hashOf(n), logs: [], bloom: bloomOf([]), hide: new Set() });
        }
    }

    addLog(n: number, log: RawLog, hide = false): void {
        const block = this.blocks.get(n);
        if (!block) throw new Error(`missing block ${n}`);
        block.logs.push(log);
        if (hide) block.hide.add(Number.parseInt(log.logIndex, 16));
        block.bloom = bloomOf(block.logs.map((item) => ({ address: item.address, topics: item.topics })));
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

    async request(args: { method: string; params?: unknown[] }): Promise<unknown> {
        const params = args.params ?? [];
        this.calls.push({ method: args.method, params });
        if (args.method === 'eth_getBlockByNumber') {
            const tag = params[0];
            const n = tag === 'finalized' ? this.finalized : Number.parseInt(String(tag), 16);
            const block = this.blocks.get(n);
            if (!block) return null;
            return { number: numberToHex(n), hash: block.hash, logsBloom: block.bloom };
        }
        if (args.method === 'eth_getLogs') {
            const filter = params[0] as Record<string, unknown>;
            if ('topics' in filter) throw new Error('topics filter is not allowed');
            if (this.garbage) return [null];
            if (typeof filter.blockHash === 'string') {
                if (this.failByHash) throw new Error('https://rpc.example/secret');
                if (this.byHashEmpty) return [];
                if (this.byHashOverride) return this.byHashOverride;
                const want = filter.blockHash.toLowerCase();
                for (const block of this.blocks.values()) {
                    if (block.hash.toLowerCase() === want) return block.logs;
                }
                throw new Error('unknown block hash');
            }
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
        setCheckpoint: async (cp) => { events.push('checkpoint'); await inner.setCheckpoint(cp); },
        putUnresolved: async (items) => { events.push('put'); await inner.putUnresolved(items); },
        listUnresolved: () => inner.listUnresolved(),
        resolveUnresolved: async (id) => { events.push('resolve'); await inner.resolveUnresolved(id); },
    };
    return { store, events, inner };
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
    await store.putUnresolved([item]);
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

    it('rejects a provider name that is not a label before any read', async () => {
        const { a, b } = pair();
        a.name = 'https://rpc.example/v3/secret';
        const store = memoryStore();
        await expect(run(a, b, store)).rejects.toThrow(/provider name is not a label/);
        expect(a.calls).toHaveLength(0);
        expect(b.calls).toHaveLength(0);
    });

    it('returns COMPLETE(0) with no log reads when the cursor is already at finalized', async () => {
        const { a, b } = pair(5);
        const store = memoryStore();
        await store.setCheckpoint({ block: 5, hash: bhash(5) });
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
        const tags = clipped.a.calls.filter((call) => call.method === 'eth_getBlockByNumber').map((call) => call.params[0]);
        expect(tags).not.toContain('0x5');

        const lower = pair(50, 6);
        const second = await run(lower.a, lower.b, memoryStore(), { maxBlocks: 100 });
        expect(second).toMatchObject({ state: 'COMPLETE', to: 6 });
        const lowerTags = lower.a.calls.filter((call) => call.method === 'eth_getBlockByNumber').map((call) => call.params[0]);
        expect(lowerTags).not.toContain('0x7');
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
            await store.setCheckpoint(saved);
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
        expectIncomplete(await run(mismatched.a, mismatched.b), /blockHash disagrees with header at block 2/);

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

    it('recovers a log hidden from the range query via a by-hash read', async () => {
        const { a, b } = pair(3);
        addBoth(a, b, 2, TOPIC, 0, true);
        const store = memoryStore();
        const result = await run(a, b, store, { attributor: ok });
        expect(result).toMatchObject({ state: 'COMPLETE', count: 1, bloomRecovered: 1, bloomFalsePositives: 0 });
        if (result.state !== 'COMPLETE') return;
        expect(result.actions[0]).toMatchObject({ blockNumber: 2, logIndex: 0, kind: 'guardian-added', address: getAddress(ADDR) });
        expect(await store.getCheckpoint()).toEqual({ block: 3, hash: bhash(3) });
    });

    it('counts a bloom hit that a by-hash read shows is empty', async () => {
        const { a, b } = pair(3);
        const fake = bloomOf([{ address: ADDR, topics: [TOPIC] }]);
        a.setBloom(2, fake);
        b.setBloom(2, fake);
        const result = await run(a, b, memoryStore(), { attributor: ok });
        expect(result).toMatchObject({ state: 'COMPLETE', count: 0, bloomFalsePositives: 1, bloomRecovered: 0 });
    });

    it('is INCOMPLETE when the by-hash reads disagree or throw, and the reason has no URL', async () => {
        const disagree = pair(3);
        addBoth(disagree.a, disagree.b, 2, TOPIC, 0, true);
        disagree.b.byHashEmpty = true;
        const left = await run(disagree.a, disagree.b);
        expectIncomplete(left, /providers disagree on logs/);

        const failing = pair(3);
        addBoth(failing.a, failing.b, 2, TOPIC, 0, true);
        failing.a.failByHash = true;
        failing.b.failByHash = true;
        const right = await run(failing.a, failing.b);
        expectIncomplete(right, /by-hash log read failed/);
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
        expect(events).toEqual(['put', 'checkpoint']);
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

    it('does not move the checkpoint when putUnresolved throws', async () => {
        const { a, b } = pair(3);
        addBoth(a, b, 2, TOPIC);
        const inner = memoryStore();
        const events: string[] = [];
        const store: GuardianAuditStore = {
            getCheckpoint: () => inner.getCheckpoint(),
            setCheckpoint: async (cp) => { events.push('checkpoint'); await inner.setCheckpoint(cp); },
            putUnresolved: async () => { events.push('put'); throw new Error('disk'); },
            listUnresolved: () => inner.listUnresolved(),
            resolveUnresolved: (id) => inner.resolveUnresolved(id),
        };
        await expect(run(a, b, store)).rejects.toThrow(/disk/);
        expect(events).toEqual(['put']);
        expect(await inner.getCheckpoint()).toBeNull();
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

    it('retries stored unresolved actions first and resolves them before a new miss', async () => {
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
        expect(events[0]).toBe('resolve');
        expect(events).toEqual(['resolve', 'put', 'checkpoint']);
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
        await caught.setCheckpoint({ block: 4, hash: bhash(4) });
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
        await store.putUnresolved([
            row(2, 0),
            row(1, 3),
        ]);
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

    it('is INCOMPLETE when a by-hash answer names another block or another hash', async () => {
        const wrongBlock = pair(4);
        addBoth(wrongBlock.a, wrongBlock.b, 2, TOPIC, 0, true);
        const foreign = makeLog(3, bhash(3), 0, TOPIC);
        const home = makeLog(2, bhash(2), 0, TOPIC);
        wrongBlock.a.byHashOverride = [home, foreign];
        wrongBlock.b.byHashOverride = [home, foreign];
        expectIncomplete(await run(wrongBlock.a, wrongBlock.b), /contains block 3, not 2/);

        const wrongHash = pair(4);
        addBoth(wrongHash.a, wrongHash.b, 2, TOPIC, 0, true);
        const forged = makeLog(2, bhash(9), 0, TOPIC);
        wrongHash.a.byHashOverride = [forged];
        wrongHash.b.byHashOverride = [forged];
        const store = memoryStore();
        expectIncomplete(await run(wrongHash.a, wrongHash.b, store), /requested hash/);
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

    it('names a throwing decoder and writes nothing', async () => {
        const { a, b } = pair(3);
        addBoth(a, b, 2, TOPIC);
        const { store, events, inner } = trace();
        const failing = watched({
            decode() { throw new Error('https://evil.example/decoder'); },
        });
        await expect(run(a, b, store, { watched: [failing] })).rejects.toThrow(
            `decoder for ${getAddress(ADDR)} threw at block 2`,
        );
        expect(events).toEqual([]);
        expect(await inner.getCheckpoint()).toBeNull();
        expect(await inner.listUnresolved()).toEqual([]);
        try {
            await run(a, b, store, { watched: [failing] });
        } catch (error) {
            expect((error as Error).message).not.toMatch(/evil\.example/);
        }
    });

    it('memoryStore is idempotent by id and copies the checkpoint', async () => {
        const store = memoryStore();
        expect(unresolvedId('0xABCD', 10)).toBe('0xabcd:10');
        const row: UnresolvedAction = {
            id: unresolvedId(bhash(1), 0),
            blockNumber: 1, blockHash: bhash(1), txHash: tx(1, 0), logIndex: 0,
            address: ADDR, kind: 'guardian-added', reason: 'first', log: makeLog(1, bhash(1), 0, TOPIC),
        };
        await store.putUnresolved([row]);
        await store.putUnresolved([{ ...row, reason: 'second' }]);
        expect(await store.listUnresolved()).toEqual([expect.objectContaining({ reason: 'second' })]);
        await store.resolveUnresolved(row.id.toUpperCase());
        expect(await store.listUnresolved()).toEqual([]);
        await store.setCheckpoint({ block: 1, hash: bhash(1) });
        const cp = await store.getCheckpoint();
        cp!.block = 9;
        expect(await store.getCheckpoint()).toEqual({ block: 1, hash: bhash(1) });
    });
});

const ok: Attributor = { async attribute() { return { ok: true, attribution: { who: 'guardian' } }; } };
