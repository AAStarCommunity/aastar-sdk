import { describe, expect, it } from 'vitest';
import {
    StoreConflictError,
    memoryStore,
    runStoreConformance,
    type AttributedAction,
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

function onlyFails(results: ConformanceResult[], name: string, detail: string): void {
    fails(results, name, detail);
    expect(results.filter((item) => item.status === 'fail').map((item) => item.name)).toEqual([name]);
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
    let crash = false;
    const store: GuardianAuditStore = {
        snapshot: () => inner.snapshot(),
        getCheckpoint: () => inner.getCheckpoint(),
        listUnresolved: () => inner.listUnresolved(),
        listAttributed: () => inner.listAttributed(),
        commit: async (change) => {
            if (!crash) {
                await inner.commit(change);
                return;
            }
            crash = false;
            const partial: Commit = { ...change, attributed: [], unresolved: [], resolve: [] };
            await inner.commit(partial);
            throw new Error('https://user:pw@disk.example/partial');
        },
    };
    return { store, crashNextCommit: () => { crash = true; } };
}

/** Applies `resolve` to the live rows, then throws, leaving revision and attribution untouched. */
function crashResolvesEarly(): StoreUnderTest {
    const inner = memoryStore();
    let crash = false;
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
            if (!crash) {
                dropped = null;
                await inner.commit(change);
                return;
            }
            crash = false;
            dropped = new Set(change.resolve.map((id) => id.toLowerCase()));
            throw new Error('https://user:pw@disk.example/resolve');
        },
    };
    return { store, crashNextCommit: () => { crash = true; } };
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
    let crash = false;
    const store: GuardianAuditStore = {
        snapshot: () => inner.snapshot(),
        getCheckpoint: () => inner.getCheckpoint(),
        listUnresolved: () => inner.listUnresolved(),
        listAttributed: () => inner.listAttributed(),
        commit: async (change) => {
            if (!crash) {
                await inner.commit(change);
                return;
            }
            crash = false;
            if (change.next !== null) {
                const partial: Commit = { ...change, unresolved: [], attributed: [], resolve: [] };
                await inner.commit(partial);
            }
            throw new Error('https://user:pw@disk.example/moving');
        },
    };
    return { store, crashNextCommit: () => { crash = true; } };
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
    let crash = false;
    let cached: StoreSnapshot | null = null;
    const refresh = async () => { cached = await inner.snapshot(); };
    const live = async () => {
        if (!cached) await refresh();
        return cached!;
    };
    const store: GuardianAuditStore = {
        async snapshot() {
            if (defect === 'shallow-share snapshot') {
                if (!cached) await refresh();
                return cached!;
            }
            return inner.snapshot();
        },
        async getCheckpoint() {
            if (defect === 'shallow-share getter') return (await live()).checkpoint;
            return inner.getCheckpoint();
        },
        async listUnresolved() {
            if (defect === 'shallow-share getter') return (await live()).unresolved;
            return inner.listUnresolved();
        },
        async listAttributed() {
            if (defect === 'shallow-share getter') return (await live()).attributed;
            return inner.listAttributed();
        },
        commit: async (change) => {
            const hit = targets(form, change);
            if (defect === 'skip CAS' && hit) {
                const snap = await inner.snapshot();
                await inner.commit({ ...change, expectedRevision: snap.revision });
                return;
            }
            if (defect === 'partial write before crash' && crash) {
                crash = false;
                if (hit) {
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
            if (defect === 'shallow-share snapshot' || defect === 'shallow-share getter') await refresh();
        },
    };
    const under: StoreUnderTest = { store };
    if (defect === 'partial write before crash') under.crashNextCommit = () => { crash = true; };
    return under;
}

describe('guardian audit store conformance', () => {
    it('memoryStore passes every store conformance check', async () => {
        const results = await runStoreConformance(() => {
            const store = memoryStore({ faultHook: true });
            return { store, crashNextCommit: store.crashNextCommit };
        });
        expect(results.map((item) => item.status)).toEqual(results.map(() => 'pass'));
        expect(results.map((item) => item.name)).toEqual([
            'empty snapshot',
            'commit/moving', 'stale/moving', 'concurrent/moving', 'crash/moving', 'scope/moving', 'replacement/moving', 'idempotence/moving',
            'commit/caught-up', 'stale/caught-up', 'concurrent/caught-up', 'crash/caught-up', 'scope/caught-up', 'replacement/caught-up', 'idempotence/caught-up',
            'isolation',
        ]);
        expect(results.every((item) => item.detail === undefined)).toBe(true);
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
        expect(results.filter((item) => item.status === 'fail').map((item) => item.name)).toEqual([
            'stale/moving', 'stale/caught-up',
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
        expect(results.filter((item) => item.status === 'fail').map((item) => item.name)).toEqual([
            'stale/caught-up', 'concurrent/caught-up',
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
        expect(results.filter((item) => item.status === 'fail').map((item) => item.name)).toEqual([
            'scope/moving', 'scope/caught-up',
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
        onlyFails(results, 'isolation', 'public reads disagree with the snapshot');
    });

    it('liveAttributed fails isolation', async () => {
        const results = await runStoreConformance(liveAttributed);
        onlyFails(results, 'isolation', 'stored rows changed after mutation');
    });

    it('crashMovingPersistsCheckpoint fails crash/moving', async () => {
        const results = await runStoreConformance(crashMovingPersistsCheckpoint);
        fails(results, 'crash/moving', 'moving crash left a partial write');
        expect(byName(results, 'crash/moving').detail).not.toMatch(/disk\.example|user:pw|https:/);
        expect(byName(results, 'crash/caught-up').status).toBe('pass');
    });

    it('liveSnapshot fails isolation', async () => {
        const results = await runStoreConformance(liveSnapshot);
        onlyFails(results, 'isolation', 'stored rows changed after mutation');
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
});
