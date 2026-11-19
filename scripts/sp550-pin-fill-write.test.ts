import { describe, it, expect, vi } from 'vitest';
// The rollback mechanics of writeAll, with the FU-124 gate mocked OPEN in this file only (vi.mock is per test file;
// no exported bypass exists). The closed-gate refusal is tested in sp550-pin-fill-core.test.ts.
vi.mock('../packages/core/src/sp550CutoverGate.js', async (orig) => ({ ...(await orig<any>()), sp550WiringAllowListReady: () => true }));
import { writeAll, type WriteIo } from './sp550-pin-fill-core.js';

const SPAWN_VERDICT_TIMEOUT_MS = 30_000;
describe('writeAll: all or nothing, never clobbering another writer', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    const memIo = (files: Record<string, string>, fail: Partial<Record<'rename' | 'read' | 'write', (p: string) => boolean>> = {}): WriteIo & { files: Record<string, string> } => ({
        files,
        read: (p) => { if (fail.read?.(p)) throw new Error(`ENOENT ${p}`); if (!(p in files)) throw new Error(`ENOENT ${p}`); return files[p]; },
        write: (p, v) => { if (fail.write?.(p)) throw new Error(`EACCES ${p}`); files[p] = v; },
        rename: (a, b) => { if (fail.rename?.(b)) throw new Error(`EACCES ${b}`); files[b] = files[a]; delete files[a]; },
        remove: (p) => { delete files[p]; },
    });
    const F = [{ path: '/r/table.ts', before: 'old-table', after: 'new-table' }, { path: '/r/book.ts', before: 'old-book', after: 'new-book' }];
    it('the second rename failing restores the first; no temp file is left', () => {
        const io = memIo({ '/r/table.ts': 'old-table', '/r/book.ts': 'old-book' }, { rename: (p) => p === '/r/book.ts' });
        expect(() => writeAll(F, '/r', io)).toThrow(/write failed .*nothing left changed/);
        expect(io.files).toEqual({ '/r/table.ts': 'old-table', '/r/book.ts': 'old-book' });
    });
    it('…but a file another writer changed in between is left alone and reported', () => {
        const io = memIo({ '/r/table.ts': 'old-table', '/r/book.ts': 'old-book' }, { rename: (p) => { if (p === '/r/book.ts') { io.files['/r/table.ts'] = 'their-edit'; return true; } return false; } });
        expect(() => writeAll(F, '/r', io)).toThrow(/table\.ts changed since this run wrote it/);
        expect(io.files['/r/table.ts']).toBe('their-edit');
    });
    it('a failed rename whose rollback also fails reports the unrestored file (the caller keeps its recovery data)', () => {
        const io = memIo({ '/r/table.ts': 'old-table', '/r/book.ts': 'old-book' }, {
            rename: (p) => p === '/r/book.ts',
            write: (p) => p === '/r/table.ts', // the rollback of the already-renamed table fails
        });
        let err: any;
        try { writeAll(F, '/r', io); } catch (e) { err = e; }
        expect(err?.message).toMatch(/table\.ts could not be restored/);
        expect(err?.unrestored).toEqual([expect.stringMatching(/table\.ts could not be restored/)]);
    });
    it('a temp file that cannot be removed does not mask the rollback status (Codex r9)', () => {
        const io = memIo({ '/r/table.ts': 'old-table', '/r/book.ts': 'old-book' }, { rename: (p) => p === '/r/book.ts' });
        io.remove = () => { throw new Error('EBUSY'); };
        let err: any;
        try { writeAll(F, '/r', io); } catch (e) { err = e; }
        expect(err?.unrestored).toEqual(expect.arrayContaining([expect.stringMatching(/pin-fill\.tmp could not be removed \(EBUSY\)/)]));
    });
    it('restore() attempts every file and reports each failure', () => {
        const io = memIo({ '/r/table.ts': 'old-table', '/r/book.ts': 'old-book' });
        const restore = writeAll(F, '/r', io);
        expect(io.files).toEqual({ '/r/table.ts': 'new-table', '/r/book.ts': 'new-book' });
        delete io.files['/r/table.ts'];
        expect(restore()).toEqual([expect.stringMatching(/table\.ts could not be restored/)]);
        expect(io.files['/r/book.ts']).toBe('old-book');
    });
});
