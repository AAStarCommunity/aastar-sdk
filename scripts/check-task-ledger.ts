/**
 * Reconcile what the planning docs CLAIM about a PR against what GitHub says.
 *
 * WHY TWO LEDGERS CANNOT CHECK EACH OTHER
 * ---------------------------------------
 * `docs/agent/tasks.md` and `docs/agent/followups.md` both record PR numbers alongside a status.
 * Both are written by hand, and both drift — but they drift independently, so comparing them to
 * each other finds only the cases where exactly one is wrong. The case that matters most, both
 * being stale in the same direction, is invisible to that comparison.
 *
 * GitHub is the one party that is not writing prose about its own work. So this reconciles against
 * `gh pr view <N> --json state` and treats that as authority.
 *
 * WHAT COUNTS AS A PROBLEM, AND WHAT DELIBERATELY DOES NOT
 * -------------------------------------------------------
 *   · claimed DONE, PR not merged        → problem. The strongest one: a task reads as finished.
 *   · claimed open/pending, PR merged    → problem. Work that landed and nobody updated the entry.
 *   · PR referenced, does not exist      → problem. A typo'd number reads as evidence.
 *   · a merged PR NOT mentioned anywhere → NOT a problem. Measured while writing this: fifteen PRs
 *     from one night appear in the follow-up ledger and not in tasks.md, because that work was
 *     follow-up-driven and never had a task. Requiring every PR to appear in the task layer would
 *     fire constantly and the gate would be turned off — the failure mode of a guard that is too
 *     strict, which this repo has already documented once (FU-26's gap check).
 *
 * Usage:  pnpm exec tsx scripts/check-task-ledger.ts [--offline]
 * Exit 0 when the claims agree with GitHub; 1 otherwise.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export interface Claim {
  /** Source file and 1-based line, so a failure points at the text to edit. */
  where: string;
  pr: number;
  /** What the surrounding text asserts about that PR. */
  claimsDone: boolean;
}

export interface Reconciliation {
  claim: Claim;
  actual: 'MERGED' | 'OPEN' | 'CLOSED' | 'MISSING';
  problem: string | null;
}

/** Words that mark an entry as finished, in either ledger's vocabulary. */
const DONE_MARKERS = /`DONE`|\bDONE\b|已合并|已合|^- \[x\]/;

/**
 * Extract PR claims from one markdown ledger.
 *
 * A PR number on a line is not automatically a claim about that PR, and the first version of this
 * treated it as one. Run against the real ledgers it produced 24 "problems", every one of them a
 * line reading `src=PR#339` — a CITATION of where a follow-up came from, saying nothing about
 * whether #339 merged. The check was flagging entries for not asserting something they never set
 * out to assert.
 *
 * So the syntax decides, not the presence of a number:
 *
 *   `src=PR#N`   the follow-up came from that PR's review        → not a claim, ignored
 *   `done=PR#N`  the follow-up was closed by that PR             → claims MERGED
 *   `PR #N` on a line marked DONE / 已合并                        → claims MERGED
 *   `PR #N` anywhere else                                        → claims only that #N EXISTS
 *
 * The narrowing is not a weakening: the remaining rules are the ones whose violation is unambiguous.
 * A gate that reports two dozen non-problems on its first honest run gets deleted before it ever
 * catches the real one.
 */
