#!/usr/bin/env tsx
/**
 * One package version must resolve to ONE physical copy.
 *
 * ## The defect this exists for
 *
 * The root `package.json` pinned `typescript@5.6.3` while 16 workspace packages pinned `5.7.2`.
 * pnpm keys its store directories by resolved peers, so a single version of a peer-dependent
 * package got installed TWICE:
 *
 *   node_modules/.pnpm/viem@2.43.3_typescript@5.6.3_zod@3.25.76     <- tests/ resolved here
 *   node_modules/.pnpm/viem@2.43.3_typescript@5.7.2_zod@3.25.76     <- @aastar/core resolved here
 *
 * Two physical copies are two NOMINALLY DISTINCT types. `PublicClient` from one does not satisfy
 * `PublicClient` from the other, and the diagnostic says so in the least recognisable way possible:
 * "…68 more…" vs "…67 more…" properties. Every call passing a client from `tests/` into
 * `@aastar/core` needed an `as any` to compile, and those `as any` then read as ordinary noise
 * rather than as the symptom they were.
 *
 * Measured at the fix (#404): 3 duplicated groups — `viem`, `ox`, `abitype` — and removing them
 * took the repo's root `tsc` diagnostics from 1246 to 696 on a fresh install. `ox` is viem's
 * substrate and `abitype` defines `Abi`/`Address`, so the duplication reached much further than
 * the one package that made it visible.
 *
 * ## Why the criterion reads the LOCKFILE and not node_modules
 *
 * The obvious check — `ls node_modules/.pnpm | …` — carries an unwritten precondition: that the
 * tree was installed from empty. Review measured it (#404): `.pnpm` is NOT pruned across
 * reinstalls, so after fixing the skew and reinstalling in place, the directory still listed all
 * three stale pairs while every real symlink had converged to one copy. A gate that reports a
 * defect which has already been fixed teaches people to ignore it.
 *
 * The lockfile has no such state: it describes what a fresh install WOULD produce, which is the
 * question being asked.
 *
 * ## Prevention, separately
 *
 * `package.json` also gained `pnpm.overrides.typescript`. The gate says "it came back"; the
 * override says "it cannot". Both are here because one package adding one line was enough to
 * cause all of the above, and that line is easy to add by accident and invisible in review.
 *
 * Run: `pnpm run check:dep-dedupe`
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCKFILE = join(repoRoot, 'pnpm-lock.yaml');

/**
 * A `snapshots:` key looks like `  viem@2.43.3(typescript@5.7.2)(zod@3.25.76):` — the package
 * identity is everything before the first `(`. Two entries sharing an identity are two physical
 * copies of one version.
 *
 * The `'?` is the whole point of this comment. **pnpm QUOTES scoped keys**:
 *
 *   viem@2.43.3(typescript@5.7.2)(zod@3.25.76):
 *   '@typescript-eslint/parser@8.50.1(eslint@9.39.2)(typescript@5.7.2)':
 *
 * Without it this regex saw 35 of the 69 peer-qualified keys — **51%** — while the success line
 * said "each resolving to exactly one copy", which is a claim about ALL of them. Review proved it
 * with a paired mutation: a duplicated UNSCOPED key was caught; a duplicated SCOPED key
 * (`@typescript-eslint/parser`, asserted present twice) produced `exit 0` and a green verdict.
 *
 * And the anti-vacuous floor could not have saved it: `MIN_SNAPSHOTS` had been calibrated at 20
 * against the observed 35 — **the guard was calibrated with the instrument it was guarding**, so
 * the blind half was baked into its own definition of "healthy". The floor is now 40, set against
 * the measured population of 69, and that population was counted with a DIFFERENT tool (a shell
 * scan of the whole `snapshots:` section: 798 keys, 69 peer-qualified, 0 missed).
 */
const SNAPSHOT_KEY = /^ {2}'?(@?[a-z0-9/._-]+@[0-9][^(:]*)\(/i;

export type DedupeReport = {
    /** every peer-qualified snapshot key */
    total: number;
    /** distinct package identities among them */
    distinct: number;
    /** identities with more than one copy, and the peer suffixes that distinguish them */
    duplicates: { id: string; copies: number; variants: string[] }[];
};

/**
 * Pure over the lockfile TEXT, so the fixtures in `check-dep-dedupe.test.ts` can exercise the
 * shapes that actually broke this: a quoted scoped key next to an unquoted one. The first version
 * of this file had no test, and the regex silently covered 51% of the population for exactly as
 * long as that was true.
 */
