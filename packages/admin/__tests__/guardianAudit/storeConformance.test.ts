import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';
import {
    ScopeChangedError,
    StoreConflictError,
    memoryStore,
    runStoreConformance,
    type AttributedAction,
    type Checkpoint,
    type Commit,
    type ConformanceResult,
    type GuardianAuditStore,
    type StoreSnapshot,
    type StoreUnderTest,
    type UnresolvedAction,
} from '../../src/guardianAudit';

function byName(results: ConformanceResult[], name: string): ConformanceResult {
    const found = results.find((item) => item.name === name);
    if (!found) throw new Error(`missing check ${name}`);
    return found;
}

function fails(results: ConformanceResult[], name: string, detail: string): void {
    expect(results.some((item) => item.status === 'fail')).toBe(true);
    expect(byName(results, name)).toMatchObject({ status: 'fail', detail });
}

const ISOLATION = [
    'isolation/moving', 'isolation/replacement/moving', 'isolation/caught-up', 'isolation/replacement/caught-up',
];

function failsEach(results: ConformanceResult[], names: string[], detail: string): void {
    expect(results.filter((item) => item.status === 'fail').map((item) => item.name)).toEqual(names);
    for (const name of names) fails(results, name, detail);
}

/** Accepts any expectedRevision by rewriting it to the live one. No fault hook. */
function ignoreRevision(): StoreUnderTest {
    const inner = memoryStore();
    const store: GuardianAuditStore = {
        snapshot: () => inner.snapshot(),
        getCheckpoint: () => inner.getCheckpoint(),
        listUnresolved: () => inner.listUnresolved(),
        listAttributed: () => inner.listAttributed(),
        commit: async (change) => {
            const snap = await inner.snapshot();
            await inner.commit({ ...change, expectedRevision: snap.revision });
        },
    };
    return { store };
}

/** Caught-up commits (`next: null`) retry until they land, ignoring the caller's revision. */
function ignoreCaughtUpRevision(): StoreUnderTest {
    const inner = memoryStore();
    const store: GuardianAuditStore = {
        snapshot: () => inner.snapshot(),
        getCheckpoint: () => inner.getCheckpoint(),
        listUnresolved: () => inner.listUnresolved(),
        listAttributed: () => inner.listAttributed(),
        commit: async (change) => {
            if (change.next !== null) {
                await inner.commit(change);
                return;
            }
            for (let attempt = 0; attempt < 5; attempt++) {
                const snap = await inner.snapshot();
                try {
                    await inner.commit({ ...change, expectedRevision: snap.revision });
                    return;
                } catch (error) {
                    if (!(error instanceof StoreConflictError)) throw error;
                }
            }
            throw new Error('retry gave up');
        },
    };
    return { store };
}

/**
 * Writes the checkpoint and drops the rows, then throws an error whose text
 * holds an endpoint. The other checks delegate to memoryStore.
 */
function partialCrash(): StoreUnderTest {
    const inner = memoryStore();
    let crashAt: number | null = null;
    const store: GuardianAuditStore = {
        snapshot: () => inner.snapshot(),
        getCheckpoint: () => inner.getCheckpoint(),
        listUnresolved: () => inner.listUnresolved(),
        listAttributed: () => inner.listAttributed(),
        commit: async (change) => {
            const step = crashAt;
            crashAt = null;
            if (step === null) {
                await inner.commit(change);
                return;
            }
            if (step >= 1) {
                const partial: Commit = { ...change, attributed: [], unresolved: [], resolve: [] };
                await inner.commit(partial);
            }
            throw new Error('https://user:pw@disk.example/partial');
        },
    };
    return { store, commitSteps: () => 1, crashDuringNextCommit: (step) => { crashAt = step; } };
}

