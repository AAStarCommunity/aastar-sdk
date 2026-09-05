/**
 * `check-branch-task` — the rule that would have caught T1.2.3 going unrecorded.
 *
 * The historical case is the anchor, not a fixture: `feat/T1.2.3-account-anchor` was developed,
 * reviewed twice and merged as #377 while `tasks.md` had no such task. Both other ledger gates were
 * green the whole time and were right to be — a row that was never written is in nobody's scope.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { missingTasks, tasksInLedger, tasksNamedBy } from './check-branch-task.js';

const LEDGER = 'docs/agent/tasks.md';
const BRANCH = 'feat/T1.2.3-account-anchor';

/**
 * FU-30's action half, applied here rather than only where it once hurt (FU-47).
 *
 * These tests spawn a subprocess (`git`, or the scanner). vitest's default timeout is 5s, and
 * **a timeout red and an assertion red are the same `× test name` line** — so a run that dies on
 * machine load reads exactly like the thing under test having a hole.
 *
 * Measured 2026-09-05, slowest single case in this file: 289ms locally. The only CI/local ratio
 * this repo has actually measured is **7.4x** (FU-48: 892ms local → 6607ms on CI, on a different
 * workload). Applying it here is an EXTRAPOLATION, not a measurement — stated so nobody reads the
 * number below as observed. Under it, `kms-endpoint-audit`'s slowest case sits at ~93% of the 5s
 * default, which is the case that motivated doing this now.
 *
 * ## What this does NOT do — the name says "timeout", so say the limit out loud (#384 review)
 *
 * It bounds the VERDICT, not the EXECUTION. These tests spawn with `execFileSync`, which blocks the
 * event loop that vitest's timer runs on. Measured on vitest 4.0.17 with three controls:
 *
 * ```
 * execFileSync('sleep','3') under { timeout: 1 }   → "Test timed out in 1ms", took 3177ms
 * await sleep(3000)        under { timeout: 1 }   → "Test timed out in 1ms", took 1ms
 * instant body             under { timeout: 1 }   → green
 * ```
 *
 * So a genuinely HUNG subprocess is not cut short by this. What it does fix is the case this was
 * raised for: a spawn that is slow but finishes no longer gets reported as an assertion failure.
 * Hence `VERDICT` in the name — the earlier `SPAWN_TIMEOUT_MS` promised the other thing.
 *
 * ## And it does not cover hooks
 *
 * A `describe`-level `{ timeout }` applies to CASES ONLY; hooks keep the separate `hookTimeout`
 * (default 10s). Measured with a positive control: a 12s `beforeAll` under
 * `describe(..., { timeout: 30_000 })` still fails `Hook timed out in 10000ms`, while the same hook
 * with an explicit per-hook argument passes. None of the four files here has a hook, so this note
 * is a boundary for whoever copies the pattern — not a defect in it.
 *
 * The headroom costs a slow failure in the worst case. Shrinking it buys nothing and risks a
 * failure that lies about why.
 */
const SPAWN_VERDICT_TIMEOUT_MS = 30_000;

