/**
 * Shared rules for GuardianAuditStore. No test runner and no Node builtins:
 * file stores and IndexedDB stores call this from their own runners.
 */
import type { Address, Hex } from 'viem';
import {
    ScopeChangedError,
    StoreConflictError,
    unresolvedId,
    type AttributedAction,
    type Checkpoint,
    type Commit,
    type GuardianAuditStore,
    type UnresolvedAction,
} from './store.js';

/** A store plus an optional hook that crashes the next commit after writing has started. */
export interface StoreUnderTest {
    store: GuardianAuditStore;
    /** Arms a crash that aborts the next commit after it has started writing. */
    crashNextCommit?: () => void;
}

export interface ConformanceResult {
    name: string;
    status: 'pass' | 'fail' | 'skipped';
    detail?: string;
}

const WORD = `0x${'ab'.repeat(32)}` as Hex;
const SCOPE = `0x${'11'.repeat(32)}` as Hex;
const OTHER_SCOPE = `0x${'22'.repeat(32)}` as Hex;
const ADDR = '0x1111111111111111111111111111111111111111' as Address;

class Fault extends Error {}
class Skip extends Error {}

function log(index: number) {
    return {
        address: ADDR,
        topics: [WORD],
        data: '0x' as Hex,
        blockHash: WORD,
        transactionHash: WORD,
        blockNumber: '0x1' as Hex,
        logIndex: `0x${index.toString(16)}` as Hex,
        removed: false,
    };
}

function unresolved(index: number, reason = 'no attributor'): UnresolvedAction {
    return {
        id: unresolvedId(WORD, index),
        blockNumber: 1, blockHash: WORD, txHash: WORD, logIndex: index,
        address: ADDR, kind: 'guardian-added', reason, log: log(index),
    };
}

function attributed(index: number): AttributedAction {
    return {
        id: unresolvedId(WORD, index),
        blockNumber: 1, blockHash: WORD, txHash: WORD, logIndex: index,
        address: ADDR, kind: 'guardian-added', decoded: { kind: 'guardian-added' },
        log: log(index), attribution: { who: 'guardian' },
    };
}

function commit(over: Partial<Commit> & Pick<Commit, 'expectedRevision'>): Commit {
    return {
        next: null,
        scope: SCOPE,
        attributed: [],
        unresolved: [],
        resolve: [],
        ...over,
    };
}

function same(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
        return a.every((item, i) => same(item, b[i]));
    }
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (aKeys.length !== bKeys.length || aKeys.some((key, i) => key !== bKeys[i])) return false;
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    return aKeys.every((key) => same(left[key], right[key]));
}

async function empty(got: StoreUnderTest): Promise<void> {
    const snap = await got.store.snapshot();
    if (!Number.isSafeInteger(snap.revision) || snap.revision < 0) throw new Fault('revision is not a safe integer');
    if (snap.checkpoint !== null || snap.scope !== null) throw new Fault('fresh store is not empty');
    if (snap.unresolved.length !== 0 || snap.attributed.length !== 0) throw new Fault('fresh store has rows');
}

async function applies(got: StoreUnderTest): Promise<void> {
    const store = got.store;
    const seeded = unresolved(0);
    const first = await store.snapshot();
    await store.commit(commit({ expectedRevision: first.revision, unresolved: [seeded] }));
    const before = await store.snapshot();
    const kept = unresolved(2);
    const accepted = attributed(1);
    const tip: Checkpoint = { block: 4, hash: WORD };
    await store.commit(commit({
        expectedRevision: before.revision,
        next: tip,
        attributed: [accepted],
        unresolved: [kept],
        resolve: [seeded.id],
    }));
    const after = await store.snapshot();
    if (after.revision !== before.revision + 1) throw new Fault('revision did not advance by one');
    if (!same(after.checkpoint, tip)) throw new Fault('checkpoint was not committed');
    if (after.scope?.toLowerCase() !== SCOPE) throw new Fault('scope was not recorded');
    if (after.unresolved.length !== 1 || after.unresolved[0]?.logIndex !== 2) throw new Fault('resolve or unresolved was partial');
    if (after.attributed.length !== 1 || after.attributed[0]?.logIndex !== 1) throw new Fault('attributed row missing');
}

async function stale(got: StoreUnderTest): Promise<void> {
    const store = got.store;
    const before = await store.snapshot();
    await store.commit(commit({ expectedRevision: before.revision, next: { block: 1, hash: WORD } }));
    const mid = await store.snapshot();
    let threw = false;
    try {
        await store.commit(commit({
            expectedRevision: before.revision,
            next: { block: 9, hash: WORD },
            unresolved: [unresolved(4)],
        }));
    } catch (error) {
        threw = true;
        if (!(error instanceof StoreConflictError)) throw new Fault('stale revision threw the wrong error');
    }
    if (!threw) throw new Fault('stale revision was accepted');
    if (!same(await store.snapshot(), mid)) throw new Fault('stale revision changed the store');
}

