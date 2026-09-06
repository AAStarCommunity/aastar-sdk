import { describe, it, expect } from 'vitest';
import { analyzeLockfile } from './check-dep-dedupe.js';

/**
 * The fixture below is the test this check should have had on day one.
 *
 * Shipped without one, its key regex omitted the `'` that pnpm puts around SCOPED snapshot keys,
 * so it read 35 of 69 peer-qualified entries — 51% — while printing "each resolving to exactly one
 * copy", a claim about all of them. A duplicated unscoped package was caught; a duplicated scoped
 * package was not. Review found it by mutating a real lockfile; this fixture finds it in 3ms.
 *
 * So the fixture is built around that shape deliberately: one quoted scoped key, one unquoted key,
 * and a duplicate of each.
 */
const FIXTURE = `lockfileVersion: '9.0'

snapshots:

  viem@2.43.3(typescript@5.6.3)(zod@3.25.76):
    dependencies: {}

  viem@2.43.3(typescript@5.7.2)(zod@3.25.76):
    dependencies: {}

  '@typescript-eslint/parser@8.50.1(eslint@9.39.2)(typescript@5.6.3)':
    dependencies: {}

  '@typescript-eslint/parser@8.50.1(eslint@9.39.2)(typescript@5.7.2)':
    dependencies: {}

  ox@0.11.1(typescript@5.7.2)(zod@3.25.76):
    dependencies: {}

  plain-package@1.0.0:
    dependencies: {}
`;

describe('analyzeLockfile', () => {
    const r = analyzeLockfile(FIXTURE);

    it('counts BOTH quoted-scoped and unquoted peer-qualified keys', () => {
        // 5 peer-qualified keys; `plain-package@1.0.0` has no `(peer)` suffix and is not one.
        expect(r.total).toBe(5);
        expect(r.distinct).toBe(3);
    });

    it('catches a duplicated SCOPED package — the case the first regex could not see', () => {
        const ids = r.duplicates.map((d) => d.id);
        expect(ids).toContain('@typescript-eslint/parser@8.50.1');
    });

    it('catches a duplicated unscoped package too', () => {
        expect(r.duplicates.map((d) => d.id)).toContain('viem@2.43.3');
    });

    it('reports the peer suffixes that DISTINGUISH the copies, not just the count', () => {
        // Naming the cause is the difference between "viem twice" and "go fix a typescript pin".
        const viem = r.duplicates.find((d) => d.id === 'viem@2.43.3')!;
        expect(viem.copies).toBe(2);
        expect(viem.variants).toEqual([
            '(typescript@5.6.3)(zod@3.25.76)',
            '(typescript@5.7.2)(zod@3.25.76)',
        ]);
    });

    it('does not report a package that appears once', () => {
        expect(r.duplicates.map((d) => d.id)).not.toContain('ox@0.11.1');
    });
});