/** Applies `resolve` to the live rows, then throws, leaving revision and attribution untouched. */
function crashResolvesEarly(): StoreUnderTest {
    const inner = memoryStore();
    let crashAt: number | null = null;
    let dropped: Set<string> | null = null;
    const hide = (rows: UnresolvedAction[]) => (dropped ? rows.filter((row) => !dropped!.has(row.id)) : rows);
    const store: GuardianAuditStore = {
        async snapshot() {
            const snap = await inner.snapshot();
            snap.unresolved = hide(snap.unresolved);
            return snap;
        },
        getCheckpoint: () => inner.getCheckpoint(),
        listUnresolved: async () => hide(await inner.listUnresolved()),
        listAttributed: () => inner.listAttributed(),
        commit: async (change) => {
            const step = crashAt;
            crashAt = null;
            if (step === null) {
                dropped = null;
                await inner.commit(change);
                return;
            }
            if (step >= 1) dropped = new Set(change.resolve.map((id) => id.toLowerCase()));
            throw new Error('https://user:pw@disk.example/resolve');
        },
    };
    return { store, commitSteps: () => 1, crashDuringNextCommit: (step) => { crashAt = step; } };
}

/** A different scope returns success and writes nothing. */
function silentScopeMismatch(): StoreUnderTest {
    const inner = memoryStore();
    const store: GuardianAuditStore = {
        snapshot: () => inner.snapshot(),
        getCheckpoint: () => inner.getCheckpoint(),
        listUnresolved: () => inner.listUnresolved(),
        listAttributed: () => inner.listAttributed(),
        commit: async (change) => {
            const snap = await inner.snapshot();
            if (snap.scope !== null && change.scope.toLowerCase() !== snap.scope.toLowerCase()) return;
            await inner.commit(change);
        },
    };
    return { store };
}

/** Keeps every field except `attribution`. */
function dropAttribution(): StoreUnderTest {
    const inner = memoryStore();
    const store: GuardianAuditStore = {
        snapshot: () => inner.snapshot(),
        getCheckpoint: () => inner.getCheckpoint(),
        listUnresolved: () => inner.listUnresolved(),
        listAttributed: () => inner.listAttributed(),
        commit: async (change) => {
            await inner.commit({
                ...change,
                attributed: change.attributed.map((row) => ({ ...row, attribution: null })),
            });
        },
    };
    return { store };
}

/** Inserts a new id and ignores a later payload for an id it already has. */
function insertOnly(): StoreUnderTest {
    const inner = memoryStore();
    const store: GuardianAuditStore = {
        snapshot: () => inner.snapshot(),
        getCheckpoint: () => inner.getCheckpoint(),
        listUnresolved: () => inner.listUnresolved(),
        listAttributed: () => inner.listAttributed(),
        commit: async (change) => {
            const snap = await inner.snapshot();
            const openIds = new Set(snap.unresolved.map((row) => row.id));
            const doneIds = new Set(snap.attributed.map((row) => row.id));
            await inner.commit({
                ...change,
                unresolved: change.unresolved.filter((row) => !openIds.has(row.id.toLowerCase())),
                attributed: change.attributed.filter((row) => !doneIds.has(row.id.toLowerCase())),
            });
        },
    };
    return { store };
}

/** snapshot() is honest. The three public getters are empty. */
function emptyGetters(): StoreUnderTest {
    const inner = memoryStore();
    const store: GuardianAuditStore = {
        snapshot: () => inner.snapshot(),
        getCheckpoint: async () => null,
        listUnresolved: async () => [],
        listAttributed: async () => [],
        commit: (change) => inner.commit(change),
    };
    return { store };
}

/**
 * Checkpoint and unresolved rows are copies. Attributed rows handed out by
 * snapshot() and listAttributed() are the stored objects.
 */
function liveAttributed(): StoreUnderTest {
    const inner = memoryStore();
    let published: AttributedAction[] = [];
    const store: GuardianAuditStore = {
        async snapshot() {
            const snap = await inner.snapshot();
            snap.attributed = published;
            return snap;
        },
        getCheckpoint: () => inner.getCheckpoint(),
        listUnresolved: () => inner.listUnresolved(),
        async listAttributed() { return published; },
        async commit(change) {
            await inner.commit(change);
            published = await inner.listAttributed();
        },
    };
    return { store };
}