export function extractClaims(file: string, text: string): Claim[] {
  const claims: Claim[] = [];
  text.split('\n').forEach((line, i) => {
    const where = `${file}:${i + 1}`;
    const marked = DONE_MARKERS.test(line);
    for (const m of line.matchAll(/(src=|done=)?PR ?#(\d+)/g)) {
      const kind = m[1];
      if (kind === 'src=') continue; // a citation of origin, not a status claim
      claims.push({ where, pr: Number(m[2]), claimsDone: kind === 'done=' || marked });
    }
  });
  return claims;
}

/** Compare claims to states. `states` maps PR number → what GitHub says. */
export function reconcile(
  claims: readonly Claim[],
  states: ReadonlyMap<number, Reconciliation['actual']>,
  /**
   * The PR this run is itself part of, if any.
   *
   * An entry closed by the PR under review necessarily claims DONE against a PR that is still OPEN —
   * the entry is written before the PR exists. Without this the gate reddens every single ledger PR
   * including the one that introduced it, which is how a check gets switched off in its first week.
   *
   * The exemption is narrow on purpose: it covers exactly the PR whose head is this branch. Any
   * OTHER open PR claimed as done is still a problem, and that is the case worth catching — an entry
   * closed by a PR that never landed.
   */
  selfPr?: number,
): Reconciliation[] {
  return claims.map((claim) => {
    const actual = states.get(claim.pr) ?? 'MISSING';
    let problem: string | null = null;
    if (claim.pr === selfPr && actual === 'OPEN') {
      // Nothing to reconcile yet: this PR is the thing being claimed.
    } else if (actual === 'MISSING') {
      problem = `PR #${claim.pr} does not exist — a wrong number reads as evidence`;
    } else if (claim.claimsDone && actual !== 'MERGED') {
      problem = `claims DONE but PR #${claim.pr} is ${actual}`;
    }
    // No "merged but not marked" rule. An entry may mention a PR for many reasons, and demanding
    // that every mention track its state is how a gate becomes noise — see extractClaims.
    return { claim, actual, problem };
  });
}

/** The PR whose head is the current branch, if one is open. */
function currentBranchPr(): number | undefined {
  try {
    const out = execFileSync('gh', ['pr', 'view', '--json', 'number', '-q', '.number'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out ? Number(out) : undefined;
  } catch {
    return undefined; // no PR for this branch yet — every claim reconciles normally
  }
}

/**
 * Ask GitHub for one PR's state.
 *
 * A failed call is NOT a missing PR, and the first version made exactly that mistake: it caught
 * every error and returned `MISSING`. Observed while testing — a burst of `gh` calls started failing
 * transiently and the tool reported `PR #339 does not exist` about a PR that had merged an hour
 * earlier. A confident wrong diagnosis, produced by the instrument, about the thing it was measuring.
 *
 * So only GitHub's own "no such pull request" counts as missing. Anything else — rate limit, no
 * auth, no network — is an instrument failure and throws, because a reconciliation that cannot reach
 * its authority has not reconciled anything and must not say it did.
 */
function ghState(pr: number): Reconciliation['actual'] {
  try {
    const out = execFileSync('gh', ['pr', 'view', String(pr), '--json', 'state', '-q', '.state'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    if (out === 'MERGED' || out === 'OPEN' || out === 'CLOSED') return out;
    throw new Error(`unexpected state ${JSON.stringify(out)}`);
  } catch (error) {
    const stderr = String((error as { stderr?: Buffer | string }).stderr ?? '') + String((error as Error).message ?? '');
    if (/Could not resolve to a PullRequest|no pull requests found/i.test(stderr)) return 'MISSING';
    throw new Error(
      `check-task-ledger: could not read the state of PR #${pr} — ${stderr.trim().slice(0, 200)}\n` +
        'This is a failure of the check, not a finding about the PR. Refusing to report it as missing.',
    );
  }
}

if (process.argv[1]?.endsWith('check-task-ledger.ts')) {
  const files = ['docs/agent/tasks.md', 'docs/agent/followups.md'].filter(existsSync);
  const claims = files.flatMap((f) => extractClaims(f, readFileSync(f, 'utf8')));
  const prs = [...new Set(claims.map((c) => c.pr))].sort((a, b) => a - b);

  // Printed before any verdict: a run that found no claims and a run that found no problems produce
  // the same "OK" otherwise, and this repo has been bitten by that shape repeatedly.
  console.log(`check-task-ledger: ${claims.length} claims over ${prs.length} PRs in ${files.length} file(s)`);
  if (claims.length === 0) {
    console.error('check-task-ledger: parsed 0 claims. The reference format changed, or the docs are gone.');
    process.exit(1);
  }

  if (process.argv.includes('--offline')) {
    console.log('check-task-ledger: --offline, GitHub not consulted. This proves the docs PARSE, nothing more.');
    process.exit(0);
  }

  const states = new Map(prs.map((pr) => [pr, ghState(pr)] as const));
  const selfPr = currentBranchPr();
  if (selfPr) console.log(`check-task-ledger: this branch is PR #${selfPr}; entries closed by it are not yet reconcilable.`);

  const problems = reconcile(claims, states, selfPr).filter((r) => r.problem);
  // Deduplicated: one line may name the same PR twice (`done=PR#354` plus a mention in the prose),
  // and printing the identical problem twice makes a single fault look like two.
  const seen = new Set<string>();
  for (const r of problems) {
    const key = `${r.claim.where}|${r.problem}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.error(`  ❌ ${r.claim.where}: ${r.problem}`);
  }
  if (seen.size) {
    console.error(`\ncheck-task-ledger: ${seen.size} claim(s) disagree with GitHub.`);
    process.exit(1);
  }
  console.log('check-task-ledger: ✅ every PR claim agrees with GitHub.');
}
