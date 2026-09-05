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
