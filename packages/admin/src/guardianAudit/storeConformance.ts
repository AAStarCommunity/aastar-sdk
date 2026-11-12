/**
 * Shared rules for GuardianAuditStore. No test runner and no Node builtins:
 * file stores and IndexedDB stores call this from their own runners.
 *
 * Every state-changing rule runs twice from a seeded store: `moving` (next set)
 * and `caught-up` (next null). The seed is a checkpoint, two unresolved rows,
 * two attributed rows, and a scope. Each of those commits also resolves an id.
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
const WORD2 = `0x${'cd'.repeat(32)}` as Hex;
const SCOPE = `0x${'11'.repeat(32)}` as Hex;
const OTHER_SCOPE = `0x${'22'.repeat(32)}` as Hex;
const ADDR = '0x1111111111111111111111111111111111111111' as Address;
const TIP: Checkpoint = { block: 4, hash: WORD };
const MOVED: Checkpoint = { block: 9, hash: WORD2 };

type Form = 'moving' | 'caught-up';

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

function nextOf(form: Form): Checkpoint | null {
    return form === 'moving' ? { block: MOVED.block, hash: MOVED.hash } : null;
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

/** Change every leaf of a returned value. Arrays are pushed after their current items are walked. */
function deepMutate(value: unknown): void {
    if (Array.isArray(value)) {
        for (const item of [...value]) deepMutate(item);
        value.push('mutated');
        return;
    }
    if (typeof value !== 'object' || value === null) return;
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
        const child = record[key];
        if (child !== null && typeof child === 'object') deepMutate(child);
        else if (typeof child === 'number') record[key] = child + 1;
        else if (typeof child === 'string') record[key] = `${child}#`;
        else if (typeof child === 'boolean') record[key] = !child;
    }
}

function mutatedRow<T extends { id: string }>(row: T): T {
    const copy = frozen(row);
    deepMutate(copy);
    copy.id = row.id;
    return copy;
}

function seedRows() {
    return {
        unresolved: [unresolved(10, 'open-a'), unresolved(11, 'open-b')],
        attributed: [attributed(12), attributed(13)],
    };
}

function seedSnapshot(revision: number): StoreSnapshot {
    const rows = seedRows();
    return {
        revision,
        checkpoint: { block: TIP.block, hash: TIP.hash },
        scope: SCOPE,
        unresolved: rows.unresolved,
        attributed: rows.attributed,
    };
}

async function seed(store: GuardianAuditStore): Promise<StoreSnapshot> {
    const first = await store.snapshot();
    const rows = seedRows();
    await store.commit(commit({
        expectedRevision: first.revision,
        next: { block: TIP.block, hash: TIP.hash },
        unresolved: rows.unresolved,
        attributed: rows.attributed,
    }));
    const snap = frozen(await store.snapshot());
    const expected = seedSnapshot(first.revision + 1);
    if (!same(snap.unresolved, expected.unresolved) || !same(snap.attributed, expected.attributed)) {
        throw new Fault('persisted rows differ');
    }
    if (!same(snap, expected)) throw new Fault('seed did not persist');
    return snap;
}

async function readsMatch(store: GuardianAuditStore, snap: StoreSnapshot): Promise<boolean> {
    const [checkpoint, unresolvedRows, attributedRows] = await Promise.all([
        store.getCheckpoint(), store.listUnresolved(), store.listAttributed(),
    ]);
    return same(checkpoint, snap.checkpoint) && same(unresolvedRows, snap.unresolved) && same(attributedRows, snap.attributed);
}

async function empty(got: StoreUnderTest): Promise<void> {
    const snap = frozen(await got.store.snapshot());
    if (!Number.isSafeInteger(snap.revision) || snap.revision < 0) throw new Fault('revision is not a safe integer');
    if (snap.checkpoint !== null || snap.scope !== null) throw new Fault('fresh store is not empty');
    if (snap.unresolved.length !== 0 || snap.attributed.length !== 0) throw new Fault('fresh store has rows');
    if (!await readsMatch(got.store, snap)) throw new Fault('public reads disagree with the snapshot');
}

async function applyCell(got: StoreUnderTest, form: Form): Promise<void> {
    const store = got.store;
    const seeded = await seed(store);
    await store.commit(commit({
        expectedRevision: seeded.revision,
        next: nextOf(form),
        resolve: [unresolved(10, 'open-a').id],
        unresolved: [unresolved(20)],
        attributed: [attributed(21)],
    }));
    const after = frozen(await store.snapshot());
    const expected: StoreSnapshot = {
        revision: seeded.revision + 1,
        checkpoint: form === 'moving' ? { block: MOVED.block, hash: MOVED.hash } : { block: TIP.block, hash: TIP.hash },
        scope: SCOPE,
        unresolved: [unresolved(11, 'open-b'), unresolved(20)],
        attributed: [attributed(12), attributed(13), attributed(21)],
    };
    if (!same(after, expected)) throw new Fault(`${form} persisted rows differ`);
}

