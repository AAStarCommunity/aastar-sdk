import { describe, expect, it } from 'vitest';
import {
    StoreConflictError,
    memoryStore,
    runStoreConformance,
    type AttributedAction,
    type Commit,
    type ConformanceResult,
    type GuardianAuditStore,
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

describe('guardian audit store conformance', () => {
    it('memoryStore passes every store conformance check', async () => {
        const results = await runStoreConformance(() => {
            const store = memoryStore({ faultHook: true });
            return { store, crashNextCommit: store.crashNextCommit };
        });
        expect(results.map((item) => item.status)).toEqual(results.map(() => 'pass'));
        expect(results.map((item) => item.name)).toEqual([
            'empty snapshot',
            'commit applies the whole change and bumps the revision',
            'stale revision changes nothing',
            'one of two concurrent commits wins',
            'crash between write and commit',
            'scope is recorded and a different scope is refused',
            're-committing the same ids does not duplicate rows',
            'callers cannot mutate stored rows',
        ]);
        expect(results.every((item) => item.detail === undefined)).toBe(true);
    });

    it('a store with no fault hook skips the crash check', async () => {
        const results = await runStoreConformance(() => ({ store: memoryStore() }));
        expect(byName(results, 'crash between write and commit')).toEqual({
            name: 'crash between write and commit',
            status: 'skipped',
            detail: 'no fault hook',
        });
        expect(results.filter((item) => item.name !== 'crash between write and commit').every((item) => item.status === 'pass')).toBe(true);
    });

    it('ignoreRevision fails stale revision changes nothing', async () => {
        const results = await runStoreConformance(ignoreRevision);
        onlyFails(results, 'stale revision changes nothing', 'stale revision was accepted');
        expect(byName(results, 'crash between write and commit')).toEqual({
            name: 'crash between write and commit',
            status: 'skipped',
            detail: 'no fault hook',
        });
    });

    it('partialCrash fails crash between write and commit', async () => {
        const results = await runStoreConformance(partialCrash);
        onlyFails(results, 'crash between write and commit', 'crash left a partial write');
        expect(byName(results, 'crash between write and commit').detail).not.toMatch(/disk\.example|user:pw|https:/);
    });

    it('ignoreCaughtUpRevision fails the caught-up stale and concurrent checks', async () => {
        const results = await runStoreConformance(ignoreCaughtUpRevision);
        fails(results, 'stale revision changes nothing', 'caught-up stale revision was accepted');
        fails(results, 'one of two concurrent commits wins', 'caught-up commits did not split one and one');
        const failed = results.filter((item) => item.status === 'fail').map((item) => item.name);
        expect(failed).toEqual([
            'stale revision changes nothing',
            'one of two concurrent commits wins',
        ]);
    });

    it('crashResolvesEarly fails crash between write and commit', async () => {
        const results = await runStoreConformance(crashResolvesEarly);
        onlyFails(results, 'crash between write and commit', 'crash left a partial write');
        expect(byName(results, 'crash between write and commit').detail).not.toMatch(/disk\.example|user:pw|https:/);
    });

    it('silentScopeMismatch fails scope is recorded and a different scope is refused', async () => {
        const results = await runStoreConformance(silentScopeMismatch);
        onlyFails(results, 'scope is recorded and a different scope is refused', 'different scope was accepted');
    });

    it('dropAttribution fails commit applies the whole change and bumps the revision', async () => {
        const results = await runStoreConformance(dropAttribution);
        fails(results, 'commit applies the whole change and bumps the revision', 'persisted rows differ');
    });

    it('insertOnly fails re-committing the same ids does not duplicate rows', async () => {
        const results = await runStoreConformance(insertOnly);
        onlyFails(results, 're-committing the same ids does not duplicate rows', 'replacement payload was dropped');
    });

    it('emptyGetters fails callers cannot mutate stored rows', async () => {
        const results = await runStoreConformance(emptyGetters);
        onlyFails(results, 'callers cannot mutate stored rows', 'public reads disagree with the snapshot');
    });

    it('liveAttributed fails callers cannot mutate stored rows', async () => {
        const results = await runStoreConformance(liveAttributed);
        onlyFails(results, 'callers cannot mutate stored rows', 'stored rows changed after mutation');
    });
});
