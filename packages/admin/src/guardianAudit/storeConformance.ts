/**
 * Shared rules for GuardianAuditStore. No test runner and no Node builtins:
 * file stores and IndexedDB stores call this from their own runners.
 *
 * Every state-changing rule runs twice from a seeded store: `moving` (next set)
 * and `caught-up` (next null). The seed is a checkpoint, two unresolved rows,
 * two attributed rows, and a scope. Each of those commits also resolves an id.
 * Row lists are equal by id. Insertion order is not part of the store contract.
 * Replacement rows are valid actions. `deepMutate` is only for alias probes.
 *
 * Atomicity is only as good as the store's honest fault hook. The suite cannot
 * see inside the store. `crashDuringNextCommit(step)` aborts the next commit
 * after `step` internal write steps (0 means before any write). `commitSteps()`
 * is how many internal writes one commit performs (1 for a single atomic write).
 * Each crash cell sweeps `step = 0..commitSteps()` and requires the snapshot to
 * stay unchanged. A passing crash cell reports
 * "atomicity checked through the store's fault hook".
 * Without both hook methods the crash cells are `skipped` and the detail is
 * exactly "no fault hook". A non-atomic store that omits the hook reports no
 * crash failure. The concurrency cell runs both commits on one store instance.
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

/**
 * A store plus the optional fault hook. Without both methods the crash cells are skipped.
 * The hook is the only view the suite has of a commit's internal writes.
 */