describe('what a branch name CLAIMS', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('extracts a dotted task id', () => {
        expect(tasksNamedBy(BRANCH)).toEqual(['T1.2.3']);
        expect(tasksNamedBy('feat/T5.4.2-kms-endpoint-audit')).toEqual(['T5.4.2']);
    });

    it('claims nothing from chore/fix/docs branches — most of this repo\'s work', () => {
        // The over-broad version of this rule ("every branch must name a task") is the one that gets
        // switched off. Named here so the narrowness is a tested property, not an intention.
        for (const b of ['fix/fu68-pr-name-failopen', 'chore/close-delivered-followups', 'docs/pilot-plan']) {
            expect(tasksNamedBy(b), b).toEqual([]);
        }
    });

    it('requires a separator before the T — `XT1.2.3` is not a claim', () => {
        expect(tasksNamedBy('XT1.2.3-not-a-claim')).toEqual([]);
        expect(tasksNamedBy('T1.2.3-at-the-start')).toEqual(['T1.2.3']);
    });

    it('an UNDERSCORE separates — the one character where this differs from \\b', () => {
        // #379 review: mutating the separator to `\b` produced ZERO reds, so nothing pinned the
        // choice — and the reason the code gave for it ("`\b` would match inside XT1.2.3") is false,
        // measured: `X` and `T` are both word characters, so `\b` finds no boundary there either.
        //
        // The forms differ on exactly one character. `\w` includes `_`, so `\b` reads `_T1.2.3` as
        // one word and sees no claim. A branch like `chore/fix_T1.2.3_thing` HAS named the task,
        // which is why this form is the right one — a one-character difference, deliberately kept,
        // now falsifiable.
        expect(tasksNamedBy('chore/fix_T1.2.3_thing')).toEqual(['T1.2.3']);
        expect(tasksNamedBy('_T1.2.3')).toEqual(['T1.2.3']);
    });

    it('requires at least two dotted parts — a bare `T5` is not a task id here', () => {
        expect(tasksNamedBy('feat/T5-something')).toEqual([]);
        expect(tasksNamedBy('feat/T5.4-something')).toEqual(['T5.4']);
    });

    it('de-duplicates a task named twice', () => {
        expect(tasksNamedBy('feat/T1.2.3-and-T1.2.3-again')).toEqual(['T1.2.3']);
    });
});

describe('what the ledger DEFINES', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('reads task ids from headers only, not from prose that mentions them', () => {
        // T2.1.2's body names T2.1.1 as a dependency. If mentions counted, a task could be
        // "defined" by another task talking about it — which is exactly how T1.2.3 could have
        // looked present while having no row of its own.
        const doc = ['### T2.1.1 x  `DONE`', '- **依赖**：T2.1.2（已 DONE）'].join('\n');
        expect([...tasksInLedger(doc)]).toEqual(['T2.1.1']);
    });

    it('POSITIVE CONTROL: the real ledger defines a non-trivial number of tasks', () => {
        // An extractor that silently returned an empty set would make every check below pass by
        // reporting everything missing — loudly, but for the wrong reason. And one that returned
        // everything would make them pass silently. Both are pinned: count, and a known member.
        const defined = tasksInLedger(readFileSync(join(process.cwd(), LEDGER), 'utf8'));
        expect(defined.size).toBeGreaterThan(10);
        expect(defined.has('T1.2.2')).toBe(true);
    });
});

describe('THE HISTORICAL CASE — it must red on the state that actually shipped', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    /** `tasks.md` as it stood on the commit that merged #377, i.e. with T1.2.3 still unwritten. */
    const ledgerAtMerge = () =>
        execFileSync('git', ['show', '9e538e07:docs/agent/tasks.md'], { encoding: 'utf8', maxBuffer: 8 << 20 });

    it('reds on the ledger as it stood when #377 merged', () => {
        // Not a synthetic fixture. If this ever stops reporting T1.2.3, the rule has stopped
        // covering the case it was written for.
        expect(missingTasks(BRANCH, ledgerAtMerge())).toEqual(['T1.2.3']);
    });

    it('POSITIVE CONTROL: that same historical ledger satisfies OTHER branches', () => {
        // Proves the red above is about T1.2.3 specifically and not about the old file being
        // unreadable — a parse failure would report every task missing, and look identical.
        expect(missingTasks('feat/T1.2.2-node-onboarding-api', ledgerAtMerge())).toEqual([]);
        expect(missingTasks('feat/T5.4.2-kms-endpoint-audit', ledgerAtMerge())).toEqual([]);
    });

    it('is green on the ledger as it stands now', () => {
        expect(missingTasks(BRANCH, readFileSync(join(process.cwd(), LEDGER), 'utf8'))).toEqual([]);
    });

    it('a branch naming a task nobody ever wrote still reds', () => {
        expect(missingTasks('feat/T9.9.9-invented', readFileSync(join(process.cwd(), LEDGER), 'utf8')))
            .toEqual(['T9.9.9']);
    });
});
