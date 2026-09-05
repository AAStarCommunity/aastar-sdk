/**
 * The reconciliation rules, and the false positives that shaped them.
 *
 * The parsing and comparison are pure functions so they can be tested without GitHub; the network
 * half is one `gh` call whose only job is to fill a map. That split is deliberate — a check whose
 * logic can only be exercised by hitting a live API gets exercised once, on the day it is written.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { extractClaims, reconcile, resolveSelfPrFromEnv, type Claim } from './check-task-ledger.js';

const states = (m: Record<number, 'MERGED' | 'OPEN' | 'CLOSED'>) =>
  new Map(Object.entries(m).map(([k, v]) => [Number(k), v] as const));

describe('what counts as a claim', () => {
  it('`src=PR#N` is a citation, not a claim about that PR', () => {
    // The false positive that rewrote these rules. The first version flagged 24 lines like this one,
    // every one of them saying only "this follow-up came out of that review".
    const claims = extractClaims('f.md', '- [ ] FU-30 · C · src=PR#339 round-3 · text');
    expect(claims).toEqual([]);
  });

  it('`done=PR#N` claims that PR merged', () => {
    const [c] = extractClaims('f.md', '- [x] FU-9 · B · src=PR#1 · text · done=PR#347');
    expect(c).toMatchObject({ pr: 347, claimsDone: true });
  });

  it('a line marked DONE claims the PRs it names', () => {
    const [c] = extractClaims('t.md', '### T5.1.3 SP 侧回归 (PR #333)  `DONE`');
    expect(c).toMatchObject({ pr: 333, claimsDone: true });
  });

  it('a bare mention claims only that the PR exists', () => {
    const [c] = extractClaims('t.md', '- **依赖**：无（已随 PR #288 落地）');
    expect(c).toMatchObject({ pr: 288, claimsDone: false });
  });

  it('several PRs on one line are each their own claim', () => {
    expect(extractClaims('f.md', 'see PR #1 and PR#2').map((c) => c.pr)).toEqual([1, 2]);
  });
});

describe('reconciliation', () => {
  const claim = (pr: number, claimsDone: boolean): Claim => ({ where: 'f.md:1', pr, claimsDone });

  it('claiming DONE against an unmerged PR is the strongest problem', () => {
    const [r] = reconcile([claim(10, true)], states({ 10: 'OPEN' }));
    expect(r.problem).toMatch(/claims DONE but PR #10 is OPEN/);
  });

  it('a claim on a PR that does not exist is a problem', () => {
    // A typo'd number reads as evidence; nothing else in the repo would notice.
    const [r] = reconcile([claim(999999, true)], states({}));
    expect(r.problem).toMatch(/does not exist/);
  });

  it('a merged PR mentioned without a DONE marker is NOT a problem', () => {
    // Deliberate, and the reason the first version was unusable: entries cite PRs for many reasons.
    // A gate that reports two dozen non-problems on its first honest run gets deleted before it ever
    // catches the real one.
    const [r] = reconcile([claim(20, false)], states({ 20: 'MERGED' }));
    expect(r.problem).toBeNull();
  });

  it('claiming DONE against a merged PR is fine', () => {
    expect(reconcile([claim(30, true)], states({ 30: 'MERGED' }))[0].problem).toBeNull();
  });

  it('CLOSED is not MERGED — an abandoned PR cannot close a task', () => {
    const [r] = reconcile([claim(40, true)], states({ 40: 'CLOSED' }));
    expect(r.problem).toMatch(/is CLOSED/);
  });
});

describe('the real ledgers parse', () => {
  it('both files yield a non-trivial number of claims', () => {
    // The instrument check: "no problems" from a parser that matched nothing looks identical to
    // "no problems" from ledgers that agree. Network reconciliation is not done here — that belongs
    // to the runner, which CI invokes with `gh` available.
    const claims = ['docs/agent/tasks.md', 'docs/agent/followups.md'].flatMap((f) =>
      extractClaims(f, readFileSync(f, 'utf8')),
    );
    expect(claims.length).toBeGreaterThan(20);
    expect(new Set(claims.map((c) => c.pr)).size).toBeGreaterThan(10);
  });
});

describe('the self-PR exemption is narrow', () => {
  const claim = (pr: number): Claim => ({ where: 'f.md:1', pr, claimsDone: true });

  it('an entry closed by THIS PR is not yet reconcilable', () => {
    // Without this the gate reddens every ledger PR including the one that introduced it — an entry
    // is written before its PR exists, so it necessarily claims DONE against something still OPEN.
    expect(reconcile([claim(354)], states({ 354: 'OPEN' }), 354)[0].problem).toBeNull();
  });

  it('…but ANOTHER open PR claimed as done is still a problem', () => {
    // The case worth catching: an entry closed by a PR that never landed. If the exemption widened
    // to every OPEN pr, this goes green and the check stops meaning anything.
    expect(reconcile([claim(353)], states({ 353: 'OPEN' }), 354)[0].problem).toMatch(/claims DONE but PR #353 is OPEN/);
  });

  it('the self PR still has to EXIST', () => {
    // A typo that happens to equal the current PR number is not a thing, but a self PR that is
    // CLOSED rather than open is: the exemption covers "not merged yet", not "abandoned".
    expect(reconcile([claim(354)], states({ 354: 'CLOSED' }), 354)[0].problem).toMatch(/is CLOSED/);
  });
});

describe('the source-level rule that IS textual', () => {
  it('no gh call may discard stderr', () => {
    // This one carries weight, and the reason is worth stating because a neighbouring assertion did
    // not: the property being pinned IS a spelling. `stdio: ['ignore','pipe','ignore']` throws away
    // the text that distinguishes "GitHub says no" from "the call failed", and that discarding is
    // visible in the source and nowhere else — no runtime observation of a healthy run reveals it.
    //
    // Its neighbour asserted that the source contained "GITHUB_EVENT_NAME === 'push'" and claimed to
    // pin a RUNTIME property. Review commented the real check out; the characters survived in the
    // comment, the behaviour did not, and every test stayed green. Deleted — the behavioural cases
    // below replace it. Compare `@ts-expect-error` elsewhere in this repo: it also looks textual and
    // is not — it asserts the compiler's behaviour, and goes red (TS2578) when the error stops.
    const source = readFileSync('scripts/check-task-ledger.ts', 'utf8');
    expect(source.match(/stdio: \['ignore', 'pipe', 'pipe'\]/g) ?? []).toHaveLength(3);
    expect(source).not.toContain("stdio: ['ignore', 'pipe', 'ignore']");
  });
});


describe('which PR this run belongs to — decided from the environment', () => {
  // Behavioural, not textual. Commenting out any branch below makes one of these red; commenting it
  // out used to make nothing red.
  it('a push run belongs to no PR, whatever the checkout looks like', () => {
    // The case that would otherwise fall through to the branch check and throw on a detached
    // checkout — reddening main after merge, which is not something to discover after merging.
    expect(resolveSelfPrFromEnv({ GITHUB_EVENT_NAME: 'push' })).toBeNull();
    expect(resolveSelfPrFromEnv({ GITHUB_EVENT_NAME: 'push', PR_NUMBER: '' })).toBeNull();
  });

  it('PR_NUMBER wins when the event supplies it', () => {
    expect(resolveSelfPrFromEnv({ PR_NUMBER: '354', GITHUB_EVENT_NAME: 'pull_request' })).toBe(354);
  });

  it('GITHUB_REF is the fallback for pull_request runs', () => {
    expect(resolveSelfPrFromEnv({ GITHUB_REF: 'refs/pull/354/merge' })).toBe(354);
    expect(resolveSelfPrFromEnv({ GITHUB_REF: 'refs/heads/main' })).toBe('ask-git');
  });

  it('an empty or nonsense PR_NUMBER does not become a PR number', () => {
    // `''` is what the workflow renders on a push event, and `Number('') === 0` — a falsy guard that
    // only checked presence would turn that into PR #0.
    expect(resolveSelfPrFromEnv({ PR_NUMBER: '' })).toBe('ask-git');
    expect(resolveSelfPrFromEnv({ PR_NUMBER: 'nope' })).toBe('ask-git');
  });

  it('with nothing to go on, it says so rather than guessing', () => {
    expect(resolveSelfPrFromEnv({})).toBe('ask-git');
  });
});

describe('FU-56 — two model gaps, both hit on the same real entry', () => {
    const claims = (line: string) => extractClaims('l.md', line);

    describe('gap 1: "closed because we decided NOT to act" had no category', () => {
        it('`decided=PR#N` on a DONE line is not a claim that #N merged', () => {
            // FU-2's shape: the follow-up is resolved BY A DECISION to keep its PR open. Under the
            // old rules the `[x]` made every PR number on the line read as "claims merged", and the
            // gate was right to complain — the ledger had no way to say what actually happened.
            expect(claims('- [x] FU-2 · decided=PR#15 · keep it, deliberately not merged')).toEqual([]);
        });

        it('POSITIVE CONTROL: `done=PR#N` on the same line SHAPE still claims merged', () => {
            // Without this, the assertion above would also pass if `decided=` had accidentally
            // disabled claim extraction for the whole line — silently blinding the gate is a far
            // worse outcome than the gap it was added to close.
            const c = claims('- [x] FU-9 · done=PR#347 · shipped');
            expect(c).toHaveLength(1);
            expect(c[0]).toMatchObject({ pr: 347, claimsDone: true });
        });

        it('a bare PR number on a DONE line STILL claims merged — the old rule is intact', () => {
            const c = claims('- [x] FU-x · closed by PR #123');
            expect(c).toHaveLength(1);
            expect(c[0]).toMatchObject({ pr: 123, claimsDone: true });
        });
    });

    describe('gap 2: a regex cannot tell MENTIONING a form from USING it', () => {
        it('a backtick-quoted PR reference asserts nothing', () => {
            // Explaining rule 3 inside the ledger — quoting the shape it forbids as a
            // counter-example — used to trip rule 3. You cannot cite a rule inside the medium that
            // rule polices.
            expect(claims('- [x] FU-56 · the rule is: a bare `PR #123` on a DONE line claims merged')).toEqual([]);
        });

        it('POSITIVE CONTROL: the SAME reference outside backticks is still a claim', () => {
            // The pair matters more than either half: it separates "quoting is ignored" from
            // "this line is ignored".
            const c = claims('- [x] FU-56 · the rule is: a bare PR #123 on a DONE line claims merged');
            expect(c).toHaveLength(1);
            expect(c[0]).toMatchObject({ pr: 123, claimsDone: true });
        });

        it('a quoted reference and a real one on the SAME line: only the real one counts', () => {
            // NOT a length-preservation test, though an earlier version of this claimed to be one.
            // Mutating the mask to '' (shortening the line) left it green: `where` is line-based, so
            // column drift is currently unobservable and nothing here can guard it. The padding in
            // maskCodeSpans is kept because it costs nothing and stays correct if positions are ever
            // reported — but a test must not claim to protect what it cannot see.
            const line = '- [x] a `PR #1` b PR #2';
            const c = claims(line);
            expect(c).toHaveLength(1);
            expect(c[0].pr).toBe(2);
        });

        it('KNOWN FAIL-OPEN: a backticked `done=` is swallowed — pinned, not endorsed', () => {
            // #372 review found this direction had no test. Masking cannot tell a quotation from a
            // use, so a `done=PR#N` written inside backticks stops being a claim — and the gate says
            // nothing, it just checks one fewer thing and prints green. **Silent under-counting is
            // the failure mode a gate cannot report on itself.**
            //
            // Pinned as-is rather than "fixed", and the reason is a trade-off not an omission:
            // un-masking `done=` would re-open the bug this masking exists to close (documenting the
            // rule inside the ledger tripped the rule). Today the shape occurs ZERO times in the real
            // ledgers. This test is here so the next person meets the behaviour deliberately instead
            // of discovering it as a missing red.
            expect(claims('- [x] FU-x · `done=PR#347` shown as an example of the syntax')).toEqual([]);
        });

        it('POSITIVE CONTROL: the same `done=` outside backticks is still counted', () => {
            // Separates "backticked claims are dropped" from "done= stopped working".
            const c = claims('- [x] FU-x · done=PR#347');
            expect(c).toHaveLength(1);
            expect(c[0]).toMatchObject({ pr: 347, claimsDone: true });
        });

        it('an unclosed backtick does not swallow the rest of the line', () => {
            // A greedy or unterminated mask would blind everything after a stray backtick — the kind
            // of quiet coverage loss that shows up as "the gate stopped finding anything".
            const c = claims('- [x] FU-x · stray ` then PR #7');
            expect(c).toHaveLength(1);
            expect(c[0].pr).toBe(7);
        });
    });
});