/** Rolls back a caught-up crash, but saves the checkpoint of a moving crash. */
function crashMovingPersistsCheckpoint(): StoreUnderTest {
    const inner = memoryStore();
    let crashAt: number | null = null;
    const store: GuardianAuditStore = {
        snapshot: () => inner.snapshot(),
        getCheckpoint: () => inner.getCheckpoint(),
        listUnresolved: () => inner.listUnresolved(),
        listAttributed: () => inner.listAttributed(),
        commit: async (change) => {
            const step = crashAt;
            crashAt = null;
            if (step === null) {
                await inner.commit(change);
                return;
            }
            if (change.next !== null && step >= 1) {
                const partial: Commit = { ...change, unresolved: [], attributed: [], resolve: [] };
                await inner.commit(partial);
            }
            throw new Error('https://user:pw@disk.example/moving');
        },
    };
    return { store, commitSteps: () => 1, crashDuringNextCommit: (step) => { crashAt = step; } };
}

/** snapshot() returns one live object. Getters return clones. */
function liveSnapshot(): StoreUnderTest {
    const inner = memoryStore();
    let cached: StoreSnapshot | null = null;
    const store: GuardianAuditStore = {
        async snapshot() {
            if (!cached) cached = await inner.snapshot();
            return cached;
        },
        getCheckpoint: () => inner.getCheckpoint(),
        listUnresolved: () => inner.listUnresolved(),
        listAttributed: () => inner.listAttributed(),
        async commit(change) {
            await inner.commit(change);
            cached = await inner.snapshot();
        },
    };
    return { store };
}

/** Existing ids keep every field except reason and attribution. */
function shallowReplace(): StoreUnderTest {
    const inner = memoryStore();
    const store: GuardianAuditStore = {
        snapshot: () => inner.snapshot(),
        getCheckpoint: () => inner.getCheckpoint(),
        listUnresolved: () => inner.listUnresolved(),
        listAttributed: () => inner.listAttributed(),
        commit: async (change) => {
            const snap = await inner.snapshot();
            const open = new Map(snap.unresolved.map((row) => [row.id, row]));
            const done = new Map(snap.attributed.map((row) => [row.id, row]));
            await inner.commit({
                ...change,
                unresolved: change.unresolved.map((row) => {
                    const prior = open.get(row.id.toLowerCase());
                    return prior ? { ...prior, reason: row.reason } : row;
                }),
                attributed: change.attributed.map((row) => {
                    const prior = done.get(row.id.toLowerCase());
                    return prior ? { ...prior, attribution: row.attribution } : row;
                }),
            });
        },
    };
    return { store };
}

/** A different scope is refused only when the checkpoint moves. */
function scopeOnlyWhenMoving(): StoreUnderTest {
    const inner = memoryStore();
    const store: GuardianAuditStore = {
        snapshot: () => inner.snapshot(),
        getCheckpoint: () => inner.getCheckpoint(),
        listUnresolved: () => inner.listUnresolved(),
        listAttributed: () => inner.listAttributed(),
        commit: async (change) => {
            const snap = await inner.snapshot();
            const differs = snap.scope !== null && change.scope.toLowerCase() !== snap.scope.toLowerCase();
            if (differs && change.next === null) {
                await inner.commit({ ...change, scope: snap.scope ?? change.scope });
                return;
            }
            await inner.commit(change);
        },
    };
    return { store };
}

type DefectForm = 'moving' | 'caught-up';
type Defect = 'skip CAS' | 'partial write before crash' | 'ignore scope' | 'insert-only' | 'shallow-share snapshot' | 'shallow-share getter';

function targets(form: DefectForm, change: Commit): boolean {
    return (form === 'moving') === (change.next !== null);
}

