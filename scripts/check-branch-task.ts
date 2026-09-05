/**
 * A branch that NAMES a task must have that task in the ledger.
 *
 * ## The drift this exists for, and why nothing else could see it
 *
 * `T1.2.3` was developed on `feat/T1.2.3-account-anchor`, opened as #377, reviewed over two rounds,
 * and merged — **while `docs/agent/tasks.md` contained no such task at all**. Not a stale status,
 * not a wrong PR number: the row was never written.
 *
 * Both existing ledger gates were green throughout, and correctly so. `check-task-ledger` reconciles
 * the claims it can parse; `findUnverifiableStatuses` inspects the headers that exist. **A row that
 * was never written is not in either one's scope.** This is the third time that shape has cost
 * something here (FU-63: zero claims, green verdict; FU-66: unparseable status, green verdict), and
 * the first time what went missing was an entire task rather than a field.
 *
 * ## Why the rule is "the branch names it", and not something more ambitious
 *
 * The tempting rule is "every merged PR must correspond to a task". `check-task-ledger` already
 * documents why that one is wrong: fifteen PRs in one night were follow-up-driven and never had a
 * task, so the rule would fire constantly and be switched off.
 *
 * This asks something much narrower and entirely mechanical: **if you named a task in your branch
 * name, that task must exist.** A branch called `feat/T1.2.3-…` is an assertion about the ledger,
 * made by the author, in a string the tooling already has. Nothing is inferred.
 *
 * The false-positive cost is one line in `tasks.md` — which the author was supposed to write anyway,
 * since naming the task in the branch means they had one in mind. The false-negative cost is what
 * happened above: a task delivered, reviewed and merged with no record.
 *
 * Deliberately NOT checked: whether the task's status matches the PR (that is `check-task-ledger`'s
 * job once the row exists), and branches that name no task (chore/, fix/, docs/ — most of this
 * repo's work, and requiring a task id there would be the over-broad rule again).
 *
 * Usage:  pnpm exec tsx scripts/check-branch-task.ts [--branch <name>]
 * Exit 0 when every task named by the branch exists in the ledger; 1 otherwise.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const LEDGER = 'docs/agent/tasks.md';

/**
 * Task ids a branch name claims. `T` followed by at least two dot-separated numbers, so an ordinary
 * word starting with T cannot match and neither can a bare `T5`.
 *
 * Anchored on a non-alphanumeric boundary rather than `\b`. **An earlier version of this comment
 * justified that with "`\b` would also match inside `XT1.2.3`" — measured, and false**: `\b` does not
 * match there either, because `X` and `T` are both word characters so there is no boundary between
 * them. #379 review caught it by mutating the separator and getting ZERO reds; nothing was pinning
 * the choice, and the reason written down for it did not hold.
 *
 * The two forms differ on exactly one character: `_`. JavaScript's `\w` includes underscore, so `\b`
 * treats `_T1.2.3` as one word and finds no claim; this form treats `_` as a separator and does.
 * A branch like `chore/fix_T1.2.3_thing` HAS named the task, so the stricter-looking form is the
 * more correct one — but it is a one-character difference, not the sweeping distinction the old
 * comment implied. Pinned by a case in the tests, since a rationale nobody can falsify is decoration.
 */
export function tasksNamedBy(branch: string): string[] {
    return [...new Set([...branch.matchAll(/(?:^|[^A-Za-z0-9])(T\d+(?:\.\d+)+)/g)].map((m) => m[1]))];
}

/** Task ids the ledger actually defines, read from its headers. */
export function tasksInLedger(text: string): Set<string> {
    return new Set(
        text
            .split('\n')
            .map((l) => /^#{2,4}\s+(T\d+(?:\.\d+)+)\b/.exec(l)?.[1])
            .filter((x): x is string => Boolean(x)),
    );
}

export function missingTasks(branch: string, ledger: string): string[] {
    const defined = tasksInLedger(ledger);
    return tasksNamedBy(branch).filter((t) => !defined.has(t));
}

function currentBranch(): string {
    // On a `pull_request` run the checkout is detached, so git cannot answer. The event knows,
    // and asking it needs no subprocess — the same reasoning `check-task-ledger` records for its
    // own self-PR lookup, applied at the place it next applies rather than left as a lesson.
    const fromEnv = process.env.GITHUB_HEAD_REF || process.env.PILOT_BRANCH;
    if (fromEnv) return fromEnv;
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
}

if (process.argv[1]?.endsWith('check-branch-task.ts')) {
    const argIdx = process.argv.indexOf('--branch');
    const branch = argIdx >= 0 ? process.argv[argIdx + 1] : currentBranch();

    if (!existsSync(LEDGER)) {
        console.error(`check-branch-task: ${LEDGER} is missing — cannot check anything.`);
        process.exit(1);
    }
    const named = tasksNamedBy(branch);
    // Printed before the verdict: "no tasks named" and "all named tasks exist" are both success,
    // and they are not the same fact. This repo has been bitten by that shape three times.
    console.log(`check-branch-task: branch '${branch}' names ${named.length} task(s): ${named.join(', ') || '(none)'}`);
    if (named.length === 0) {
        console.log('check-branch-task: nothing claimed, nothing checked. This is NOT a statement about the ledger.');
        process.exit(0);
    }

    const missing = missingTasks(branch, readFileSync(LEDGER, 'utf8'));
    for (const t of missing) {
        console.error(`  ❌ ${t} is named by the branch but has no header in ${LEDGER}`);
    }
    if (missing.length) {
        console.error(
            `\ncheck-branch-task: ${missing.length} task(s) named but never written down.\n` +
                'A task that is not in the ledger is invisible to every other ledger check — they\n' +
                'reconcile rows that exist. Add the header, or rename the branch if it names no task.',
        );
        process.exit(1);
    }
    console.log(`check-branch-task: ✅ all ${named.length} named task(s) exist in ${LEDGER}.`);
}
