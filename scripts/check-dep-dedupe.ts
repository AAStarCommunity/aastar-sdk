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
 */
const SNAPSHOT_KEY = /^ {2}(@?[a-z0-9/._-]+@[0-9][^(:]*)\(/i;

function main(): void {
    const lines = readFileSync(LOCKFILE, 'utf8').split('\n');
    const seen = new Map<string, number>();
    for (const line of lines) {
        const m = SNAPSHOT_KEY.exec(line);
        if (m) seen.set(m[1], (seen.get(m[1]) ?? 0) + 1);
    }
    // Anti-vacuous: a regex that matches nothing prints the same ✅ as a lockfile with no duplicates.
    //
    // The floor is 20 because the measured count is 35, not "thousands" — the first draft of this
    // check guessed 200 and fired on the healthy lockfile. Only PEER-QUALIFIED snapshots carry the
    // `(peer@version)` suffix this regex needs, and they are a small minority of the file. Guessing
    // the size of the thing you are guarding is how an anti-vacuous guard becomes the vacuum.
    const MIN_SNAPSHOTS = 20;
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
        for (const [id, n] of dupes) console.error(`  ❌ ${id} — ${n} physical copies`);
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
        `check-dep-dedupe: ✅ ${seen.size} peer-qualified package version(s) in pnpm-lock.yaml, ` +
            'each resolving to exactly one copy. (Reads the LOCKFILE, not node_modules/.pnpm — that ' +
            'directory keeps stale entries across reinstalls and would report a fixed defect as live.)',
    );
}

main();