/** One defect, applied only to commits of `form`, wrapped around memoryStore. */
function generatedDefect(form: DefectForm, defect: Defect): StoreUnderTest {
    const inner = memoryStore();
    let crashAt: number | null = null;
    let cached: StoreSnapshot | null = null;
    const store: GuardianAuditStore = {
        async snapshot() {
            if (defect === 'shallow-share snapshot' && cached) return cached;
            return inner.snapshot();
        },
        async getCheckpoint() {
            if (defect === 'shallow-share getter' && cached) return cached.checkpoint;
            return inner.getCheckpoint();
        },
        async listUnresolved() {
            if (defect === 'shallow-share getter' && cached) return cached.unresolved;
            return inner.listUnresolved();
        },
        async listAttributed() {
            if (defect === 'shallow-share getter' && cached) return cached.attributed;
            return inner.listAttributed();
        },
        commit: async (change) => {
            const hit = targets(form, change);
            if (defect === 'skip CAS' && hit) {
                const snap = await inner.snapshot();
                await inner.commit({ ...change, expectedRevision: snap.revision });
                return;
            }
            if (defect === 'partial write before crash' && crashAt !== null) {
                const step = crashAt;
                crashAt = null;
                if (step >= 1 && hit) {
                    const partial: Commit = { ...change, unresolved: [], attributed: [], resolve: [] };
                    await inner.commit(partial);
                }
                throw new Error('partial');
            }
            if (defect === 'ignore scope' && hit) {
                const snap = await inner.snapshot();
                const differs = snap.scope !== null && change.scope.toLowerCase() !== snap.scope.toLowerCase();
                await inner.commit(differs ? { ...change, scope: snap.scope ?? change.scope } : change);
                return;
            }
            if (defect === 'insert-only' && hit) {
                const snap = await inner.snapshot();
                const openIds = new Set(snap.unresolved.map((row) => row.id));
                const doneIds = new Set(snap.attributed.map((row) => row.id));
                await inner.commit({
                    ...change,
                    unresolved: change.unresolved.filter((row) => !openIds.has(row.id.toLowerCase())),
                    attributed: change.attributed.filter((row) => !doneIds.has(row.id.toLowerCase())),
                });
                return;
            }
            await inner.commit(change);
            if (defect === 'shallow-share snapshot' || defect === 'shallow-share getter') {
                cached = hit ? await inner.snapshot() : null;
            }
        },
    };
    const under: StoreUnderTest = { store };
    if (defect === 'partial write before crash') {
        under.commitSteps = () => 1;
        under.crashDuringNextCommit = (step) => { crashAt = step; };
    }
    return under;
}

/**
 * Checkpoint and revision are published, then an await, then the rows.
 * commitSteps is 2. Crashing after the first write leaves the cursor moved.
 */
function nonAtomicCheckpointThenRows(): StoreUnderTest {
    let revision = 0;
    let scope: Hex | null = null;
    let checkpoint: Checkpoint | null = null;
    let open = new Map<string, UnresolvedAction>();
    let attributed = new Map<string, AttributedAction>();
    let crashAt: number | null = null;
    const copy = <T>(value: T): T => structuredClone(value);
    const snap = (): StoreSnapshot => ({
        revision,
        checkpoint: checkpoint ? copy(checkpoint) : null,
        scope,
        unresolved: [...open.values()].map((item) => copy(item)),
        attributed: [...attributed.values()].map((item) => copy(item)),
    });
    const store: GuardianAuditStore = {
        async snapshot() { return snap(); },
        async getCheckpoint() { return checkpoint ? copy(checkpoint) : null; },
        async listUnresolved() { return [...open.values()].map((item) => copy(item)); },
        async listAttributed() { return [...attributed.values()].map((item) => copy(item)); },
        async commit(change) {
            if (change.expectedRevision !== revision) throw new StoreConflictError();
            const nextScope = change.scope.toLowerCase() as Hex;
            if (scope !== null && nextScope !== scope) throw new ScopeChangedError();
            const step = crashAt;
            crashAt = null;
            const stop = (done: number) => step !== null && done >= step;
            if (stop(0)) throw new Error('crash before write');
            if (change.next) checkpoint = { block: change.next.block, hash: change.next.hash };
            scope = nextScope;
            revision++;
            if (stop(1)) throw new Error('crash after checkpoint');
            await Promise.resolve();
            for (const item of change.attributed) attributed.set(item.id.toLowerCase(), copy({ ...item, id: item.id.toLowerCase() }));
            for (const item of change.unresolved) open.set(item.id.toLowerCase(), copy({ ...item, id: item.id.toLowerCase() }));
            for (const id of change.resolve) open.delete(id.toLowerCase());
            if (stop(2)) throw new Error('crash after rows');
        },
    };
    return { store, commitSteps: () => 2, crashDuringNextCommit: (step) => { crashAt = step; } };
}

