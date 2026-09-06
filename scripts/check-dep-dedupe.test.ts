import { describe, it, expect } from 'vitest';
import { analyzeLockfile, verdict, MIN_SNAPSHOTS, SNAPSHOT_KEY } from './dep-dedupe.js';

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

    // Review [Medium]: the assertion above pinned `variants` only for the UNSCOPED `viem`, so the
    // quote-offset arithmetic (`t.startsWith("'") ? 1 : 0`) could be deleted and all five tests
    // still passed — the scoped case was only checked by `toContain(id)`, which survives an off-by
    // -one in the SUFFIX. This assertion is the one that fails when that offset goes.
    it('strips the leading quote when slicing a SCOPED key\'s peer suffix', () => {
        const parser = r.duplicates.find((d) => d.id === '@typescript-eslint/parser@8.50.1')!;
        expect(parser.variants).toEqual([
            '(eslint@9.39.2)(typescript@5.6.3)',
            '(eslint@9.39.2)(typescript@5.7.2)',
        ]);
    });
});

// `MIN_SNAPSHOTS` and the pass/fail decision used to live inside the CLI's `main()`, where nothing
// could reach them. They are part of the gate's behaviour, so they are tested like it.
// The floor's MAGNITUDE, pinned with hard literals.
//
// Review [Low]: every other test here states its expectation RELATIVE to `MIN_SNAPSHOTS`, so
// setting it to 1 left all ten green — and a floor of 1, combined with the `'?` regex bug, makes
// the gate print `✅ 35 … each version resolves to exactly one copy`: **the original blind state,
// passing silently**. That is the same shape one level up — the floor was calibrated against the
// instrument, and then the tests were calibrated against the floor.
//
// So these two numbers are written out, not derived. Deriving them is what reintroduces the defect.
//   > 35  — the count the BLIND regex saw; a floor at or below it cannot detect that blindness
//   ≤ 69  — the count a healthy lockfile has; a floor above it fires on a healthy repo
describe('MIN_SNAPSHOTS is above the blind-state count and at or below the healthy count', () => {
    it('is greater than 35 — the number of keys the pre-fix regex could see', () => {
        expect(MIN_SNAPSHOTS).toBeGreaterThan(35);
    });
    it('is at most 69 — the number of peer-qualified keys a healthy lockfile has', () => {
        expect(MIN_SNAPSHOTS).toBeLessThanOrEqual(69);
    });
});

describe('verdict', () => {
    const healthy = { total: MIN_SNAPSHOTS, distinct: MIN_SNAPSHOTS, duplicates: [] };

    it('refuses to pass a run that matched too few keys, and says it went blind', () => {
        const v = verdict({ ...healthy, total: MIN_SNAPSHOTS - 1, distinct: MIN_SNAPSHOTS - 1 });
        expect(v.ok).toBe(false);
        expect(v.lines.join('\n')).toContain('went blind');
        // ③ the message must name the file it read, or the reader cannot tell WHICH lockfile went blind.
        expect(v.lines.join('\n')).toContain('pnpm-lock.yaml');
    });

    it('fails on duplicates and prints the peer suffixes that distinguish them', () => {
        const v = verdict({
            total: MIN_SNAPSHOTS + 1,
            distinct: MIN_SNAPSHOTS,
            duplicates: [{ id: 'viem@2.43.3', copies: 2, variants: ['(typescript@5.6.3)', '(typescript@5.7.2)'] }],
        });
        expect(v.ok).toBe(false);
        expect(v.lines.join('\n')).toContain('(typescript@5.6.3)');
        expect(v.lines.join('\n')).toContain('(typescript@5.7.2)');
    });

    it('passes only when total and distinct are equal, and prints BOTH', () => {
        const v = verdict(healthy);
        expect(v.ok).toBe(true);
        expect(v.lines.join('\n')).toContain(`${MIN_SNAPSHOTS} peer-qualified snapshot key(s) / ${MIN_SNAPSHOTS} distinct`);
    });

    it('the regex is the one that accepts quoted scoped keys', () => {
        expect(SNAPSHOT_KEY.test("  '@scope/pkg@1.0.0(peer@2.0.0)':")).toBe(true);
        expect(SNAPSHOT_KEY.test('  pkg@1.0.0(peer@2.0.0):')).toBe(true);
        expect(SNAPSHOT_KEY.test('  pkg@1.0.0:')).toBe(false);
    });
});
