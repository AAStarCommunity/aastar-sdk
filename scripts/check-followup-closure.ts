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
 */
const CLOSES_CLAIM = /(?:Closes|Fixes|Resolves|关闭|已修|修复)\s+FU-(\d+)/gi;

/** Every follow-up the body names, for reporting only. */
const FU_MENTION = /\bFU-(\d+)\b/g;

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
 * Lines that QUOTE someone else's closing claim rather than making one.
 *
 * Found by running this gate against its own PR: the body of #357 says «#356 正文「Closes FU-32」»
 * — reporting what another PR claimed, while explaining how the ledger drifted — and the gate read
 * it as #357 claiming to close FU-32.
 *
 * The rule had narrowed from "any mention" to "a closing claim" and still missed a coordinate: WHO
 * is claiming. A line that names another PR number alongside the claim is describing that PR, not
 * this one. Narrow, and deliberately so — it does not try to parse attribution in general, only to
 * recognise the one form that actually occurs here, which is a line that cites a PR by number.
 */
const QUOTES_ANOTHER_PR = /(?:PR\s*)?#\d+/;

export function checkClosure(body: string, ledger: string, prNumber: number | undefined): ClosureProblem[] {
  const claimed = [...new Set(
    body
      .split('\n')
      .flatMap((line) => {
        const hits = [...line.matchAll(CLOSES_CLAIM)].map((m) => `FU-${m[1]}`);
        if (hits.length === 0) return [];
        // A line citing another PR number is quoting that PR's claim, not making one — unless the
        // number cited IS this PR.
        const cited = line.match(new RegExp(QUOTES_ANOTHER_PR, 'g')) ?? [];
        const citesOther = cited.some((c) => Number(c.replace(/\D/g, '')) !== prNumber);
        return citesOther ? [] : hits;
      }),
  )];
  const problems: ClosureProblem[] = [];

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
  const problems = checkClosure(body, readFileSync(LEDGER, 'utf8'), number);
  const mentioned = [...new Set([...body.matchAll(FU_MENTION)].map((m) => `FU-${m[1]}`))];
  console.log(`check-followup-closure: PR #${number} mentions ${mentioned.length} follow-up(s): ${mentioned.join(', ') || '(none)'}`);
  for (const p of problems) console.error(`  ❌ ${p.detail}`);
  if (problems.length) {
    console.error(`\ncheck-followup-closure: ${problems.length} follow-up(s) mentioned but not accounted for.`);
    process.exit(1);
  }
  console.log('check-followup-closure: ✅ every mentioned follow-up is closed here or explicitly deferred.');
}
