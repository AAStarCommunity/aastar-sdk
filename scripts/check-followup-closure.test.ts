/**
 * The closure gate, exercised by replaying the two drifts that produced it.
 *
 * Neither was a lapse of care — both had a moment where the bookkeeping COULD be deferred, and a
 * deferrable step gets deferred on a long night. That is what makes a gate the right answer here
 * rather than a reminder.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { checkClosure } from './check-followup-closure.js';

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