async function concurrent(got: StoreUnderTest): Promise<void> {
    const store = got.store;
    const before = await store.snapshot();
    const left = unresolved(1);
    const right = unresolved(2);
    const [a, b] = await Promise.allSettled([
        store.commit(commit({ expectedRevision: before.revision, next: { block: 1, hash: WORD }, unresolved: [left] })),
        store.commit(commit({ expectedRevision: before.revision, next: { block: 2, hash: WORD }, unresolved: [right] })),
    ]);
    const won = [a, b].filter((item) => item.status === 'fulfilled');
    const lost = [a, b].filter((item) => item.status === 'rejected');
    if (won.length !== 1 || lost.length !== 1) throw new Fault('concurrent commits did not split one and one');
    const reason = (lost[0] as PromiseRejectedResult).reason;
    if (!(reason instanceof StoreConflictError)) throw new Fault('the losing commit was not a revision conflict');
    const winner = a.status === 'fulfilled' ? { block: 1, index: 1 } : { block: 2, index: 2 };
    const snap = await store.snapshot();
    if (snap.revision !== before.revision + 1) throw new Fault('winner did not advance the revision once');
    if (snap.checkpoint?.block !== winner.block) throw new Fault('snapshot is not the winner');
    if (snap.unresolved.length !== 1 || snap.unresolved[0]?.logIndex !== winner.index) throw new Fault('snapshot is not the winner');
}

async function crash(got: StoreUnderTest): Promise<void> {
    if (!got.crashNextCommit) throw new Skip('no fault hook');
    const before = await got.store.snapshot();
    got.crashNextCommit();
    let threw = false;
    try {
        await got.store.commit(commit({
            expectedRevision: before.revision,
            next: { block: 9, hash: WORD },
            unresolved: [unresolved(5)],
            attributed: [attributed(6)],
        }));
    } catch {
        threw = true;
    }
    if (!threw) throw new Fault('armed crash did not reject the commit');
    if (!same(await got.store.snapshot(), before)) throw new Fault('crash left a partial write');
}

async function scope(got: StoreUnderTest): Promise<void> {
    const store = got.store;
    const before = await store.snapshot();
    await store.commit(commit({ expectedRevision: before.revision, next: { block: 1, hash: WORD } }));
    const recorded = await store.snapshot();
    if (recorded.scope?.toLowerCase() !== SCOPE) throw new Fault('first commit did not record scope');
    let threw = false;
    try {
        await store.commit(commit({
            expectedRevision: recorded.revision,
            scope: OTHER_SCOPE,
            next: { block: 8, hash: WORD },
            unresolved: [unresolved(7)],
        }));
    } catch (error) {
        threw = true;
        if (!(error instanceof ScopeChangedError)) throw new Fault('different scope threw the wrong error');
    }
    const after = await store.snapshot();
    if (!same(after, recorded)) throw new Fault('different scope changed the store');
    if (!threw && after.scope?.toLowerCase() !== SCOPE) throw new Fault('different scope was stored');
}

async function idempotent(got: StoreUnderTest): Promise<void> {
    const store = got.store;
    const open = unresolved(0);
    const done = attributed(1);
    let revision = (await store.snapshot()).revision;
    await store.commit(commit({ expectedRevision: revision, unresolved: [open], attributed: [done] }));
    revision = (await store.snapshot()).revision;
    await store.commit(commit({
        expectedRevision: revision,
        unresolved: [{ ...open, reason: 'again' }],
        attributed: [{ ...done, attribution: { who: 'again' } }],
    }));
    const snap = await store.snapshot();
    if (snap.unresolved.length !== 1 || snap.attributed.length !== 1) throw new Fault('ids were duplicated');
}

async function isolation(got: StoreUnderTest): Promise<void> {
    const store = got.store;
    const open = unresolved(0);
    const revision = (await store.snapshot()).revision;
    await store.commit(commit({ expectedRevision: revision, next: { block: 2, hash: WORD }, unresolved: [open] }));
    open.reason = 'hacked';
    open.log.topics.push(WORD);
    const view = await store.snapshot();
    const row = view.unresolved[0];
    if (!row || !view.checkpoint) throw new Fault('committed row missing');
    row.reason = 'hacked';
    row.log.topics.push(WORD);
    view.checkpoint.block = 99;
    view.unresolved.push(unresolved(3));
    const again = await store.snapshot();
    if (again.unresolved.length !== 1 || again.unresolved[0]?.reason !== 'no attributor') throw new Fault('stored row changed');
    if (again.unresolved[0]?.log.topics.length !== 1) throw new Fault('stored log changed');
    if (again.checkpoint?.block !== 2) throw new Fault('stored checkpoint changed');
}

const CHECKS: [string, (got: StoreUnderTest) => Promise<void>][] = [
    ['empty snapshot', empty],
    ['commit applies the whole change and bumps the revision', applies],
    ['stale revision changes nothing', stale],
    ['one of two concurrent commits wins', concurrent],
    ['crash between write and commit', crash],
    ['scope is recorded and a different scope is refused', scope],
    ['re-committing the same ids does not duplicate rows', idempotent],
    ['callers cannot mutate stored rows', isolation],
];

/** Run every store rule. One fresh store per check. Never throws. */
export async function runStoreConformance(
    make: () => Promise<StoreUnderTest> | StoreUnderTest,
): Promise<ConformanceResult[]> {
    const results: ConformanceResult[] = [];
    for (const [name, run] of CHECKS) {
        try {
            await run(await make());
            results.push({ name, status: 'pass' });
        } catch (error) {
            if (error instanceof Skip) results.push({ name, status: 'skipped', detail: error.message });
            else results.push({ name, status: 'fail', detail: error instanceof Fault ? error.message : 'check failed' });
        }
    }
    return results;
}
