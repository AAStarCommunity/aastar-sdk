/**
 * Every follow-up a PR talks about must be either closed by that PR or explicitly not closed.
 *
 * THE FAILURE THIS CLOSES
 * -----------------------
 * Two entries drifted in one night, both marked open while their work was merged:
 *
 *   FU-31  found and fixed in the SAME pr (#341), so it was written down as a discovery and never
 *          went through `followups.sh done` at all
 *   FU-37  `done` reported "not found" because the entry lived on a branch that had not merged yet,
 *          and coming back to it later never happened
 *
 * Neither carried `done=PR#N`, so `check-task-ledger.ts` was structurally blind to them: that tool
 * asks whether stated claims are TRUE, not whether finished work was ever STATED. Nothing in the
 * repo asked the second question.
 *
 * WHY THIS IS CHECKABLE AT PR TIME AND NOT AT LEDGER TIME
 * ------------------------------------------------------
 * At ledger time there is no general criterion — "the fix is verifiable in the code" is not
 * mechanical. At PR time there is, because the PR knows which number it is: for every `FU-N` its
 * body mentions, either the ledger ON THIS BRANCH marks it done by this PR, or the body says in so
 * many words that it does not close it. Both drift paths are covered — the first because a discovery
 * fixed in place must still be marked in the same tree, the second because the check reads this
 * branch's ledger rather than main's.
 *
 * WHAT IT CANNOT SEE, stated because the narrowing above cost coverage: a PR that fixes a follow-up
 * without CLAIMING to. FU-31's shape is exactly that — the entry was written as a discovery by the
 * PR that fixed it, and the body never said "Closes FU-31". Keyed on any mention it would be
 * covered; keyed on any mention it also reported five non-problems on the first real PR it saw, and
 * a gate nobody can keep green is worth nothing. FU-43 stays open for that half.
 *
 * Also invisible: a PR that fixes a follow-up without mentioning it. That is a narrower gap than
 * the one being closed — "fixed but not mentioned" is rarer than "fixed but not marked" — and the
 * trade is the same one this repo keeps making: replace "remember to" with "it goes red", even when
 * the coverage is partial.
 *
 * Usage:  pnpm exec tsx scripts/check-followup-closure.ts [--pr <n>] [--body-file <path>]
 * Exit 0 when every mentioned follow-up is accounted for; 1 otherwise.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export interface ClosureProblem {
  fu: string;
  detail: string;
}

/**
 * A CLAIM that this PR closes a follow-up — not a mention of one.
 *
 * The first version keyed on any `FU-N` in the body, and its first honest run on a real PR reported
 * five problems, every one of them a narrative reference: #356's body discusses FU-25, FU-31 and
 * FU-37 to explain how the ledger drifted, and asserts nothing about closing them. Requiring an
 * explicit "does not close" for each would make writing a thorough PR body more expensive than
 * writing a thin one — and this repo already recorded what happens to a gate that reports a dozen
 * non-problems on its first run.
 *
 * So the trigger is a closing claim. That is mechanical and unambiguous, and it is what the drift
 * actually looked like: the body said the work was done, and the ledger did not.
 *
 * A GAP THIS SURFACED — and the worst kind, because the gate does not merely miss it, it PUSHES
 * toward the wrong answer:
 *
 * `done=PR#N` names the PR that DID THE WORK, not the PR that wrote the marker. So a bookkeeping-only
 * PR has no honest way to speak here. Say "closes FU-34" and the gate demands `done=PR#<this>` — which
 * would make the ledger claim that a one-line markdown change delivered a `requireStake()` watch.
 * Say nothing and it passes, but that is not quite true either: the entry IS being closed, here.
 *
 * #360 hit exactly this. Its title said "关闭 FU-34" (`关闭` is a CLOSES_CLAIM word) while the entry
 * credits #345. The gate was right to object, and its first prescription — point `done=` at this PR —
 * would have written a falsehood into the ledger. Taking the second (drop the claim) is the correct
 * workaround today.
 *
 * The contract is missing a third kind of statement: "this PR RECORDS that FU-N was closed by #M".
 * Both halves are mechanically checkable — the ledger says `done=PR#M`, and #M is MERGED. Until it
 * exists, a bookkeeping PR must phrase itself as not-closing, which is a workaround and is recorded
 * as such in FU-43. **A gate that pushes people toward a false statement is worse than one that
 * misses the true one.**
 */
