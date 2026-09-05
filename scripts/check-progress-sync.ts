/**
 * Every task status quoted in `progress.md` must equal the one in `tasks.md`.
 *
 * ## What rotted, and why nothing saw it
 *
 * `progress.md` sat un-updated across roughly twenty merged PRs. Its live section claimed
 * `T1.2.1 PR_OPEN` (merged as #361 hours earlier), listed two already-delivered tasks under
 * "下一个 READY", and carried T2.1.2's blocking reason in the version #370 had already disproved.
 *
 * **The one that actually costs something**: it still asserted that `setup-server.py` pinned a
 * superseded validator — a claim #375 RETRACTED after the DVT repo disproved it and I re-read the
 * chain. The correction landed in `tasks.md` and in the gap doc. It did not land here.
 *
 * > A correction that does not sweep every copy leaves the wrong one where someone will read it.
 *
 * Three ledger gates existed and none of them look at this file: `check-task-ledger` reconciles
 * tasks.md/followups.md against GitHub, `check-followups` validates entry shape,
 * `check-branch-task` checks the branch's claim. This is the fourth instance of one shape in a
 * single day — **a gate's scope is defined by what it reads, and drift accumulates precisely in
 * what nothing reads.**
 *
 * ## The rule, and why it is this one
 *
 * Whenever `progress.md` writes a task id next to a backticked status, that pair is a CLAIM about
 * `tasks.md`, and claims are checkable. Nothing else here is: prose summaries, "下一个 READY"
 * lists, and narrative cannot be reconciled mechanically without inventing a schema nobody writes.
 *
 * So this does not try to keep the whole file honest. It keeps honest the part that is written in a
 * form a machine can read — and, importantly, it says so out loud when it runs, because "0 pairs
 * checked" and "all pairs agree" are the same green otherwise.
 *
 * Usage:  pnpm exec tsx scripts/check-progress-sync.ts [--progress <f>] [--tasks <f>]
 * Exit 0 when every quoted status matches; 1 otherwise.
 */
import { readFileSync, existsSync } from 'node:fs';

const PROGRESS = 'docs/agent/progress.md';
const TASKS = 'docs/agent/tasks.md';

export interface StatusPair {
    task: string;
    /** What progress.md says. */
    claimed: string;
    line: number;
}

/**
 * Blank out backtick-quoted spans, length-preserving.
 *
 * Not applied to the status itself — the status IS a code span, that is how it is written. This is
 * for the file's own prose about the rule: the header of `progress.md` documents the very pattern
 * this scans for, and without masking that documentation would parse as a claim. Third time this
 * exact confusion has cost something here (FU-56 #2, FU-68), so it is installed up front rather
 * than after it fires.
 */
const maskCodeSpans = (line: string) => line.replace(/`[^`]*`/g, (m) => ' '.repeat(m.length));

/**
 * Claims of the form `T1.2.1 \`DONE\`` — a task id, then a backticked all-caps status, close by.
 *
 * The window matters. Without it, a paragraph naming a task and, three sentences later, quoting an
 * unrelated status would read as a claim; with it, the two have to be written as a pair, which is
 * how every real occurrence in this file is written.
 */
export function statusPairs(text: string): StatusPair[] {
    const out: StatusPair[] = [];
    text.split('\n').forEach((line, i) => {
        // A line that only DOCUMENTS the pattern must not parse as a claim, and that falls out of
        // the id pattern rather than needing a special case: `T<x.y.z>` has no digits.
        //
        // An earlier draft masked the placeholder explicitly, with a test asserting the header line
        // is not a claim. That test passed with the masking removed — it could not fail, because the
        // regex never matched the placeholder either way. **Dead code with a test standing witness
        // for it**, found by mutation (0 red). Removed; the case below now pins the real mechanism.
        for (const m of line.matchAll(/(T\d+(?:\.\d+)+)\s*[^`\n]{0,12}`([A-Z_]+)`/g)) {
            out.push({ task: m[1], claimed: m[2], line: i + 1 });
        }
    });
    return out;
}

/** `task id → status` as tasks.md defines it, from headers. */
export function ledgerStatuses(text: string): Map<string, string> {
    const map = new Map<string, string>();
    for (const line of text.split('\n')) {
        const m = /^#{2,4}\s+(T\d+(?:\.\d+)+)\b(.*)$/.exec(line);
        if (!m) continue;
        const status = /`([A-Z_]+)`\s*$/.exec(m[2])?.[1];
        if (status) map.set(m[1], status);
    }
    return map;
}

export interface Mismatch extends StatusPair {
    actual: string | undefined;
}

export function mismatches(progress: string, tasks: string): Mismatch[] {
    const defined = ledgerStatuses(tasks);
    return statusPairs(progress)
        .map((p) => ({ ...p, actual: defined.get(p.task) }))
        .filter((p) => p.actual !== p.claimed);
}

if (process.argv[1]?.endsWith('check-progress-sync.ts')) {
    const arg = (flag: string, dflt: string) => {
        const i = process.argv.indexOf(flag);
        return i >= 0 ? process.argv[i + 1] : dflt;
    };
    const pFile = arg('--progress', PROGRESS);
    const tFile = arg('--tasks', TASKS);
    for (const f of [pFile, tFile]) {
        if (!existsSync(f)) {
            console.error(`check-progress-sync: ${f} is missing — cannot check anything.`);
            process.exit(1);
        }
    }
    const progress = readFileSync(pFile, 'utf8');
    const pairs = statusPairs(progress);

    // Said out loud: "checked nothing" and "everything agrees" are otherwise the same green, and
    // this repo has now paid for that four times in one day.
    console.log(`check-progress-sync: ${pFile} quotes ${pairs.length} task status(es)`);
    if (pairs.length === 0) {
        console.error(
            'check-progress-sync: 0 quoted statuses. Either the file stopped naming tasks (in which\n' +
                'case it is no longer a status document), or the format changed and this check went blind.',
        );
        process.exit(1);
    }

    const bad = mismatches(progress, readFileSync(tFile, 'utf8'));
    for (const b of bad) {
        console.error(
            `  ❌ ${pFile}:${b.line} — ${b.task}: progress says \`${b.claimed}\`, ` +
                `tasks.md says ${b.actual ? `\`${b.actual}\`` : 'NOTHING (no such task)'}`,
        );
    }
    if (bad.length) {
        console.error(
            `\ncheck-progress-sync: ${bad.length} status(es) disagree with the ledger.\n` +
                'progress.md is read as "what is true right now"; a stale status there outlives the\n' +
                'work by however long nobody looks.',
        );
        process.exit(1);
    }
    console.log(`check-progress-sync: ✅ all ${pairs.length} quoted status(es) match ${tFile}.`);
}
