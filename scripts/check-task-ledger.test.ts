/**
 * The reconciliation rules, and the false positives that shaped them.
 *
 * The parsing and comparison are pure functions so they can be tested without GitHub; the network
 * half is one `gh` call whose only job is to fill a map. That split is deliberate — a check whose
 * logic can only be exercised by hitting a live API gets exercised once, on the day it is written.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { extractClaims, reconcile, type Claim } from './check-task-ledger.js';

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

describe('determining WHICH pr this run is', () => {
  it('a failure to answer must not be reported as "no PR"', () => {
    // Not a unit test of the function — it shells out — but a pin on the property, stated where the
    // next person edits the rules. Measured on this PR's own CI: `actions/checkout@v5` leaves a
    // detached HEAD, `gh pr view` had no branch to resolve, the catch turned that into "this branch
    // has no PR", the self-PR exemption never applied, and the gate reddened the PR that introduced
    // it. Identical to the `ghState` bug fixed in the same file the same hour.
    //
    // The regression that matters is behavioural and lives in the runner: PR_NUMBER first, then a
    // branch check that refuses when HEAD is detached, and only GitHub's own words counting as "no".
    const source = readFileSync('scripts/check-task-ledger.ts', 'utf8');
    expect(source, 'the event must be consulted before git').toContain('process.env.PR_NUMBER');
    expect(source, 'a detached HEAD must be refused, not guessed at').toContain('HEAD is detached');
    // A push run belongs to no PR by definition; answering that from whether HEAD happens to be
    // attached would make the gate depend on how the runner checked the repo out.
    expect(source, 'a push run must be recognised directly').toContain("GITHUB_EVENT_NAME === 'push'");
    // stderr must be captured on BOTH gh calls — discarding it is what made the two bugs possible.
    expect(source.match(/stdio: \['ignore', 'pipe', 'pipe'\]/g) ?? []).toHaveLength(3);
    expect(source).not.toContain("stdio: ['ignore', 'pipe', 'ignore']");
  });
});
