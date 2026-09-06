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
/**
 * Pure over the lockfile TEXT. Nothing here reads a file, prints, or exits.
 *
 * The split exists because the previous revision kept `analyzeLockfile` for the test and left a
 * SECOND, inlined copy of the same counting loop inside the CLI's `main()`. Review proved what that
 * costs: mutate only the CLI's copy, and with a real duplicate present in the lockfile the gate
 * exits 0 printing "each version resolves to exactly one copy" — while the test suite reports
 * 5 passed. **The tested code and the running code were different code**, and the tests were
 * supplying confidence about a function CI never called.
 *
 * The two had already begun to diverge textually (one hoisted `line.trim()`, the other called it
 * twice), which is how that ends in a semantic difference rather than a tidiness complaint.
 *
 * So: one implementation, imported by both the entry point and the test. The CLI keeps no logic
 * that could drift.
 */

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
 * said "each resolving to exactly one copy", which is a claim about ALL of them. A duplicated
 * UNSCOPED key was caught; a duplicated SCOPED key produced `exit 0` and a green verdict.
 */
export const SNAPSHOT_KEY = /^ {2}'?(@?[a-z0-9/._-]+@[0-9][^(:]*)\(/i;

/**
 * Lowest plausible number of peer-qualified snapshot keys.
 *
 * Two earlier values were both wrong in instructive ways: 200 was a guess and fired on a healthy
 * lockfile; 20 was calibrated against the 35 this file could then SEE — i.e. against its own blind
 * spot. **A floor derived from the instrument cannot detect that instrument going half-blind**; it
 * moves with it. 40 is set against a population of 69 counted with a DIFFERENT tool (a shell scan
 * of the whole `snapshots:` section: 798 keys, 69 peer-qualified, 0 missed).
 */
export const MIN_SNAPSHOTS = 40;

/**
 * `total` counts every peer-qualified key; `distinct` counts identities. They differ EXACTLY by the
 * number of surplus copies. Measured on this repo: **before #404 `total=72 / distinct=69`**
 * (3 duplicated groups, one surplus copy each); **after #404 `69/69`**. The earlier version of this
 * sentence labelled `72/69` as "healthy", which is backwards — 72/69 is the DEFECTIVE state and
 * 69/69 is the healthy one.
 *
 * An earlier note here said "69/66 before #404". That is arithmetically self-consistent and wrong
 * about the mechanism: it held `total` fixed and moved `distinct`, when duplication ADDS keys and
 * leaves the set of identities alone. Both numbers are printed on success for this reason — the
 * previous version tested `total` against the floor while printing `distinct`, so the number the
 * reader saw was never the number that was checked.
 */
export type DedupeReport = {
    /** every peer-qualified snapshot key */
    total: number;
    /** distinct package identities among them */
    distinct: number;
    /** identities with more than one copy, and the peer suffixes that distinguish them */
    duplicates: { id: string; copies: number; variants: string[] }[];
};

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

/**
 * The verdict, as data. Exported so the floor and both failure modes are reachable from a test —
 * `MIN_SNAPSHOTS` previously lived only inside `main()` and nothing could get at it.
 */
export function verdict(r: DedupeReport, source = 'pnpm-lock.yaml'): { ok: boolean; lines: string[] } {
    if (r.total < MIN_SNAPSHOTS) {
        return {
            ok: false,
            lines: [
                `check-dep-dedupe: matched only ${r.total} peer-qualified snapshot(s) in ${source}, ` +
                    `expected at least ${MIN_SNAPSHOTS}. The lockfile format changed and this check ` +
                    'went blind.',
            ],
        };
    }
    if (r.duplicates.length) {
        const lines: string[] = [];
        for (const d of r.duplicates) {
            // Name the CAUSE, not just the symptom. "viem@2.43.3 twice" says nothing;
            // "(typescript@5.6.3) vs (typescript@5.7.2)" names the pin to go fix — and #404 was
            // expensive precisely because the diagnostic never said what it was.
            lines.push(`  ❌ ${d.id} — ${d.copies} physical copies, distinguished by:`);
            for (const v of d.variants) lines.push(`       ${v}`);
        }
        lines.push(
            `\ncheck-dep-dedupe: ${r.duplicates.length} package version(s) resolve to more than one copy.\n` +
                'Two copies of one version are two NOMINALLY DISTINCT types: a value from one does not\n' +
                'satisfy a parameter typed by the other, and the diagnostic reads as an ordinary\n' +
                'mismatch ("…68 more…" vs "…67 more…"), not as a duplication.\n' +
                'Usual cause: one package pins a peer (typescript, react, …) at a version the others do\n' +
                'not. Align the pin, or add it to `pnpm.overrides` in the root package.json.',
        );
        return { ok: false, lines };
    }
    return {
        ok: true,
        lines: [
            `check-dep-dedupe: ✅ ${r.total} peer-qualified snapshot key(s) / ${r.distinct} distinct ` +
                'package version(s) in pnpm-lock.yaml — equal, so each version resolves to exactly one ' +
                'copy. (Reads the LOCKFILE, not node_modules/.pnpm — that directory keeps stale entries ' +
                'across reinstalls and would report an already-fixed defect as live.)',
        ],
    };
}