async function staleCell(got: StoreUnderTest, form: Form): Promise<void> {
    const store = got.store;
    const seeded = await seed(store);
    let threw = false;
    try {
        await store.commit(commit({
            expectedRevision: seeded.revision - 1,
            next: form === 'moving' ? { block: 99, hash: WORD2 } : null,
            resolve: [unresolved(10, 'open-a').id],
            unresolved: [unresolved(30)],
            attributed: [attributed(31)],
        }));
    } catch (error) {
        threw = true;
        if (!(error instanceof StoreConflictError)) throw new Fault(`${form} stale revision threw the wrong error`);
    }
    if (!threw) throw new Fault(`${form} stale revision was accepted`);
    if (!same(frozen(await store.snapshot()), seeded)) throw new Fault(`${form} stale revision changed the store`);
}

async function concurrentCell(got: StoreUnderTest, form: Form): Promise<void> {
    const store = got.store;
    const seeded = await seed(store);
    const left = form === 'moving'
        ? commit({ expectedRevision: seeded.revision, next: { block: 5, hash: WORD }, resolve: [unresolved(10, 'open-a').id], unresolved: [unresolved(31)] })
        : commit({ expectedRevision: seeded.revision, next: null, resolve: [unresolved(10, 'open-a').id], attributed: [attributed(31)] });
    const right = form === 'moving'
        ? commit({ expectedRevision: seeded.revision, next: { block: 6, hash: WORD2 }, resolve: [unresolved(10, 'open-a').id], unresolved: [unresolved(32)] })
        : commit({ expectedRevision: seeded.revision, next: null, resolve: [unresolved(10, 'open-a').id], attributed: [attributed(32)] });
    const [a, b] = await Promise.allSettled([store.commit(left), store.commit(right)]);
    const won = [a, b].filter((item) => item.status === 'fulfilled');
    const lost = [a, b].filter((item) => item.status === 'rejected');
    if (won.length !== 1 || lost.length !== 1) throw new Fault(`${form} commits did not split one and one`);
    const reason = (lost[0] as PromiseRejectedResult).reason;
    if (!(reason instanceof StoreConflictError)) throw new Fault(`${form} losing commit was not a revision conflict`);
    const winner = a.status === 'fulfilled' ? 'left' : 'right';
    const after = frozen(await store.snapshot());
    const added = winner === 'left' ? 31 : 32;
    const expected: StoreSnapshot = {
        revision: seeded.revision + 1,
        checkpoint: form === 'moving'
            ? { block: winner === 'left' ? 5 : 6, hash: winner === 'left' ? WORD : WORD2 }
            : { block: TIP.block, hash: TIP.hash },
        scope: SCOPE,
        unresolved: form === 'moving'
            ? [unresolved(11, 'open-b'), unresolved(added)]
            : [unresolved(11, 'open-b')],
        attributed: form === 'moving'
            ? [attributed(12), attributed(13)]
            : [attributed(12), attributed(13), attributed(added)],
    };
    if (!same(after, expected)) throw new Fault(`${form} snapshot is not the winner`);
}

async function crashCell(got: StoreUnderTest, form: Form): Promise<void> {
    if (!got.crashNextCommit) throw new Skip('no fault hook');
    const store = got.store;
    const seeded = await seed(store);
    got.crashNextCommit();
    let threw = false;
    try {
        await store.commit(commit({
            expectedRevision: seeded.revision,
            next: form === 'moving' ? { block: 99, hash: WORD2 } : null,
            resolve: [unresolved(10, 'open-a').id],
            unresolved: [unresolved(41)],
            attributed: [attributed(40, { who: 'replacement', trace: { id: 'new' } })],
        }));
    } catch {
        threw = true;
    }
    if (!threw) throw new Fault(`${form} armed crash did not reject the commit`);
    if (!same(frozen(await store.snapshot()), seeded)) throw new Fault(`${form} crash left a partial write`);
}

async function scopeCell(got: StoreUnderTest, form: Form): Promise<void> {
    const store = got.store;
    const seeded = await seed(store);
    let threw = false;
    try {
        await store.commit(commit({
            expectedRevision: seeded.revision,
            scope: OTHER_SCOPE,
            next: nextOf(form),
            resolve: [unresolved(10, 'open-a').id],
            unresolved: [unresolved(51)],
            attributed: [attributed(50)],
        }));
    } catch (error) {
        threw = true;
        if (!(error instanceof ScopeChangedError)) throw new Fault(`${form} different scope threw the wrong error`);
    }
    if (!threw) throw new Fault(`${form} different scope was accepted`);
    if (!same(frozen(await store.snapshot()), seeded)) throw new Fault(`${form} different scope changed the store`);
}