export function analyzeLockfile(text: string): DedupeReport {
    const seen = new Map<string, number>();
    const variants = new Map<string, string[]>();
    for (const line of text.split('\n')) {
        const m = SNAPSHOT_KEY.exec(line);
        if (!m) continue;
        const id = m[1];
        seen.set(id, (seen.get(id) ?? 0) + 1);
        const t = line.trim();
        const suffix = t.slice(id.length + (t.startsWith("'") ? 1 : 0)).replace(/'?:$/, '');
        variants.set(id, [...(variants.get(id) ?? []), suffix]);
    }
    return {
        total: [...seen.values()].reduce((a, b) => a + b, 0),
        distinct: seen.size,
        duplicates: [...seen.entries()]
            .filter(([, n]) => n > 1)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([id, copies]) => ({ id, copies, variants: variants.get(id) ?? [] })),
    };
}

function main(): void {
    const lines = readFileSync(LOCKFILE, 'utf8').split('\n');
    const seen = new Map<string, number>();
    /** identity -> the peer suffixes that make its copies different, e.g. `(typescript@5.6.3)`. */
    const variants = new Map<string, string[]>();
    for (const line of lines) {
        const m = SNAPSHOT_KEY.exec(line);
        if (!m) continue;
        const id = m[1];
        seen.set(id, (seen.get(id) ?? 0) + 1);
        const suffix = line.trim().slice(id.length + (line.trim().startsWith("'") ? 1 : 0)).replace(/'?:$/, '');
        variants.set(id, [...(variants.get(id) ?? []), suffix]);
    }
    // Anti-vacuous: a regex that matches nothing prints the same ✅ as a lockfile with no duplicates.
    //
    // The floor is 40 against a measured population of 69. Two earlier values were both wrong in
    // instructive ways: 200 was a guess and fired on a healthy lockfile; 20 was calibrated against
    // the 35 this file could then see, i.e. against its own blind spot. **A floor derived from the
    // instrument cannot detect that instrument going half-blind** — it moves with it.
    const MIN_SNAPSHOTS = 40;
    // `total` (every key) and `seen.size` (distinct identities) differ EXACTLY when there are
    // duplicates — 69/69 healthy, 69/66 before #404. The success line used to print `seen.size`
    // while the floor tested `total`, so the number a reader saw was never the number that was
    // checked. Both are printed now, and the floor tests the one it names.
    const total = [...seen.values()].reduce((a, b) => a + b, 0);
    if (total < MIN_SNAPSHOTS) {
        console.error(
            `check-dep-dedupe: matched only ${total} peer-qualified snapshot(s) in ${LOCKFILE}, ` +
                `expected at least ${MIN_SNAPSHOTS}. The lockfile format changed and this check went blind.`,
        );
        process.exit(1);
    }

    const dupes = [...seen.entries()].filter(([, n]) => n > 1).sort(([a], [b]) => a.localeCompare(b));
    if (dupes.length) {
        for (const [id, n] of dupes) {
            // Print the peer suffixes that DISTINGUISH the copies. Without them the message names
            // the symptom and hides the cause, which is precisely why #404 was expensive to find:
            // "viem@2.43.3 twice" says nothing; "(typescript@5.6.3) vs (typescript@5.7.2)" names
            // the pin to go fix.
            console.error(`  ❌ ${id} — ${n} physical copies, distinguished by:`);
            for (const suffix of variants.get(id) ?? []) console.error(`       ${suffix}`);
        }
        console.error(
            `\ncheck-dep-dedupe: ${dupes.length} package version(s) resolve to more than one copy.\n` +
                'Two copies of one version are two NOMINALLY DISTINCT types: a value from one does not\n' +
                'satisfy a parameter typed by the other, and the diagnostic reads as an ordinary\n' +
                'mismatch ("…68 more…" vs "…67 more…"), not as a duplication.\n' +
                'Usual cause: one package pins a peer (typescript, react, …) at a version the others do\n' +
                'not. Align the pin, or add it to `pnpm.overrides` in the root package.json.',
        );
        process.exit(1);
    }
    console.log(
        `check-dep-dedupe: ✅ ${total} peer-qualified snapshot key(s) / ${seen.size} distinct ` +
            'package version(s) in pnpm-lock.yaml — equal, so each version resolves to exactly one ' +
            'copy. (Reads the LOCKFILE, not node_modules/.pnpm — that directory keeps stale entries ' +
            'across reinstalls and would report an already-fixed defect as live.)',
    );
}

// Run only when executed directly. `check-dep-dedupe.test.ts` imports `analyzeLockfile` from
// here, and a top-level `main()` would run the real check — including its `process.exit(1)` — at
// import time, killing the test runner before a single assertion ran. Measured: with the entry
// unguarded, mutating the regex made vitest print `no tests` instead of a failing assertion, i.e.
// the mutation looked like a broken test file rather than a caught defect.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    main();
}
