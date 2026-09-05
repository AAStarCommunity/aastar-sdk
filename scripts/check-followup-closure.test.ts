/**
 * The closure gate, exercised by replaying the two drifts that produced it.
 *
 * Neither was a lapse of care — both had a moment where the bookkeeping COULD be deferred, and a
 * deferrable step gets deferred on a long night. That is what makes a gate the right answer here
 * rather than a reminder.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { checkClosure, extractRecords } from './check-followup-closure.js';

const open = (n: number) => `- [ ] FU-${n} · B · src=x · 2026-09-05 · text`;
const doneBy = (n: number, pr: number) => `- [x] FU-${n} · B · src=x · 2026-09-05 · text · done=PR#${pr}`;

describe('the two drifts this was built from', () => {
  it('FU-31 shape is NOT covered — recorded, not asserted away', () => {
    // The entry was written down as a DISCOVERY by the PR that also fixed it, so it never passed
    // through `followups.sh done`. The body mentions it; the ledger on this branch says open.
    // NOTE the fixture ledger carries BOTH ids the body names. A first draft named FU-5 in the body
    // and left it out of the ledger, and the gate reported two problems instead of one — catching a
    // gap in the test rather than in the code. Left as a comment because it is the same shape the
    // gate exists for: a mention with nothing behind it.
    // The entry was written as a DISCOVERY by the PR that also fixed it, and that body never says
    // "Closes FU-31" — it says "New: FU-31". Keyed on any mention this would be caught; keyed on any
    // mention the gate also reported five non-problems against the first real PR it saw. The
    // narrowing bought usability and cost this case, and pretending otherwise would make the gate
    // look stronger than it is. FU-43 stays open for this half.
    const ledger = [doneBy(5, 341), open(31)].join('\n');
    expect(checkClosure('Closes FU-5. New: FU-31 — scripts tests never ran in CI.', ledger, 341)).toEqual([]);
  });

  it('FU-37 shape: the entry lives on this branch, so main having it is irrelevant', () => {
    // `followups.sh done` reported "not found" because the entry was on an unmerged branch. This
    // check reads the ledger ON THIS BRANCH, which is where the entry actually is.
    expect(checkClosure('Closes FU-37.', [doneBy(37, 348)].join('\n'), 348)).toEqual([]);
  });

  it('closed by a DIFFERENT PR is not the same as closed by this one', () => {
    // Otherwise a stale `done=PR#<something else>` would satisfy the check — the exact shape of a
    // marker that was copied rather than earned.
    const problems = checkClosure('Closes FU-37.', [doneBy(37, 348)].join('\n'), 999);
    expect(problems[0].detail).toMatch(/the ledger credits another PR/);
  });
});

describe('the deliberate escape hatch', () => {
  it('an explicit refusal to close is accepted, in English', () => {
    expect(checkClosure('This PR does not close FU-38 — it needs a CI secret.', [open(38)].join('\n'), 1)).toEqual([]);
  });

  it('…and in Chinese, because that is what the bodies in this repo are written in', () => {
    expect(checkClosure('顺带记 FU-40，本 PR 不关闭 FU-40，需要问 DVT 侧。', [open(40)].join('\n'), 1)).toEqual([]);
  });

  it('a NARRATIVE mention is not a claim, and must not be reported', () => {
    // The narrowing that made this usable. Keyed on any mention, the first real PR it ran against
    // produced five problems — every one a body explaining how the ledger drifted, asserting nothing
    // about closing anything. Requiring an explicit refusal for each would make a thorough PR body
    // more expensive to write than a thin one.
    expect(checkClosure('Same family as FU-33 and FU-36.', [open(33), open(36)].join('\n'), 1)).toEqual([]);
  });

  it('but a CLAIM with nothing behind it is', () => {
    // The other side of that narrowing: the trigger is the claim, and the claim still has to be true.
    expect(checkClosure('Closes FU-33.', [open(33)].join('\n'), 1)).toHaveLength(1);
  });

  it.each(['Closes FU-9', 'Fixes FU-9', 'Resolves FU-9', '关闭 FU-9', '修复 FU-9'])(
    '%s counts as a claim',
    (phrase) => {
      // Enumerated rather than exampled: the bodies in this repo are written in both languages, and a
      // phrasing the matcher does not know is a silent way past the gate.
      expect(checkClosure(phrase, [open(9)].join('\n'), 1)).toHaveLength(1);
    },
  );
});

describe('edges', () => {
  it('a follow-up mentioned but absent from the ledger is reported', () => {
    // Catches a typo'd number, which otherwise reads as a reference to work that does not exist.
    expect(checkClosure('Closes FU-999.', [open(1)].join('\n'), 1)[0].detail).toMatch(/no such entry exists/);
  });

  it('mentioning the same id twice is one problem, not two', () => {
    expect(checkClosure('Closes FU-5 … and again Closes FU-5.', [open(5)].join('\n'), 1)).toHaveLength(1);
  });

  it('a body mentioning nothing passes', () => {
    expect(checkClosure('A routine dependency bump.', [open(1)].join('\n'), 1)).toEqual([]);
  });

  it('without a PR number, "closed by this PR" cannot be satisfied', () => {
    // Stated rather than left implicit: the number is what makes the check mean anything, and #354
    // is what makes it available on CI at all.
    expect(checkClosure('Closes FU-5.', [doneBy(5, 341)].join('\n'), undefined)[0].detail).toMatch(/credits another PR/);
  });
});

describe('the real ledger', () => {
  it('parses, and the entry format this gate depends on still matches', () => {
    // Instrument check: every assertion above uses synthetic lines, so a change to the real entry
    // format would leave them all green while the gate stopped recognising anything.
    const ledger = readFileSync('docs/agent/followups.md', 'utf8');
    const closed = ledger.split('\n').filter((l) => /^- \[x\] FU-\d+ /.test(l));
    expect(closed.length, 'the ledger must contain closed entries in the shape this gate matches').toBeGreaterThan(5);
    expect(closed.some((l) => /done=PR#\d+/.test(l)), 'and at least one must carry done=PR#N').toBe(true);
  });
});

describe('who is claiming — judged by quotation syntax, not by PR numbers', () => {
  // Two rounds of narrowing, both found by running on real text. The second narrowing used "does the
  // line cite another PR number" as the signal for "someone else is claiming" — a correlated but
  // DIFFERENT quantity, wrong in both directions. All four cases below were measured in review.
  //
  // The lesson generalises past this file: having found the right coordinate, ask whether the thing
  // measuring it IS that coordinate. A correlated quantity is right on most samples, which is
  // exactly why it survives inspection.
  const ledger = [open(99)].join('\n');

  it('CONTROL: a plain claim is reported', () => {
    // Without this the four cases below cannot be told from a check that reports nothing at all.
    expect(checkClosure('Closes FU-99', ledger, 357)).toHaveLength(1);
  });

  it.each([
    ['citing where it came from', 'Closes FU-99 (found in review of #350)'],
    ['the ledger\'s own src= notation', 'Closes FU-99 · src=PR#341'],
  ])('%s is still a claim', (_label, body) => {
    // The miss direction. `src=PR#N` is this ledger's standard notation, so the old rule went silent
    // on an entirely ordinary line — a gate that fails quietly on house style is worse than none.
    expect(checkClosure(body, ledger, 357)).toHaveLength(1);
  });

  it.each([
    ['enclosed in 「」', '评审说「Closes FU-99」，我不同意'],
    ['a markdown blockquote', '> Closes FU-99'],
    ['enclosed in backticks', 'the body said `Closes FU-99` and the ledger disagreed'],
  ])('%s is a quotation, not a claim', (_label, body) => {
    // The false-positive direction. A leading `>` is how markdown quotes, and every review message
    // in this repo uses it — this gate would have fired on the next PR that quoted a review.
    expect(checkClosure(body, ledger, 357)).toEqual([]);
  });

  it('a claim that cites THIS PR is still a claim', () => {
    expect(checkClosure('Closes FU-99 — see #357 for the reasoning.', ledger, 357)).toHaveLength(1);
  });
});

describe('the third kind of statement: recording someone else\'s closure', () => {
  // Raised in review on #360, and it is the gap that mattered most: a bookkeeping-only PR had NO
  // honest phrasing. Claiming closure made the gate demand `done=PR#<this>` — which would have the
  // ledger assert that a one-line markdown change delivered a `requireStake()` watch. Saying nothing
  // passed, but was not quite true either.
  //
  // It is a CLAIM, not an escape hatch: both halves are checked.
  const done = (n: number, by: number) => `- [x] FU-${n} · B · src=x · 2026-09-05 · text · done=PR#${by}`;
  const merged = new Map<number, 'MERGED' | 'OPEN' | 'CLOSED' | 'MISSING'>([[345, 'MERGED'], [999, 'OPEN']]);

  it('a correct record passes', () => {
    expect(checkClosure('本 PR 记录 FU-34 由 #345 关闭。', done(34, 345), 360, merged)).toEqual([]);
    expect(checkClosure('This PR records that FU-34 was closed by #345.', done(34, 345), 360, merged)).toEqual([]);
  });

  it('the ledger must actually credit the PR named', () => {
    // Otherwise the record is just another way to say "trust me".
    expect(checkClosure('本 PR 记录 FU-34 由 #345 关闭。', done(34, 341), 360, merged)[0].detail).toMatch(/does not credit #345/);
  });

  it('and that PR must have merged — a PR that never landed closed nothing', () => {
    expect(checkClosure('本 PR 记录 FU-34 由 #999 关闭。', done(34, 999), 360, merged)[0].detail).toMatch(/#999 is OPEN/);
  });

  it('a record for a follow-up with no ledger entry is reported', () => {
    expect(checkClosure('本 PR 记录 FU-77 由 #345 关闭。', done(34, 345), 360, merged)[0].detail).toMatch(/no such entry exists/);
  });

  it.each([
    ['narrative about where a follow-up came from', '这条跟进项来自 PR#343 的评审，与 FU-16 同族。'],
    ['quoting another PR\'s closing claim', '#356 正文写「Closes FU-32」而账本未标记。'],
    ['a ledger line pasted into the body', '- [x] FU-34 · B · src=PR#343 · done=PR#345'],
  ])('%s is not a record', (_label, text) => {
    // Measured against the last 19 real PR bodies: zero hits. These three are the shapes that come
    // closest, constructed because the real corpus could not distinguish a working pattern from one
    // that matches nothing.
    expect(extractRecords(text)).toEqual([]);
  });
});