const CLOSES_CLAIM = /(?:Closes|Fixes|Resolves|关闭|已修|修复)\s+FU-(\d+)/gi;

/** Every follow-up the body names, for reporting only. */
const FU_MENTION = /\bFU-(\d+)\b/g;

/**
 * A RECORD that some OTHER PR closed the follow-up — the third kind of statement the contract was
 * missing (raised in review on #360).
 *
 * Without it a bookkeeping-only PR has no honest phrasing: claiming closure makes the gate demand
 * `done=PR#<this>`, which would have the ledger assert that a one-line markdown change delivered a
 * `requireStake()` watch; saying nothing passes but is not quite true either.
 *
 * Both halves are mechanically checkable — the ledger must credit #M, and #M must be MERGED — so
 * this is not an escape hatch. It is a claim, held to the same standard as the other one.
 */
// `(\d{1,5})(?!\d)` — not `(\d{3})`. Review measured what the fixed width did: `#99` and `#1345`
// parsed to nothing and were silently unchecked, while `#12345` parsed as `123` and sent the gate
// to verify a PR the author never mentioned. A width that happens to fit today's PR numbers is a
// coincidence, and the failure it produces is the worst kind — not "no answer" but "a confident
// answer about the wrong thing".
const RECORDS_CLAIM = /FU-(\d+)\s*(?:由|由 PR)?\s*#?(\d{1,5})(?!\d)\s*(?:关闭|完成|交付)|records? that FU-(\d+) was closed by #?(\d{1,5})(?!\d)/gi;

