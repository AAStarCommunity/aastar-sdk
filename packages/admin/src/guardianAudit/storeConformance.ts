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
    type StoreSnapshot,
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

function attributed(index: number, attribution: unknown = { who: 'guardian', trace: { id: 't' } }): AttributedAction {
    return {
        id: unresolvedId(WORD, index),
        blockNumber: 1, blockHash: WORD, txHash: WORD, logIndex: index,
        address: ADDR, kind: 'guardian-added',
        decoded: { kind: 'guardian-added', detail: { slot: index } },
        log: log(index),
        attribution,
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

/** Key order does not matter. Array order does. */
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

function frozen<T>(value: T): T {
    return structuredClone(value);
}

function readsMatch(store: GuardianAuditStore, snap: StoreSnapshot): Promise<boolean> {
    return Promise.all([store.getCheckpoint(), store.listUnresolved(), store.listAttributed()]).then(([checkpoint, unresolvedRows, attributedRows]) => (
        same(checkpoint, snap.checkpoint) && same(unresolvedRows, snap.unresolved) && same(attributedRows, snap.attributed)
    ));
}

async function empty(got: StoreUnderTest): Promise<void> {
    const snap = frozen(await got.store.snapshot());
    if (!Number.isSafeInteger(snap.revision) || snap.revision < 0) throw new Fault('revision is not a safe integer');
    if (snap.checkpoint !== null || snap.scope !== null) throw new Fault('fresh store is not empty');
    if (snap.unresolved.length !== 0 || snap.attributed.length !== 0) throw new Fault('fresh store has rows');
    if (!await readsMatch(got.store, snap)) throw new Fault('public reads disagree with the snapshot');
}

async function applies(got: StoreUnderTest): Promise<void> {
    const store = got.store;
    const seeded = unresolved(0);
    const first = await store.snapshot();
    await store.commit(commit({ expectedRevision: first.revision, unresolved: [seeded] }));
    const before = await store.snapshot();
    const tip: Checkpoint = { block: 4, hash: WORD };
    await store.commit(commit({
        expectedRevision: before.revision,
        next: tip,
        attributed: [attributed(1)],
        unresolved: [unresolved(2)],
        resolve: [seeded.id],
    }));
    const after = frozen(await store.snapshot());
    if (after.revision !== before.revision + 1) throw new Fault('revision did not advance by one');
    if (!same(after.checkpoint, tip)) throw new Fault('checkpoint was not committed');
    if (after.scope?.toLowerCase() !== SCOPE) throw new Fault('scope was not recorded');
    if (!same(after.unresolved, [unresolved(2)]) || !same(after.attributed, [attributed(1)])) {
        throw new Fault('persisted rows differ');
    }
}

/** A stale token must fail for a moved checkpoint and for a caught-up `next: null` commit. */
async function stale(got: StoreUnderTest): Promise<void> {
    const store = got.store;
    const before = await store.snapshot();
    await store.commit(commit({ expectedRevision: before.revision, next: { block: 1, hash: WORD } }));
    const mid = frozen(await store.snapshot());
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
    threw = false;
    try {
        await store.commit(commit({
            expectedRevision: before.revision,
            next: null,
            attributed: [attributed(4)],
        }));
    } catch (error) {
        threw = true;
        if (!(error instanceof StoreConflictError)) throw new Fault('caught-up stale revision threw the wrong error');
    }
    if (!threw) throw new Fault('caught-up stale revision was accepted');
    if (!same(frozen(await store.snapshot()), mid)) throw new Fault('caught-up stale revision changed the store');
}

async function oneRace(
    store: GuardianAuditStore,
    revision: number,
    left: Commit,
    right: Commit,
    label: string,
): Promise<'left' | 'right'> {
    const [a, b] = await Promise.allSettled([store.commit(left), store.commit(right)]);
    const won = [a, b].filter((item) => item.status === 'fulfilled');
    const lost = [a, b].filter((item) => item.status === 'rejected');
    if (won.length !== 1 || lost.length !== 1) throw new Fault(`${label} commits did not split one and one`);
    const reason = (lost[0] as PromiseRejectedResult).reason;
    if (!(reason instanceof StoreConflictError)) throw new Fault('the losing commit was not a revision conflict');
    const snap = await store.snapshot();
    if (snap.revision !== revision + 1) throw new Fault('winner did not advance the revision once');
    return a.status === 'fulfilled' ? 'left' : 'right';
}

/** One winner when the checkpoint moves, and one winner when both commits leave it alone. */
async function concurrent(got: StoreUnderTest): Promise<void> {
    const store = got.store;
    const before = await store.snapshot();
    const moved = await oneRace(
        store,
        before.revision,
        commit({ expectedRevision: before.revision, next: { block: 1, hash: WORD }, unresolved: [unresolved(1)] }),
        commit({ expectedRevision: before.revision, next: { block: 2, hash: WORD }, unresolved: [unresolved(2)] }),
        'moving',
    );
    const movedSnap = frozen(await store.snapshot());
    const movedRow = unresolved(moved === 'left' ? 1 : 2);
    if (!same(movedSnap.checkpoint, { block: moved === 'left' ? 1 : 2, hash: WORD })) throw new Fault('snapshot is not the winner');
    if (!same(movedSnap.unresolved, [movedRow])) throw new Fault('snapshot is not the winner');
    const caught = await oneRace(
        store,
        movedSnap.revision,
        commit({ expectedRevision: movedSnap.revision, next: null, attributed: [attributed(3)] }),
        commit({ expectedRevision: movedSnap.revision, next: null, attributed: [attributed(4)] }),
        'caught-up',
    );
    const after = frozen(await store.snapshot());
    if (!same(after.checkpoint, movedSnap.checkpoint)) throw new Fault('caught-up commit moved the checkpoint');
    if (!same(after.unresolved, movedSnap.unresolved)) throw new Fault('caught-up loser changed unresolved rows');
    if (!same(after.attributed, [attributed(caught === 'left' ? 3 : 4)])) throw new Fault('caught-up snapshot is not the winner');
}

async function crash(got: StoreUnderTest): Promise<void> {
    if (!got.crashNextCommit) throw new Skip('no fault hook');
    const store = got.store;
    const seeded = await store.snapshot();
    const tip: Checkpoint = { block: 3, hash: WORD };
    await store.commit(commit({
        expectedRevision: seeded.revision,
        next: tip,
        unresolved: [unresolved(0, 'kept')],
        attributed: [attributed(1)],
    }));
    const before = frozen(await store.snapshot());
    if (!same(before.unresolved, [unresolved(0, 'kept')]) || !same(before.attributed, [attributed(1)])) {
        throw new Fault('seed did not persist');
    }
    if (!same(before.checkpoint, tip)) throw new Fault('seed did not persist');
    got.crashNextCommit();
    let threw = false;
    try {
        await store.commit(commit({
            expectedRevision: before.revision,
            next: null,
            resolve: [unresolved(0, 'kept').id],
            attributed: [attributed(0, { who: 'replacement', trace: { id: 'new' } })],
            unresolved: [unresolved(5)],
        }));
    } catch {
        threw = true;
    }
    if (!threw) throw new Fault('armed crash did not reject the commit');
    if (!same(frozen(await store.snapshot()), before)) throw new Fault('crash left a partial write');
}

async function scope(got: StoreUnderTest): Promise<void> {
    const store = got.store;
    const before = await store.snapshot();
    await store.commit(commit({ expectedRevision: before.revision, next: { block: 1, hash: WORD } }));
    const recorded = frozen(await store.snapshot());
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
    if (!threw) throw new Fault('different scope was accepted');
    if (!same(frozen(await store.snapshot()), recorded)) throw new Fault('different scope changed the store');
}

async function idempotent(got: StoreUnderTest): Promise<void> {
    const store = got.store;
    const start = (await store.snapshot()).revision;
    await store.commit(commit({
        expectedRevision: start,
        unresolved: [unresolved(0)],
        attributed: [attributed(1)],
    }));
    const mid = await store.snapshot();
    if (mid.revision !== start + 1) throw new Fault('revision did not advance by one');
    await store.commit(commit({
        expectedRevision: mid.revision,
        unresolved: [unresolved(0, 'again')],
        attributed: [attributed(1, { who: 'again', trace: { id: 'new' } })],
    }));
    const snap = frozen(await store.snapshot());
    if (snap.revision !== mid.revision + 1) throw new Fault('replacement did not advance the revision');
    const expectedAttribution = attributed(1, { who: 'again', trace: { id: 'new' } });
    if (!same(snap.unresolved, [unresolved(0, 'again')]) || !same(snap.attributed, [expectedAttribution])) {
        throw new Fault('replacement payload was dropped');
    }
}

async function isolation(got: StoreUnderTest): Promise<void> {
    const store = got.store;
    const open = unresolved(0);
    const done = attributed(1);
    const revision = (await store.snapshot()).revision;
    const tip: Checkpoint = { block: 2, hash: WORD };
    await store.commit(commit({
        expectedRevision: revision,
        next: tip,
        unresolved: [open],
        attributed: [done],
    }));
    open.reason = 'hacked';
    open.log.topics.push(WORD);
    const decoded = done.decoded as unknown as { detail: { slot: number } };
    decoded.detail.slot = 99;
    (done.attribution as { trace: { id: string } }).trace.id = 'hacked';
    const snap = frozen(await store.snapshot());
    if (!same(snap.unresolved, [unresolved(0)]) || !same(snap.attributed, [attributed(1)])) {
        throw new Fault('committed input changed stored rows');
    }
    if (!same(snap.checkpoint, tip)) throw new Fault('stored checkpoint changed');
    const [checkpoint, unresolvedRows, attributedRows] = await Promise.all([
        store.getCheckpoint(),
        store.listUnresolved(),
        store.listAttributed(),
    ]);
    if (!same(checkpoint, snap.checkpoint) || !same(unresolvedRows, snap.unresolved) || !same(attributedRows, snap.attributed)) {
        throw new Fault('public reads disagree with the snapshot');
    }
    if (checkpoint) checkpoint.block = 99;
    const unresolvedRow = unresolvedRows[0];
    const attributedRow = attributedRows[0];
    if (!unresolvedRow || !attributedRow) throw new Fault('public reads disagree with the snapshot');
    unresolvedRow.reason = 'hacked';
    unresolvedRow.log.topics.push(WORD);
    (attributedRow.decoded as unknown as { detail: { slot: number } }).detail.slot = 77;
    (attributedRow.attribution as { trace: { id: string } }).trace.id = 'leaked';
    const again = frozen(await store.snapshot());
    const [checkpointAgain, unresolvedAgain, attributedAgain] = await Promise.all([
        store.getCheckpoint(),
        store.listUnresolved(),
        store.listAttributed(),
    ]);
    if (!same(again, snap) || !same(checkpointAgain, tip) || !same(unresolvedAgain, snap.unresolved) || !same(attributedAgain, snap.attributed)) {
        throw new Fault('stored rows changed after mutation');
    }
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
