import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCKFILE = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'pnpm-lock.yaml');
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

    // ④ An ABSOLUTE floor against a GROWING population stops working, and stops silently.
    //
    // The blind regex saw 35 of 69 — about 51%. A floor of 40 detects that today. Let the lockfile
    // grow to ~120 peer-qualified keys and the same half-blind instrument reports ~61, which sails
    // over 40: the floor is still green, still "above 35", and no longer detects anything.
    //
    // So the floor is checked against the REAL lockfile's current population rather than against a
    // literal alone. This test fails the day the repo outgrows the constant — which is the point:
    // it converts a silent loss of coverage into a red that says what to reconsider. It is NOT a
    // derivation of the floor (that would reintroduce the circularity #405 r3 was about); the
    // literals above still pin the magnitude. This one pins the RATIO.
    it('stays above what a half-blind instrument would report on the CURRENT lockfile', () => {
        const real = analyzeLockfile(readFileSync(LOCKFILE, 'utf8'));
        const halfBlind = Math.floor(real.total * 0.51); // the measured blind/total ratio, 35/69
        expect(MIN_SNAPSHOTS).toBeGreaterThan(halfBlind);
    });
});

describe('verdict', () => {
    // A sentinel the DEFAULT could never contain. The previous `source` test asserted
    // `toContain('pnpm-lock.yaml')`, which every candidate satisfies: the default was that literal
    // and the real value is an absolute path ENDING in it. So the assertion could not tell the two
    // apart, and — since `source` was defaulted — it was in fact pinning the default: dropping the
    // argument at the call site left the suite at 12 passed. `source` is required now, and this
    // string appears in no default anywhere.
    const SRC = '/tmp/ZZZ-sentinel/other-lock.yaml';

    // total !== distinct ON PURPOSE. When both are `MIN_SNAPSHOTS`, swapping `${r.total}` and
    // `${r.distinct}` in the success line leaves every test green — the probe cannot separate two
    // implementations because the input gives the two variables the same value. That is the very
    // defect `dep-dedupe.ts` documents in its own history ("tested `total` against the floor while
    // printing `distinct`"), reappearing inside the test that guards it.
    const healthy = { total: 42, distinct: 42, duplicates: [] };

    it('refuses to pass a run that matched too few keys, and says it went blind', () => {
        const v = verdict({ total: MIN_SNAPSHOTS - 1, distinct: MIN_SNAPSHOTS - 1, duplicates: [] }, SRC);
        expect(v.ok).toBe(false);
        expect(v.lines.join('\n')).toContain('went blind');
        expect(v.lines.join('\n')).toContain(SRC);
    });

    it('fails on duplicates, names the file, and prints the distinguishing peer suffixes', () => {
        const v = verdict(
            {
                total: MIN_SNAPSHOTS + 1,
                distinct: MIN_SNAPSHOTS,
                duplicates: [{ id: 'viem@2.43.3', copies: 2, variants: ['(typescript@5.6.3)', '(typescript@5.7.2)'] }],
            },
            SRC,
        );
        expect(v.ok).toBe(false);
        expect(v.lines.join('\n')).toContain('(typescript@5.6.3)');
        expect(v.lines.join('\n')).toContain('(typescript@5.7.2)');
        // The duplicates branch used to name no file at all.
        expect(v.lines.join('\n')).toContain(SRC);
    });

    // Title says what `verdict` DOES. The previous one said "passes only when total and distinct are
    // equal" — a comparison `verdict` never performs: `{total:42, distinct:40, duplicates:[]}` returns
    // ok=true and prints "42 … / 40 distinct … — equal". Unreachable through `analyzeLockfile`
    // (total > distinct is equivalent to duplicates being non-empty), so not a live bug — but a title
    // claiming a check that does not exist is the exact thing this repo keeps paying for.
    it('passes when there are no duplicates, printing total and distinct in that order', () => {
        const v = verdict(healthy, SRC);
        expect(v.ok).toBe(true);
        expect(v.lines.join('\n')).toContain(SRC);
        // Distinct values would catch a swap; equal ones cannot. See the fixture comment above.
        const swapProof = verdict({ total: 43, distinct: 42, duplicates: [] }, SRC);
        expect(swapProof.lines.join('\n')).toContain('43 peer-qualified snapshot key(s) / 42 distinct');
    });

    it('the regex is the one that accepts quoted scoped keys', () => {
        expect(SNAPSHOT_KEY.test("  '@scope/pkg@1.0.0(peer@2.0.0)':")).toBe(true);
        expect(SNAPSHOT_KEY.test('  pkg@1.0.0(peer@2.0.0):')).toBe(true);
        expect(SNAPSHOT_KEY.test('  pkg@1.0.0:')).toBe(false);
    });
});
