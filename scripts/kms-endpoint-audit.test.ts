/**
 * The audit's instrument checks, exercised by replaying the two bugs it has actually had.
 *
 * `EXPECTED_SDK_PATHS = 37` used to stand in for all of this. It worked — and it worked by asking a
 * human to remember a number that lived in the same file, so one edit turned any red run green and
 * nothing recorded whether that edit was a deliberate endpoint change or a shrug. FU-27 asked for
 * the version that does not depend on anyone remembering.
 *
 * Three extractors, three mechanisms, three different ways to be wrong:
 *
 *   A  literal scan         every string shaped like a path      (over-matches prose)
 *   B  call-site scan       first argument of an HTTP call       (misses variable-passed paths)
 *   C  expression position  preceded by ( , = : [ or return      (misses nothing real; rejects prose)
 *
 * B ⊆ A closes the direction that actually broke; A ⊆ C closes the one B cannot see. Neither is a
 * number. What they cannot do is catch an endpoint all three miss — three views of the same source
 * text are not three independent observers, and correlated blindness stays blind.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const AUDIT = 'scripts/kms-endpoint-audit.ts';

/** Run the audit with the source temporarily mutated; always restores. */
function withMutation(apply: (src: string) => string, run: () => string): string {
  const original = readFileSync(AUDIT, 'utf8');
  const mutated = apply(original);
  expect(mutated, 'the mutation must actually change the file — a no-op edit proves nothing').not.toBe(original);
  writeFileSync(AUDIT, mutated);
  try {
    return run();
  } finally {
    writeFileSync(AUDIT, original);
  }
}

/**
 * The audit's real baseline is a spec in a sibling repository, absent on CI — so the tool exits
 * before any instrument check runs, and five of these tests failed there while passing locally. The
 * extractors do not need the real spec: they read the SDK, and what is under test is whether they
 * agree with each other. A minimal stand-in keeps these runnable everywhere, and keeps them from
 * failing whenever upstream edits its spec for reasons unrelated to the extractors.
 */
const FIXTURE_SPEC = 'scripts/__fixtures__/kms-openapi.min.yaml';

/**
 * FU-48, same one-line win as security-scan.test.ts: launch `tsx` directly rather than through
 * `npx`, whose own resolution measured 60-70% of every spawn (833/628ms via npx vs 239/251ms
 * direct). `npx tsx` resolves to this same local binary, so the code executed is identical — only
 * the launcher differs. The fallback keeps this runnable in a checkout without an install.
 */
const TSX_BIN = join(process.cwd(), 'node_modules', '.bin', 'tsx');
const [LAUNCHER, LAUNCH_ARGS] = existsSync(TSX_BIN) ? [TSX_BIN, []] : ['npx', ['tsx']];