describe('guardian audit store conformance', () => {
    it('memoryStore passes every store conformance check', async () => {
        const results = await runStoreConformance(() => {
            const store = memoryStore({ faultHook: true });
            return { store, crashDuringNextCommit: store.crashDuringNextCommit, commitSteps: store.commitSteps };
        });
        expect(results.map((item) => item.status)).toEqual(results.map(() => 'pass'));
        expect(results.map((item) => item.name)).toEqual([
            'empty snapshot',
            'commit/moving', 'stale/moving', 'concurrent/moving', 'crash/moving', 'scope/moving', 'replacement/moving', 'idempotence/moving',
            'isolation/moving', 'isolation/replacement/moving',
            'commit/caught-up', 'stale/caught-up', 'concurrent/caught-up', 'crash/caught-up', 'scope/caught-up', 'replacement/caught-up', 'idempotence/caught-up',
            'isolation/caught-up', 'isolation/replacement/caught-up',
        ]);
        expect(results.filter((item) => !item.name.startsWith('crash/')).every((item) => item.detail === undefined)).toBe(true);
        expect(byName(results, 'crash/moving').detail).toBe('atomicity checked through the store\'s fault hook');
        expect(byName(results, 'crash/caught-up').detail).toBe('atomicity checked through the store\'s fault hook');
    });

    it('a non-atomic store that writes the checkpoint before the rows fails both crash checks', async () => {
        const results = await runStoreConformance(nonAtomicCheckpointThenRows);
        fails(results, 'crash/moving', 'moving crash left a partial write');
        fails(results, 'crash/caught-up', 'caught-up crash left a partial write');
    });

    it('a store with no fault hook skips both crash checks', async () => {
        const results = await runStoreConformance(() => ({ store: memoryStore() }));
        for (const name of ['crash/moving', 'crash/caught-up']) {
            expect(byName(results, name)).toEqual({ name, status: 'skipped', detail: 'no fault hook' });
        }
        expect(results.filter((item) => !item.name.startsWith('crash/')).every((item) => item.status === 'pass')).toBe(true);
    });

    it('ignoreRevision fails stale/moving and stale/caught-up', async () => {
        const results = await runStoreConformance(ignoreRevision);
        fails(results, 'stale/moving', 'moving stale revision was accepted');
        fails(results, 'stale/caught-up', 'caught-up stale revision was accepted');
        for (const name of ISOLATION) fails(results, name, 'committed input changed stored rows');
        expect(results.filter((item) => item.status === 'fail').map((item) => item.name)).toEqual([
            'stale/moving', 'isolation/moving', 'isolation/replacement/moving',
            'stale/caught-up', 'isolation/caught-up', 'isolation/replacement/caught-up',
        ]);
    });

    it('partialCrash fails crash/moving and crash/caught-up', async () => {
        const results = await runStoreConformance(partialCrash);
        fails(results, 'crash/moving', 'moving crash left a partial write');
        fails(results, 'crash/caught-up', 'caught-up crash left a partial write');
        expect(byName(results, 'crash/moving').detail).not.toMatch(/disk\.example|user:pw|https:/);
        expect(results.filter((item) => item.status === 'fail').map((item) => item.name)).toEqual([
            'crash/moving', 'crash/caught-up',
        ]);
    });

    it('ignoreCaughtUpRevision fails the caught-up stale and concurrent checks', async () => {
        const results = await runStoreConformance(ignoreCaughtUpRevision);
        fails(results, 'stale/caught-up', 'caught-up stale revision was accepted');
        fails(results, 'concurrent/caught-up', 'caught-up commits did not split one and one');
        for (const name of ['isolation/caught-up', 'isolation/replacement/caught-up']) {
            fails(results, name, 'committed input changed stored rows');
        }
        expect(results.filter((item) => item.status === 'fail').map((item) => item.name)).toEqual([
            'stale/caught-up', 'concurrent/caught-up', 'isolation/caught-up', 'isolation/replacement/caught-up',
        ]);
    });

    it('crashResolvesEarly fails crash/moving and crash/caught-up', async () => {
        const results = await runStoreConformance(crashResolvesEarly);
        fails(results, 'crash/moving', 'moving crash left a partial write');
        fails(results, 'crash/caught-up', 'caught-up crash left a partial write');
        expect(byName(results, 'crash/moving').detail).not.toMatch(/disk\.example|user:pw|https:/);
    });

    it('silentScopeMismatch fails scope/moving and scope/caught-up', async () => {
        const results = await runStoreConformance(silentScopeMismatch);
        fails(results, 'scope/moving', 'moving different scope was accepted');
        fails(results, 'scope/caught-up', 'caught-up different scope was accepted');
        for (const name of ISOLATION) fails(results, name, 'committed input changed stored rows');
        expect(results.filter((item) => item.status === 'fail').map((item) => item.name)).toEqual([
            'scope/moving', 'isolation/moving', 'isolation/replacement/moving',
            'scope/caught-up', 'isolation/caught-up', 'isolation/replacement/caught-up',
        ]);
    });

    it('dropAttribution fails commit/moving', async () => {
        const results = await runStoreConformance(dropAttribution);
        fails(results, 'commit/moving', 'persisted rows differ');
        fails(results, 'commit/caught-up', 'persisted rows differ');
    });

    it('insertOnly fails replacement/moving and replacement/caught-up', async () => {
        const results = await runStoreConformance(insertOnly);
        fails(results, 'replacement/moving', 'moving replacement payload was dropped');
        fails(results, 'replacement/caught-up', 'caught-up replacement payload was dropped');
    });

    it('emptyGetters fails isolation', async () => {
        const results = await runStoreConformance(emptyGetters);
        failsEach(results, ISOLATION, 'public reads disagree with the snapshot');
    });

    it('liveAttributed fails isolation', async () => {
        const results = await runStoreConformance(liveAttributed);
        failsEach(results, ISOLATION, 'stored rows changed after mutation');
    });

    it('crashMovingPersistsCheckpoint fails crash/moving', async () => {
        const results = await runStoreConformance(crashMovingPersistsCheckpoint);
        fails(results, 'crash/moving', 'moving crash left a partial write');
        expect(byName(results, 'crash/moving').detail).not.toMatch(/disk\.example|user:pw|https:/);
        expect(byName(results, 'crash/caught-up').status).toBe('pass');
    });

    it('liveSnapshot fails isolation', async () => {
        const results = await runStoreConformance(liveSnapshot);
        failsEach(results, ISOLATION, 'stored rows changed after mutation');
    });

    it('shallowReplace fails replacement/moving and replacement/caught-up', async () => {
        const results = await runStoreConformance(shallowReplace);
        fails(results, 'replacement/moving', 'moving replacement payload was dropped');
        fails(results, 'replacement/caught-up', 'caught-up replacement payload was dropped');
    });

    it('scopeOnlyWhenMoving fails scope/caught-up', async () => {
        const results = await runStoreConformance(scopeOnlyWhenMoving);
        fails(results, 'scope/caught-up', 'caught-up different scope was accepted');
        expect(byName(results, 'scope/moving').status).toBe('pass');
    });

    it('each generated defect fails at least one check', async () => {
        const forms: DefectForm[] = ['moving', 'caught-up'];
        const defects: Defect[] = [
            'skip CAS', 'partial write before crash', 'ignore scope', 'insert-only',
            'shallow-share snapshot', 'shallow-share getter',
        ];
        for (const form of forms) {
            for (const defect of defects) {
                const results = await runStoreConformance(() => generatedDefect(form, defect));
                const failed = results.filter((item) => item.status === 'fail');
                expect(failed.length, `${defect}/${form}`).toBeGreaterThan(0);
            }
        }
    });

    it('detects snapshot sharing activated only by caught-up commits', async () => {
        const results = await runStoreConformance(() => {
            const inner = memoryStore({ faultHook: true });
            let live: StoreSnapshot | null = null;
            return {
                crashDuringNextCommit: inner.crashDuringNextCommit,
                commitSteps: inner.commitSteps,
                store: {
                    ...inner,
                    snapshot: async () => live ?? inner.snapshot(),
                    async commit(change: Commit) {
                        await inner.commit(change);
                        live = change.next === null ? await inner.snapshot() : null;
                    },
                },
            };
        });
        expect(results.some((result) => result.status === 'fail')).toBe(true);
        fails(results, 'isolation/caught-up', 'stored rows changed after mutation');
        expect(byName(results, 'isolation/moving').status).toBe('pass');
    });

    it('accepts a store that rejects invalid addresses', async () => {
        const word = (value: unknown) => typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value);
        const addr = (value: unknown) => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
        const data = (value: unknown) => typeof value === 'string' && /^0x[0-9a-fA-F]*$/.test(value) && value.length % 2 === 0;
        const check = (row: { address: string; blockHash: string; txHash: string; log: { address: string; data: string; blockHash: string; transactionHash: string; topics: string[] } }) => {
            if (!addr(row.address) || !word(row.blockHash) || !word(row.txHash)) throw new Error('invalid address');
            if (!addr(row.log.address) || !data(row.log.data) || !word(row.log.blockHash) || !word(row.log.transactionHash)) throw new Error('invalid address');
            if (row.log.topics.some((topic) => !word(topic))) throw new Error('invalid address');
        };
        const results = await runStoreConformance(() => {
            const inner = memoryStore({ faultHook: true });
            return {
                crashDuringNextCommit: inner.crashDuringNextCommit,
                commitSteps: inner.commitSteps,
                store: {
                    ...inner,
                    commit: async (change) => {
                        change.unresolved.forEach(check);
                        change.attributed.forEach(check);
                        await inner.commit(change);
                    },
                },
            };
        });
        expect(results.every((item) => item.status === 'pass')).toBe(true);
    });

    it('accepts a store that returns rows in reverse id order', async () => {
        const results = await runStoreConformance(() => {
            const inner = memoryStore({ faultHook: true });
            const flip = async () => {
                const snap = await inner.snapshot();
                snap.unresolved.reverse();
                snap.attributed.reverse();
                return snap;
            };
            return {
                crashDuringNextCommit: inner.crashDuringNextCommit,
                commitSteps: inner.commitSteps,
                store: {
                    ...inner,
                    snapshot: flip,
                    listUnresolved: async () => (await inner.listUnresolved()).reverse(),
                    listAttributed: async () => (await inner.listAttributed()).reverse(),
                },
            };
        });
        expect(results.every((item) => item.status === 'pass')).toBe(true);
    });

    it('fails isolation when commit copies the payload only after its first await', async () => {
        const results = await runStoreConformance(() => {
            const inner = memoryStore();
            const store: GuardianAuditStore = {
                snapshot: () => inner.snapshot(),
                getCheckpoint: () => inner.getCheckpoint(),
                listUnresolved: () => inner.listUnresolved(),
                listAttributed: () => inner.listAttributed(),
                async commit(change) {
                    await Promise.resolve();
                    await inner.commit(change);
                },
            };
            return { store };
        });
        failsEach(results, ISOLATION, 'committed input changed stored rows');
    });
});