async function replacementCell(got: StoreUnderTest, form: Form): Promise<void> {
    const store = got.store;
    const seeded = await seed(store);
    const open = mutatedRow(unresolved(11, 'open-b'));
    const done = mutatedRow(attributed(12));
    const payload = frozen({ open, done });
    await store.commit(commit({
        expectedRevision: seeded.revision,
        next: nextOf(form),
        resolve: [unresolved(10, 'open-a').id],
        unresolved: [open],
        attributed: [done],
    }));
    const after = frozen(await store.snapshot());
    const expected: StoreSnapshot = {
        revision: seeded.revision + 1,
        checkpoint: form === 'moving' ? { block: MOVED.block, hash: MOVED.hash } : { block: TIP.block, hash: TIP.hash },
        scope: SCOPE,
        unresolved: [payload.open],
        attributed: [payload.done, attributed(13)],
    };
    if (!same(after, expected)) throw new Fault(`${form} replacement payload was dropped`);
}

async function idempotentCell(got: StoreUnderTest, form: Form): Promise<void> {
    const store = got.store;
    const seeded = await seed(store);
    await store.commit(commit({
        expectedRevision: seeded.revision,
        next: nextOf(form),
        resolve: [unresolved(10, 'open-a').id],
        unresolved: [unresolved(11, 'open-b')],
        attributed: [attributed(12), attributed(13)],
    }));
    const after = frozen(await store.snapshot());
    const expected: StoreSnapshot = {
        revision: seeded.revision + 1,
        checkpoint: form === 'moving' ? { block: MOVED.block, hash: MOVED.hash } : { block: TIP.block, hash: TIP.hash },
        scope: SCOPE,
        unresolved: [unresolved(11, 'open-b')],
        attributed: [attributed(12), attributed(13)],
    };
    if (after.unresolved.length !== 1 || after.attributed.length !== 2) throw new Fault(`${form} ids were duplicated`);
    if (after.revision !== seeded.revision + 1) throw new Fault(`${form} replacement did not advance the revision`);
    if (!same(after, expected)) throw new Fault(`${form} replacement payload was dropped`);
}

async function isolation(got: StoreUnderTest): Promise<void> {
    const store = got.store;
    const openA = unresolved(10, 'open-a');
    const openB = unresolved(11, 'open-b');
    const doneA = attributed(12);
    const doneB = attributed(13);
    const next = { block: TIP.block, hash: TIP.hash };
    const first = await store.snapshot();
    await store.commit(commit({
        expectedRevision: first.revision,
        next,
        unresolved: [openA, openB],
        attributed: [doneA, doneB],
    }));
    const canonical = seedSnapshot(first.revision + 1);
    deepMutate(openA);
    deepMutate(openB);
    deepMutate(doneA);
    deepMutate(doneB);
    deepMutate(next);
    const raw = await store.snapshot();
    if (!same(frozen(raw), canonical)) throw new Fault('committed input changed stored rows');
    const checkpoint = await store.getCheckpoint();
    const unresolvedRows = await store.listUnresolved();
    const attributedRows = await store.listAttributed();
    if (!same(frozen(checkpoint), canonical.checkpoint) || !same(frozen(unresolvedRows), canonical.unresolved) || !same(frozen(attributedRows), canonical.attributed)) {
        throw new Fault('public reads disagree with the snapshot');
    }
    deepMutate(raw);
    deepMutate(checkpoint);
    deepMutate(unresolvedRows);
    deepMutate(attributedRows);
    const again = frozen(await store.snapshot());
    const [checkpointAgain, unresolvedAgain, attributedAgain] = await Promise.all([
        store.getCheckpoint(), store.listUnresolved(), store.listAttributed(),
    ]);
    if (!same(again, canonical) || !same(frozen(checkpointAgain), canonical.checkpoint) || !same(frozen(unresolvedAgain), canonical.unresolved) || !same(frozen(attributedAgain), canonical.attributed)) {
        throw new Fault('stored rows changed after mutation');
    }
}

const FORMS: Form[] = ['moving', 'caught-up'];

const CHECKS: [string, (got: StoreUnderTest) => Promise<void>][] = [
    ['empty snapshot', empty],
    ...FORMS.flatMap((form): [string, (got: StoreUnderTest) => Promise<void>][] => [
        [`commit/${form}`, (got) => applyCell(got, form)],
        [`stale/${form}`, (got) => staleCell(got, form)],
        [`concurrent/${form}`, (got) => concurrentCell(got, form)],
        [`crash/${form}`, (got) => crashCell(got, form)],
        [`scope/${form}`, (got) => scopeCell(got, form)],
        [`replacement/${form}`, (got) => replacementCell(got, form)],
        [`idempotence/${form}`, (got) => idempotentCell(got, form)],
    ]),
    ['isolation', isolation],
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
