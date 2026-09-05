/**
 * `check-progress-sync` — the rot it exists for, pinned to the version that actually shipped.
 *
 * `progress.md` sat un-updated across ~20 merged PRs while three ledger gates stayed green, all
 * correctly: none of them reads this file. Fourth instance of that shape in one day.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { ledgerStatuses, mismatches, statusPairs } from './check-progress-sync.js';

const P = 'docs/agent/progress.md';
const T = 'docs/agent/tasks.md';
const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');

/**
 * FU-30's action half, applied here rather than only where it once hurt (FU-47).
 *
 * These tests spawn a subprocess (`git`, or the scanner). vitest's default timeout is 5s, and
 * **a timeout red and an assertion red are the same `× test name` line** — so a run that dies on
 * machine load reads exactly like the thing under test having a hole.
 *
 * Measured 2026-09-05, slowest single case in this file: 171ms locally. The only CI/local ratio
 * this repo has actually measured is **7.4x** (FU-48: 892ms local → 6607ms on CI, on a different
 * workload). Applying it here is an EXTRAPOLATION, not a measurement — stated so nobody reads the
 * number below as observed. Under it, `kms-endpoint-audit`'s slowest case sits at ~93% of the 5s
 * default, which is the case that motivated doing this now.
 *
 * The headroom costs a slow failure in the worst case. Shrinking it buys nothing and risks a
 * failure that lies about why.
 */
const SPAWN_TIMEOUT_MS = 30_000;

describe('what counts as a quoted status', { timeout: SPAWN_TIMEOUT_MS }, () => {
  it('pairs a task id with a nearby backticked status', () => {
    expect(statusPairs('| F1.2 | T1.2.1 `PR_OPEN` | x |')).toEqual([
      { task: 'T1.2.1', claimed: 'PR_OPEN', line: 1 },
    ]);
  });

  it('does NOT pair across a long stretch of prose', () => {
    // Without the window, a paragraph naming a task and quoting an unrelated status many words
    // later would read as a claim about that task.
    expect(statusPairs('T1.2.1 是很久以前交付的，另外某个别的任务现在是 `BLOCKED`')).toEqual([]);
  });

  it('does NOT read the file\'s own documentation of the pattern as a claim', () => {
    // progress.md's header explains this very rule — a rule cannot be cited inside the medium it
    // polices (FU-56 #2, fourth occurrence). What protects it is the id pattern itself: a claim
    // must name a CONCRETE task, and `T<x.y.z>` has no digits.
    expect(statusPairs('本文件里每一处 `T<x.y.z> \\`STATUS\\`` 都由 check:progress-sync 对账')).toEqual([]);
    // The mechanism, pinned directly. An earlier draft masked the placeholder explicitly and the
    // case above passed with that masking removed — it could not fail either way. So this asserts
    // the boundary: digits make it a claim, a placeholder does not.
    expect(statusPairs('T1.2.1 `DONE`')).toHaveLength(1);
    expect(statusPairs('T<x> `DONE`')).toHaveLength(0);
    expect(statusPairs('T1 `DONE`')).toHaveLength(0);   // one segment is not a task id here
  });

  it('finds several pairs on one line', () => {
    expect(statusPairs('T2.1.1 `DONE` · T2.1.2 `BLOCKED`').map((p) => p.task))
      .toEqual(['T2.1.1', 'T2.1.2']);
  });
});

describe('what the ledger defines', { timeout: SPAWN_TIMEOUT_MS }, () => {
  it('takes the trailing code span as the status, not any status word on the line', () => {
    expect([...ledgerStatuses('### T9.9.9 讲 `PR_OPEN` 的用法  `DONE`')]).toEqual([['T9.9.9', 'DONE']]);
  });

  it('POSITIVE CONTROL: the real ledger defines many statuses', () => {
    // An extractor returning an empty map would report EVERY pair as "no such task" — loud, but
    // for the wrong reason; one returning everything would go silent. Both are pinned here.
    const m = ledgerStatuses(read(T));
    expect(m.size).toBeGreaterThan(10);
    expect(m.get('T2.1.2')).toBe('BLOCKED');
  });
});

describe('THE ROT — it must red on the version that actually shipped', { timeout: SPAWN_TIMEOUT_MS }, () => {
  /**
   * progress.md as it stood at `49679dd9` — the commit this PR branched from, i.e. the rotted
   * version that actually shipped.
   *
   * **Pinned to a SHA, not to `origin/main`.** The first draft read `origin/main`, which MOVES: the
   * moment this PR merges, that ref stops carrying the rotted file and the case would be asserting
   * something about whatever landed most recently. A test whose fixture is a moving reference is
   * not testing history, it is testing "recently".
   */
  const ROTTED_AT = '49679dd9';
  const rotted = () =>
    execFileSync('git', ['show', `${ROTTED_AT}:docs/agent/progress.md`], { encoding: 'utf8', maxBuffer: 8 << 20 });

  it('reports T1.2.1 as PR_OPEN-vs-DONE on the shipped version', () => {
    const bad = mismatches(rotted(), read(T));
    expect(bad.map((b) => `${b.task}:${b.claimed}→${b.actual}`)).toContain('T1.2.1:PR_OPEN→DONE');
  });

  it('POSITIVE CONTROL: it does NOT report every pair — the file is not simply unreadable', () => {
    // A parse failure reports everything and looks identical to a real finding. So: strictly fewer
    // mismatches than pairs, i.e. at least one pair on that same old file agreed.
    const old = rotted();
    expect(mismatches(old, read(T)).length).toBeLessThan(statusPairs(old).length);
    expect(statusPairs(old).length).toBeGreaterThan(0);
  });

  it('is green on the file as it stands now', () => {
    expect(mismatches(read(P), read(T))).toEqual([]);
  });

  it('a status for a task that does not exist is reported, with `actual` undefined', () => {
    // Distinct from a disagreement: progress naming a task the ledger never defined is the
    // T1.2.3 shape (FU-71) reached from the other side.
    const bad = mismatches('T9.9.9 `DONE`', read(T));
    expect(bad).toHaveLength(1);
    expect(bad[0].actual).toBeUndefined();
  });
});