/** Parsed `{ fu, by }` pairs from RECORDS_CLAIM, tolerating either language's capture positions. */
export function extractRecords(body: string): { fu: string; by: number }[] {
  // Deduplicated: a body may state the same record in the title and again in the text, and printing
  // `FU-34←#345, FU-34←#345` makes one statement look like two.
  const seen = new Set<string>();
  return [...body.matchAll(RECORDS_CLAIM)]
    .map((m) => ({ fu: `FU-${m[1] ?? m[3]}`, by: Number(m[2] ?? m[4]) }))
    .filter((r) => {
      const k = `${r.fu}|${r.by}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

/** An explicit refusal to close, in either language. */
const NOT_CLOSING = (fu: string) =>
  new RegExp(`(does not close|not closed by this|不关闭|暂不关闭|不 ?close)[^\\n]{0,80}${fu}|${fu}[^\\n]{0,80}(does not close|not closed by this|不关闭|暂不关闭)`, 'i');

/**
 * Compare a PR body against the ledger on this branch.
 *
 * `prNumber` is what makes the "closed by THIS pr" half meaningful; without it the check can only
 * ask whether the entry is closed at all, which a stale `done=PR#<something else>` would satisfy.
 */
/**
 * Is this claim being QUOTED rather than made?
 *
 * The first attempt at this used "does the line cite another PR number" as the signal, and it was
 * wrong in both directions — review measured all four:
 *
 *   "Closes FU-99 (found in review of #350)"   dropped, and it IS a claim
 *   "Closes FU-40 · src=PR#341"                dropped — and `src=PR#N` is this ledger's own
 *                                              standard notation, so the gate would go silent on an
 *                                              entirely ordinary line
 *   «评审说「Closes FU-99」,我不同意»            reported, and it is NOT a claim
 *   "> Closes FU-99"                           reported — and a leading `>` is how markdown quotes,
 *                                              which every review message in this repo uses
 *
 * The general shape of the mistake: having found the right COORDINATE (who is claiming), I measured
 * it with a correlated but different quantity (does the line name another PR). A correlated quantity
 * gives the right answer on most samples, which is exactly why it survives inspection.
 *
 * So attribution is judged by the syntax of quotation: a blockquote line, or the claim enclosed in
 * 「」/""/backticks. Everything else is a claim, including one that mentions where it came from.
 */
function isQuoted(line: string, claimIndex: number): boolean {
  if (/^\s*>/.test(line)) return true;
  // Enclosure: look for an opening quote mark before the claim and a closing one after it, on the
  // same line. Deliberately literal — this is not trying to parse markdown, only to recognise the
  // handful of forms that actually appear.
  const before = line.slice(0, claimIndex);
  const after = line.slice(claimIndex);
  const pairs: [string, string][] = [['「', '」'], ['"', '"'], ['`', '`'], ['“', '”'], ["'", "'"]];
  return pairs.some(([open, close]) => before.includes(open) && after.includes(close));
}

export function checkClosure(
  body: string,
  ledger: string,
  prNumber: number | undefined,
  /** States of PRs cited by a RECORDS claim, so "closed by #M" can be held to #M actually merging. */
  citedPrStates: ReadonlyMap<number, 'MERGED' | 'OPEN' | 'CLOSED' | 'MISSING'> = new Map(),
): ClosureProblem[] {
  const records = extractRecords(body);
  const claimed = [...new Set(
    body
      .split('\n')
      .flatMap((line) =>
        [...line.matchAll(CLOSES_CLAIM)]
          .filter((m) => !isQuoted(line, m.index ?? 0))
          .map((m) => `FU-${m[1]}`),
      ),
  )];
  const problems: ClosureProblem[] = [];

  // A RECORDS claim is checked on its own terms: the ledger must credit the PR named, and that PR
  // must have merged. Recording a closure by a PR that never landed is the same defect as claiming
  // one yourself without doing the work.
  for (const { fu, by } of records) {
    const line = ledger.split('\n').find((l) => new RegExp(`^- \\[[ x]\\] ${fu} `).test(l));
    if (!line) {
      problems.push({ fu, detail: `the body records ${fu} as closed by #${by}, but no such entry exists in the ledger on this branch` });
      continue;
    }
    if (!line.startsWith('- [x]') || !line.includes(`done=PR#${by}`)) {
      problems.push({
        fu,
        detail: `the body records ${fu} as closed by #${by}, but the ledger on this branch does not credit #${by} — ` +
          'mark it "- [x] … done=PR#' + by + '" here, or correct the PR number',
      });
      continue;
    }
    const state = citedPrStates.get(by);
    if (state !== undefined && state !== 'MERGED') {
      problems.push({ fu, detail: `the body records ${fu} as closed by #${by}, but #${by} is ${state} — a PR that has not landed closed nothing` });
    }
  }

  for (const fu of claimed) {
    const line = ledger.split('\n').find((l) => new RegExp(`^- \\[[ x]\\] ${fu} `).test(l));
    if (!line) {
      problems.push({ fu, detail: `the body says this PR closes ${fu}, but no such entry exists in the ledger on this branch` });
      continue;
    }
    const closedByThisPr = prNumber !== undefined && line.startsWith('- [x]') && line.includes(`done=PR#${prNumber}`);
    if (closedByThisPr) continue;
    if (NOT_CLOSING(fu).test(body)) continue;

    problems.push({
      fu,
      detail: line.startsWith('- [x]')
        ? `the body says this PR closes ${fu}, but the ledger credits another PR — point done= at this PR, ` +
          'or drop the claim'
        : `the body says this PR closes ${fu}, but the ledger on this branch still has it open: mark it ` +
          `"- [x] … done=PR#${prNumber ?? '<n>'}" here, or say the PR does not close it`,
    });
  }
  return problems;
}

function prBody(): { body: string; number: number | undefined } {
  const argv = process.argv.slice(2);
  const fileArg = argv.includes('--body-file') ? argv[argv.indexOf('--body-file') + 1] : null;
  const prArg = argv.includes('--pr') ? Number(argv[argv.indexOf('--pr') + 1]) : undefined;
  if (fileArg) return { body: readFileSync(fileArg, 'utf8'), number: prArg };

  // The event knows which PR this is; git does not, and on CI HEAD is detached (see #354).
  const fromEnv = process.env.PR_NUMBER || /^refs\/pull\/(\d+)\//.exec(process.env.GITHUB_REF ?? '')?.[1];
  const number = prArg ?? (fromEnv && Number.isFinite(Number(fromEnv)) ? Number(fromEnv) : undefined);
  if (number === undefined) return { body: '', number: undefined };

  const out = execFileSync('gh', ['pr', 'view', String(number), '--json', 'body,title', '-q', '.title + "\\n" + .body'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { body: out, number };
}

if (process.argv[1]?.endsWith('check-followup-closure.ts')) {
  const LEDGER = 'docs/agent/followups.md';
  if (!existsSync(LEDGER)) {
    console.error(`check-followup-closure: no ledger at ${LEDGER}`);
    process.exit(1);
  }
  const { body, number } = prBody();
  if (!body) {
    // Not a PR run. Said out loud: a silent pass here and a real pass look identical.
    console.log('check-followup-closure: no PR body available (not a pull_request run) — nothing checked.');
    process.exit(0);
  }
  // States of any PR a RECORDS claim cites, so "closed by #M" is held to #M having merged.
  const cited = new Map<number, 'MERGED' | 'OPEN' | 'CLOSED' | 'MISSING'>();
  for (const { by } of extractRecords(body)) {
    if (cited.has(by)) continue;
    try {
      const out = execFileSync('gh', ['pr', 'view', String(by), '--json', 'state', '-q', '.state'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
      cited.set(by, out === 'MERGED' || out === 'OPEN' || out === 'CLOSED' ? out : 'MISSING');
    } catch (error) {
      // Same discipline as everywhere else in this file: a failed call is not an answer. Only
      // GitHub's own "no such PR" counts as missing; anything else means the check could not run.
      const stderr = String((error as { stderr?: Buffer | string }).stderr ?? '') + String((error as Error).message ?? '');
      if (/Could not resolve to a PullRequest/i.test(stderr)) cited.set(by, 'MISSING');
      else throw new Error(`check-followup-closure: could not read the state of the cited PR #${by} — ${stderr.trim().slice(0, 160)}`);
    }
  }

  const problems = checkClosure(body, readFileSync(LEDGER, 'utf8'), number, cited);
  const mentioned = [...new Set([...body.matchAll(FU_MENTION)].map((m) => `FU-${m[1]}`))];
  // Both lines below say CLAIMS, not mentions. They used to say "mentioned", while `problems` only
  // ever examined closing claims — a success message asserting something it had not checked, which
  // is the exact failure this repo spent a night hunting, sitting in the tool built to hunt it.
  //
  // The mention list is still printed, because it is the input a reader needs to judge the verdict:
  // a PR may mention ten follow-ups and claim to close one, and only the second number is checked.
  console.log(`check-followup-closure: PR #${number} mentions ${mentioned.length} follow-up(s): ${mentioned.join(', ') || '(none)'}`);
  const claims = [...new Set([...body.matchAll(CLOSES_CLAIM)].map((m) => `FU-${m[1]}`))];
  const recs = extractRecords(body);
  console.log(`check-followup-closure: of those, ${claims.length} are CLAIMED closed by this PR: ${claims.join(', ') || '(none)'}`);
  console.log(`check-followup-closure: and ${recs.length} are RECORDED as closed by another PR: ${recs.map((r) => `${r.fu}←#${r.by}`).join(', ') || '(none)'}`);
  console.log('check-followup-closure: only those two groups are checked.');
  for (const p of problems) console.error(`  ❌ ${p.detail}`);
  if (problems.length) {
    console.error(`\ncheck-followup-closure: ${problems.length} follow-up(s) CLAIMED closed but not accounted for.`);
    process.exit(1);
  }
  console.log(
    'check-followup-closure: ✅ every follow-up this PR CLAIMS to close is closed here or explicitly deferred.\n' +
      '   Follow-ups merely MENTIONED are not checked — see the list above and judge them yourself.',
  );
}