function audit(): string {
  try {
    return execFileSync(LAUNCHER, [...LAUNCH_ARGS, AUDIT, '--spec', FIXTURE_SPEC], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    // A missing baseline aborts before any instrument check — the exact CI failure this fixture
    // exists to remove. Fail with that cause named rather than with a confusing assertion diff.
    expect(out, 'the audit could not reach its baseline; the instrument checks never ran').not.toMatch(/no KMS spec at/);
    return out;
  }
}

/**
 * FU-30's action half, applied here rather than only where it once hurt (FU-47).
 *
 * These tests spawn a subprocess (`git`, or the scanner). vitest's default timeout is 5s, and
 * **a timeout red and an assertion red are the same `× test name` line** — so a run that dies on
 * machine load reads exactly like the thing under test having a hole.
 *
 * Measured 2026-09-05, slowest single case in this file: 631ms locally. The only CI/local ratio
 * this repo has actually measured is **7.4x** (FU-48: 892ms local → 6607ms on CI, on a different
 * workload). Applying it here is an EXTRAPOLATION, not a measurement — stated so nobody reads the
 * number below as observed. Under it, `kms-endpoint-audit`'s slowest case sits at ~93% of the 5s
 * default, which is the case that motivated doing this now.
 *
 * The headroom costs a slow failure in the worst case. Shrinking it buys nothing and risks a
 * failure that lies about why.
 */
const SPAWN_TIMEOUT_MS = 30_000;

describe('instrument checks (FU-27)', { timeout: SPAWN_TIMEOUT_MS }, () => {
  it('the audit runs and reports all three extractor counts', () => {
    // The baseline that makes the mutations below mean something: if the audit could not run, every
    // "the mutation was caught" reading would be the same output as "nothing ran".
    const out = audit();
    expect(out).toMatch(/literal scan \d+ · call-site scan \d+ \+ \d+ indirect call\(s\)/);
    expect(out).not.toMatch(/instrument check:/);
  }, 60_000);

  it('replaying the .json filter bug: the call-site scan catches it and names the endpoints', () => {
    // The bug that really happened. Filtering `.json` did not merely lose two rows — it moved two
    // called endpoints into "the spec documents it, the SDK never calls it", asserting the opposite
    // of the truth.
    const out = withMutation(
      (s) => s.replace("/\\.(ts|js|md)$/.test(p)", "/\\.(ts|js|md|json)$/.test(p)"),
      audit,
    );
    expect(out).toMatch(/passed to an HTTP call but the\n\s+literal scan does not report them/);
    expect(out).toContain('attestation-measurements.json');
  }, 60_000);

  it('replaying the /60 bug: the expression-position check catches it', () => {
    // The other direction, and the one the call-site scan is blind to — measured: with comment
    // stripping removed the counts went 37 → 38 and no check fired, because the extra path hides
    // among the sixteen the literal scan legitimately finds that no call site uses.
    const out = withMutation(
      (s) => s.replace(/\.replace\(\/\\\/\\\*\[\\s\\S\]\*\?\\\*\\\/\/g, ''\)\n\s*\.replace\(\/\(\^\|\[\^:\]\)\\\/\\\/\.\*\$\/gm, '\$1'\);/, ';'),
      audit,
    );
    expect(out).toMatch(/never appear in an expression/);
  }, 60_000);

  it('the remaining number is a FLOOR, not an equality', () => {
    // An earlier version of this case asserted that no number remained at all, and that was the
    // wrong property — review showed a bare number is still needed, because relations between
    // extractors cannot see the data shrinking underneath all of them.
    //
    // What was wrong with `= 37` was not that it was a number, it was that it was an EQUALITY:
    // adding an endpoint fired it too, so it had to be edited constantly, and a number edited
    // constantly is edited without thinking. So the property to hold is the COMPARISON, and the two
    // behavioural cases below are what actually pin it — this one only keeps the shape honest.
    const source = readFileSync(AUDIT, 'utf8');
    expect(source, 'the old equality must be gone').not.toMatch(/sdk\.size !== \w+PATHS/);
    expect(source, 'and replaced by a floor').toMatch(/sdk\.size < MIN_SDK_PATHS/);
  });
});

describe('the floor: relations cannot see a removal', { timeout: SPAWN_TIMEOUT_MS }, () => {
  const SERVICE = 'packages/airaccount/src/server/services/kms-agent-service.ts';

  /** Mutate a service file instead of the audit, restoring afterwards. */
  function withServiceMutation(apply: (src: string) => string, run: () => string): string {
    const original = readFileSync(SERVICE, 'utf8');
    const mutated = apply(original);
    expect(mutated, 'the mutation must actually change the file').not.toBe(original);
    writeFileSync(SERVICE, mutated);
    try {
      return run();
    } finally {
      writeFileSync(SERVICE, original);
    }
  }

  it('deleting a real endpoint call is caught', () => {
    // Demonstrated in review: with only B ⊆ A and A ⊆ C, deleting `/kms/create-agent-key` slid every
    // number one place — 36 documented → 35, literal scan 37 → 36 — and every relation still held.
    // The endpoint just moved into "spec documents it, SDK never calls it", which is deliberately
    // not a failure. Relations compare the extractors to each other, and all of them shrink together.
    const out = withServiceMutation(
      (src) => src.split('\n').filter((l) => !l.includes('"/kms/create-agent-key"')).join('\n'),
      audit,
    );
    expect(out).toMatch(/the SDK now calls 36 paths, floor is 37/);
  }, 60_000);

  it('ADDING an endpoint stays green', () => {
    // The half the old equality got wrong. `= 37` fired on additions too, so it had to be edited
    // constantly — and a number edited constantly is a number edited without thinking. A floor is
    // free to add against and requires a deliberate edit to lower, which is where "why is there one
    // fewer?" gets asked.
    const out = withServiceMutation(
      (src) => src.replace('  async createAgentKey(', '  async __probe(): Promise<void> { await this.http.get("/kms/brand-new"); }\n\n  async createAgentKey('),
      audit,
    );
    expect(out).not.toMatch(/floor is/);
    expect(out).toMatch(/literal scan 38/);
  }, 60_000);
});
