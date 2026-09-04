/**
 * The ledger gate, including the case it was written for.
 *
 * FU-26 was filed after two branches minted `FU-22` on the same evening. Its original description
 * said the merge would pass silently; measured, it does not — both entries append at end of file, so
 * git conflicts. That correction matters, because it moves the problem: the LOUD half is the merge,
 * the silent half is the resolution. Taking the union is the right call — both entries are real
 * work — and two entries with the same id then coexist with nothing objecting.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { checkLedger } from './check-followups.js';

const ok = (id: number, state = ' ') => `- [${state}] FU-${id} · B · src=x · 2026-09-05 · text`;

describe('duplicate ids', () => {
  it('the FU-26 case: two branches minted the same id and the union kept both', () => {
    const problems = checkLedger([ok(21), ok(22), ok(22), ok(23)].join('\n'));
    expect(problems).toHaveLength(1);
    expect(problems[0].kind).toBe('duplicate-id');
    expect(problems[0].detail).toMatch(/FU-22 appears 2 times \(lines 2, 3\)/);
  });

  it('a duplicate is still a duplicate when one side is already closed', () => {
    // The shape that survives longest: one branch closes FU-22 while the other still has it open.
    // Reading either alone tells a consistent story; only both together show the collision.
    const problems = checkLedger([ok(22, 'x'), ok(22)].join('\n'));
    expect(problems[0]?.kind).toBe('duplicate-id');
  });

  it('non-adjacent duplicates are found too', () => {
    // Sorting the union by id puts them next to each other; a resolution that appends instead does not.
    const problems = checkLedger([ok(22), ok(30), ok(31), ok(22)].join('\n'));
    expect(problems[0]?.detail).toMatch(/lines 1, 4/);
  });

  it('gaps in the numbering are NOT a problem', () => {
    // Ids are names, not a sequence. Flagging gaps would fire on every legitimately abandoned entry
    // and the gate would be turned off — the failure mode a too-strict guard actually has.
    expect(checkLedger([ok(1), ok(5), ok(40)].join('\n'))).toEqual([]);
  });
});

describe('conflict markers', () => {
  it('a mid-merge ledger is reported as such, and nothing else is', () => {
    // Reporting "malformed entry" for every conflicted line would bury the one fact that matters.
    const problems = checkLedger(['<<<<<<< HEAD', ok(22), '=======', ok(22), '>>>>>>> other'].join('\n'));
    expect(problems.every((p) => p.kind === 'conflict-marker')).toBe(true);
    expect(problems).toHaveLength(3);
  });
});

describe('malformed entries', () => {
  it('an entry that does not parse is reported rather than skipped', () => {
    // The quiet failure this replaces: a line the regex misses simply is not counted, so a ledger
    // that stopped parsing looks like a ledger with no problems.
    const problems = checkLedger([ok(1), '- [ ] FU-2 missing the separators', ok(3)].join('\n'));
    expect(problems[0]?.kind).toBe('malformed-entry');
  });

  it('non-entry lines are left alone', () => {
    expect(checkLedger(['# Follow-ups', '', 'Some prose.', ok(1)].join('\n'))).toEqual([]);
  });
});

describe('the real ledger', () => {
  it('is clean, and parses a non-trivial number of entries', () => {
    // The second half is the instrument check: "no problems" from a parser that matched nothing is
    // the same output as "no problems" from a healthy ledger.
    const text = readFileSync('docs/agent/followups.md', 'utf8');
    expect(checkLedger(text)).toEqual([]);
    expect(text.split('\n').filter((l) => l.startsWith('- [')).length).toBeGreaterThan(20);
  });
});
