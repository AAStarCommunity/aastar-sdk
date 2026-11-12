import { describe, expect, it } from 'vitest';
import {
    memoryStore,
    runStoreConformance,
    type Commit,
    type GuardianAuditStore,
    type StoreUnderTest,
} from '../../src/guardianAudit';

function byName(results: { name: string; status: string; detail?: string }[], name: string) {
    const found = results.find((item) => item.name === name);
    if (!found) throw new Error(`missing check ${name}`);
    return found;
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

    it('a store that ignores expectedRevision fails the stale-revision check', async () => {
        const results = await runStoreConformance(ignoreRevision);
        expect(byName(results, 'stale revision changes nothing')).toMatchObject({
            status: 'fail',
            detail: 'stale revision was accepted',
        });
        expect(byName(results, 'crash between write and commit')).toEqual({
            name: 'crash between write and commit',
            status: 'skipped',
            detail: 'no fault hook',
        });
        expect(results.filter((item) => item.status === 'fail').map((item) => item.name)).toEqual([
            'stale revision changes nothing',
        ]);
    });

    it('a store that publishes before a crash fails the crash check', async () => {
        const results = await runStoreConformance(partialCrash);
        const crash = byName(results, 'crash between write and commit');
        expect(crash.status).toBe('fail');
        expect(crash.detail).toBe('crash left a partial write');
        expect(crash.detail).not.toMatch(/disk\.example|user:pw|https:/);
        expect(results.filter((item) => item.name !== 'crash between write and commit').every((item) => item.status === 'pass')).toBe(true);
    });
});