export interface StoreUnderTest {
    store: GuardianAuditStore;
    /** Abort the next commit after `step` internal write steps. 0 is before any write. */
    crashDuringNextCommit?: (step: number) => void;
    /** Internal writes one commit performs. 1 when the publish is a single atomic write. */
    commitSteps?: () => number;
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
const ALT = '0x2222222222222222222222222222222222222222' as Address;
const ALT_WORD = `0x${'ef'.repeat(32)}` as Hex;
const ALT_TOPIC = `0x${'12'.repeat(32)}` as Hex;
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

/**
 * Key order does not matter. Array order does, except row lists compared by id. Prototypes must match,
 * every own string key counts (enumerable or not), Uint8Array compares bytes, and any other non-plain
 * object (Error, Map, Set, Date, ...) is never equal to anything but itself: rows are plain data.
 */
function same(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
    const proto = Object.getPrototypeOf(a);
    if (proto !== Object.getPrototypeOf(b)) return false;
    if (proto === Uint8Array.prototype) {
        const x = a as Uint8Array;
        const y = b as Uint8Array;
        return x.length === y.length && x.every((byte, i) => byte === y[i]);
    }
    if (Array.isArray(a)) {
        const y = b as unknown[];
        return a.length === y.length && a.every((item, i) => same(item, y[i]));
    }
    if (proto !== Object.prototype && proto !== null) return false;
    const aKeys = Reflect.ownKeys(a);
    const bKeys = Reflect.ownKeys(b);
    if (aKeys.some((key) => typeof key === 'symbol') || bKeys.some((key) => typeof key === 'symbol')) return false;
    const left = (aKeys as string[]).sort();
    const right = (bKeys as string[]).sort();
    if (left.length !== right.length || left.some((key, i) => key !== right[i])) return false;
    const x = a as Record<string, unknown>;
    const y = b as Record<string, unknown>;
    return left.every((key) => same(x[key], y[key]));
}

function rowKey(row: unknown): string {
    if (typeof row !== 'object' || row === null || !('id' in row)) return '';
    const id = (row as { id: unknown }).id;
    return typeof id === 'string' ? id.toLowerCase() : '';
}

/** Row collections match by id. Any stable order is acceptable. */
function sameRows(a: readonly unknown[], b: readonly unknown[]): boolean {
    if (a.length !== b.length) return false;
    const order = (left: unknown, right: unknown) => rowKey(left) < rowKey(right) ? -1 : rowKey(left) > rowKey(right) ? 1 : 0;
    const left = [...a].sort(order);
    const right = [...b].sort(order);
    return left.every((item, i) => same(item, right[i]));
}

function sameSnapshot(a: StoreSnapshot, b: StoreSnapshot): boolean {
    return a.revision === b.revision
        && same(a.checkpoint, b.checkpoint)
        && same(a.scope, b.scope)
        && sameRows(a.unresolved, b.unresolved)
        && sameRows(a.attributed, b.attributed);
}

/**
 * An independent plain-data copy for expected values. It deliberately does not reuse the store's or
 * scanner's clone helper, so a bug there cannot also hide in what the suite compares against.
 */
function frozen<T>(value: T): T {
    const copyOf = (v: unknown): unknown => {
        if (v === null || typeof v !== 'object') return v;
        const proto = Object.getPrototypeOf(v);
        if (proto === Uint8Array.prototype) return Uint8Array.from(v as Uint8Array);
        if (Array.isArray(v)) return v.map(copyOf);
        if (proto !== Object.prototype && proto !== null) throw new Fault('a returned value is not plain data');
        const out: Record<string, unknown> = {};
        for (const key of Reflect.ownKeys(v)) {
            if (typeof key === 'symbol') throw new Fault('a returned value is not plain data');
            out[key] = copyOf((v as Record<string, unknown>)[key]);
        }
        return out;
    };
    return copyOf(value) as T;
}

/** Change every leaf of a returned value. Arrays are pushed after their current items are walked. */
function deepMutate(value: unknown): void {
    if (Array.isArray(value)) {
        for (const item of [...value]) deepMutate(item);
        value.push('mutated');
        return;
    }
    if (typeof value !== 'object' || value === null) return;
    if (value instanceof Uint8Array) {
        for (let i = 0; i < value.length; i++) value[i] = value[i] ^ 0xff;
        return;
    }
    const record = value as Record<string, unknown>;
    for (const key of Reflect.ownKeys(record)) {
        if (typeof key === 'symbol') continue;
        const child = record[key];
        if (child !== null && typeof child === 'object') deepMutate(child);
        else if (typeof child === 'number') record[key] = child + 1;
        else if (typeof child === 'string') record[key] = `${child}#`;
        else if (typeof child === 'boolean') record[key] = !child;
        else if (typeof child === 'bigint') record[key] = child + 1n;
    }
}

/** A valid replacement of an existing id. Identity stays `blockHash:logIndex`. Every other field changes. */
function replacedUnresolved(): UnresolvedAction {
    const row = unresolved(11, 'corrected reason');
    row.address = ALT;
    row.kind = 'guardian-removed';
    row.txHash = ALT_WORD;
    row.log = { ...log(11), address: ALT, topics: [ALT_TOPIC], data: '0xabcd', transactionHash: ALT_WORD };
    return row;
}

function replacedAttributed(): AttributedAction {
    const row = attributed(12, { who: 'replacement', trace: { id: 'u', hop: 2 } });
    row.address = ALT;
    row.kind = 'guardian-removed';
    row.txHash = ALT_WORD;
    row.decoded = { kind: 'guardian-removed', detail: { slot: 19, note: 'corrected' } };
    row.log = { ...log(12), address: ALT, topics: [ALT_TOPIC], data: '0xabcd', transactionHash: ALT_WORD };
    return row;
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
    if (!sameRows(snap.unresolved, expected.unresolved) || !sameRows(snap.attributed, expected.attributed)) {
        throw new Fault('persisted rows differ');
    }
    if (!sameSnapshot(snap, expected)) throw new Fault('seed did not persist');
    return snap;
}

async function readsMatch(store: GuardianAuditStore, snap: StoreSnapshot): Promise<boolean> {
    const [checkpoint, unresolvedRows, attributedRows] = await Promise.all([
        store.getCheckpoint(), store.listUnresolved(), store.listAttributed(),
    ]);
    return same(checkpoint, snap.checkpoint) && sameRows(unresolvedRows, snap.unresolved) && sameRows(attributedRows, snap.attributed);
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
    if (!sameSnapshot(after, expected)) throw new Fault(`${form} persisted rows differ`);
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
    if (!sameSnapshot(frozen(await store.snapshot()), seeded)) throw new Fault(`${form} stale revision changed the store`);
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
    if (!sameSnapshot(after, expected)) throw new Fault(`${form} snapshot is not the winner`);
}

async function crashCell(got: StoreUnderTest, form: Form): Promise<void> {
    if (!got.crashDuringNextCommit || !got.commitSteps) throw new Skip('no fault hook');
    const steps = got.commitSteps();
    if (!Number.isSafeInteger(steps) || steps < 1) throw new Fault(`${form} commitSteps is not a positive integer`);
    const store = got.store;
    const seeded = frozen(await seed(store));
    for (let step = 0; step <= steps; step++) {
        got.crashDuringNextCommit(step);
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
        if (!sameSnapshot(frozen(await store.snapshot()), seeded)) throw new Fault(`${form} crash left a partial write`);
    }
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
    if (!sameSnapshot(frozen(await store.snapshot()), seeded)) throw new Fault(`${form} different scope changed the store`);
}

async function replacementCell(got: StoreUnderTest, form: Form): Promise<void> {
    const store = got.store;
    const seeded = await seed(store);
    const open = replacedUnresolved();
    const done = replacedAttributed();
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
    if (!sameSnapshot(after, expected)) throw new Fault(`${form} replacement payload was dropped`);
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
    if (!sameSnapshot(after, expected)) throw new Fault(`${form} replacement payload was dropped`);
}

/**
 * Mutate the commit payload as soon as the promise exists, before it is awaited,
 * then again after it settles. One cell per form.
 */
async function isolation(got: StoreUnderTest, form: Form, mode: 'apply' | 'replace'): Promise<void> {
    const store = got.store;
    const seeded = await seed(store);
    const open = mode === 'replace' ? replacedUnresolved() : unresolved(20);
    const done = mode === 'replace' ? replacedAttributed() : attributed(21);
    const next = nextOf(form);
    const change = commit({
        expectedRevision: seeded.revision,
        next,
        resolve: [unresolved(10, 'open-a').id],
        unresolved: [open],
        attributed: [done],
    });
    const canonical: StoreSnapshot = {
        revision: seeded.revision + 1,
        checkpoint: form === 'moving' ? { block: MOVED.block, hash: MOVED.hash } : { block: TIP.block, hash: TIP.hash },
        scope: SCOPE,
        unresolved: mode === 'replace' ? [replacedUnresolved()] : [unresolved(11, 'open-b'), unresolved(20)],
        attributed: mode === 'replace' ? [replacedAttributed(), attributed(13)] : [attributed(12), attributed(13), attributed(21)],
    };
    const pending = store.commit(change);
    if (change.next) change.next.block = 999;
    for (const row of change.attributed) row.kind = `${row.kind}-pending`;
    for (const row of change.unresolved) row.kind = `${row.kind}-pending`;
    await pending;
    if (!sameSnapshot(frozen(await store.snapshot()), canonical)) throw new Fault('committed input changed stored rows');
    deepMutate(change);
    const raw = await store.snapshot();
    if (!sameSnapshot(frozen(raw), canonical)) throw new Fault('committed input changed stored rows');
    const checkpoint = await store.getCheckpoint();
    const unresolvedRows = await store.listUnresolved();
    const attributedRows = await store.listAttributed();
    if (!same(frozen(checkpoint), canonical.checkpoint) || !sameRows(unresolvedRows, canonical.unresolved) || !sameRows(attributedRows, canonical.attributed)) {
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
    if (!sameSnapshot(again, canonical) || !same(frozen(checkpointAgain), canonical.checkpoint) || !sameRows(unresolvedAgain, canonical.unresolved) || !sameRows(attributedAgain, canonical.attributed)) {
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
        [`isolation/${form}`, (got) => isolation(got, form, 'apply')],
        [`isolation/replacement/${form}`, (got) => isolation(got, form, 'replace')],
    ]),
];

/** Run every store rule. One fresh store per check. Never throws. */
export async function runStoreConformance(
    make: () => Promise<StoreUnderTest> | StoreUnderTest,
): Promise<ConformanceResult[]> {
    const results: ConformanceResult[] = [];
    for (const [name, run] of CHECKS) {
        try {
            await run(await make());
            results.push(name.startsWith('crash/')
                ? { name, status: 'pass', detail: 'atomicity checked through the store\'s fault hook' }
                : { name, status: 'pass' });
        } catch (error) {
            if (error instanceof Skip) results.push({ name, status: 'skipped', detail: error.message });
            else results.push({ name, status: 'fail', detail: error instanceof Fault ? error.message : 'check failed' });
        }
    }
    return results;
}
