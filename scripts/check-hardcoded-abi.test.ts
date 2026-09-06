/**
 * The rule, its baseline, and the case that prompted it.
 *
 * `packages/dapp` shipped a publicly exported `DVTClient.registerValidator` calling a function that
 * exists on no contract in this repo. Two covers hid it: the repo's `parseAbi` ban never runs (no
 * package defines a `lint` script, so `pnpm -r lint` is a no-op), and its only caller printed
 * "DVT Call Reached (Reverted as expected for dummy key)" — the same line either way.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { KNOWN_UNJUSTIFIED, findUnjustified } from './check-hardcoded-abi.js';

const DAPP = 'packages/dapp/src/ui/index.ts';
const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');

/**
 * FU-30's action half, applied here rather than only where it once hurt (FU-47).
 *
 * These tests spawn a subprocess (`git`, or the scanner). vitest's default timeout is 5s, and
 * **a timeout red and an assertion red are the same `× test name` line** — so a run that dies on
 * machine load reads exactly like the thing under test having a hole.
 *
 * Measured 2026-09-05, slowest single case in this file: 160ms locally. The only CI/local ratio
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

describe('what counts as justified', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    // The deterministic form of "the timeout is wired". #384 review measured that provoking it is
    // NOT reproducible: with `{ timeout: 1 }`, `execFileSync` blocks the loop the timer lives on, so
    // whether vitest ever fires it is a race — three of their runs gave 1 red / 1 red / zero red, and
    // four of mine gave zero red every time. **The "1 red" I reported in #384 as proof was a fluke
    // reading.** Reading the value instead is exact and cannot flake.
    //
    // The positive control is the load-bearing half: delete the `{ timeout }` option above and this
    // reads 5000 (vitest's default) and goes red. Without that, an assertion that the timeout equals
    // a constant would also pass if the option were dropped and the constant edited to match.
    it('the spawn timeout is actually wired to this describe', (ctx) => {
        expect(ctx.task.timeout).toBe(SPAWN_VERDICT_TIMEOUT_MS);
    });
  it('an import with no justification is reported', () => {
    expect(findUnjustified('f.ts', "import { parseAbi } from 'viem';")).toHaveLength(1);
  });

  it('POSITIVE CONTROL: the marker the repo already uses satisfies it', () => {
    // Without this, a function reporting everything would pass the case above while making the
    // gate unusable — and airaccount's four justified files would all red.
    const ok = "// eslint-disable-next-line no-restricted-imports -- factory ABI is not in core\nimport { parseAbi } from 'viem';";
    expect(findUnjustified('f.ts', ok)).toEqual([]);
  });

  it('the lookback window is three lines — pinned in both directions', () => {
    // Mutation found this unpinned: an earlier version also walked back over blank lines, and
    // removing that loop reded nothing, because a three-line window already spans a blank line.
    // So the window itself is the mechanism, and both of its edges are asserted here.
    const within = "// eslint-disable-next-line no-restricted-imports -- reason\n\nimport { parseAbi } from 'viem';";
    expect(findUnjustified('f.ts', within), 'two lines back must count').toEqual([]);

    const tooFar = "// eslint-disable-next-line no-restricted-imports -- reason\n\n\n\nimport { parseAbi } from 'viem';";
    expect(findUnjustified('f.ts', tooFar), 'four lines back must NOT count').toHaveLength(1);
  });

  it('does NOT fire on a mention of parseAbi outside an import', () => {
    // This very file, and the checker's own doc comment, talk about `parseAbi`. Matching the call
    // site or a bare mention would make the gate report itself.
    expect(findUnjustified('f.ts', 'const x = parseAbi(SOMETHING); // discussion of parseAbi')).toEqual([]);
  });

  it('POSITIVE CONTROL on the real tree: airaccount\'s justified files are silent', () => {
    // The four files that legitimately hand-write an ABI. If these ever start firing, the marker
    // convention changed and the rule needs revisiting rather than the files.
    const f = 'packages/airaccount/src/server/utils/oapd.ts';
    expect(findUnjustified(f, read(f))).toEqual([]);
  });
});

describe('THE CASE — dapp, before and after', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
  /** `packages/dapp/src/ui/index.ts` as it stood on the commit this branch forked from. */
  const FORKED_AT = '055edd59';
  const before = () =>
    execFileSync('git', ['show', `${FORKED_AT}:${DAPP}`], { encoding: 'utf8', maxBuffer: 8 << 20 });

  it('reports the file as it actually shipped', () => {
    expect(findUnjustified(DAPP, before())).toHaveLength(1);
  });

  it('is silent on the file as it stands now', () => {
    expect(findUnjustified(DAPP, read(DAPP))).toEqual([]);
  });

  it('the fictional signatures are GONE, and the real one is present', () => {
    // The gate above only checks that hand-writing is justified — it cannot tell a correct ABI
    // from a fictional one. So the actual defect is pinned separately, by content.
    const now = read(DAPP);
    for (const dead of ['registerValidator', 'signProposal', 'createProposal']) {
      // Allowed in prose (the module doc explains what they were); banned as code.
      expect(now, dead).not.toMatch(new RegExp(`functionName:\\s*['"]${dead}['"]`));
    }
    expect(now).toMatch(/functionName:\s*'registerWithProof'/);
    expect(now).toMatch(/AAStarBLSAlgorithmABI/);
  });

  it('dapp is NOT on the baseline — the baseline is for files nobody fixed', () => {
    // If a later change re-broke dapp, adding it to the baseline would silence this rule for the
    // one file it was written for. Cheap to hold, and the failure it prevents is a quiet one.
    expect(KNOWN_UNJUSTIFIED).not.toContain(DAPP);
  });
});

describe('the baseline', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
  it('every entry still fires — an entry that does not is stale', () => {
    // A baseline is a debt register. An entry that no longer fires means someone fixed the file
    // and did not remove it, and from then on that file is exempt for free.
    for (const f of KNOWN_UNJUSTIFIED) {
      expect(findUnjustified(f, read(f)), `${f} no longer needs a baseline entry`).not.toHaveLength(0);
    }
  });

  it('POSITIVE CONTROL: the baseline is non-empty and finite', () => {
    // An empty array would make the loop above vacuous — and vacuously green, which is the shape
    // this repo has paid for repeatedly.
    expect(KNOWN_UNJUSTIFIED.length).toBeGreaterThan(0);
    expect(KNOWN_UNJUSTIFIED.length).toBeLessThan(20);
  });
});
