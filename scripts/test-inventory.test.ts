/**
 * A floor under the test files that can be green while testing nothing.
 *
 * WHAT THIS IS FOR
 * ----------------
 * Eight files in this repo gate cases on `it.runIf(...)`. On CI most of those conditions are false,
 * so the files settle into a constant "N passed | M skipped" — and a skipped case never goes red.
 * Two things can then remove coverage without any run failing:
 *
 *   · a case renamed or moved so it no longer matches its describe/glob — it takes its assertions
 *     with it and the suite stays green (measured elsewhere tonight: a file that stopped loading
 *     dropped 47 cases while `Tests` still read "passed");
 *   · a case deleted in a refactor, which looks identical to a case that was never there.
 *
 * A minimum count is the cheapest thing that notices either. It is deliberately a FLOOR: adding
 * cases must not require editing this file, removing them must.
 *
 * WHAT IT DOES NOT DO — read this before trusting a green run
 * ----------------------------------------------------------
 * It counts DECLARATIONS in source text. It cannot tell a case that ran from one that was skipped,
 * and it cannot tell an assertion that bit from one that was vacuous. Those are different questions
 * with different answers: whether a case EXISTS is what this file guards; whether it RAN is FU-38
 * (an archive RPC secret for CI); whether it BITES is what mutation testing is for.
 *
 * Stating that here rather than leaving it implied, because "test inventory: OK" is exactly the kind
 * of line a reader promotes into "the tests are fine".
 *
 * WHY IT LIVES IN scripts/
 * ------------------------
 * `packages/core/tsconfig.json` compiles everything under `src`, `*.test.ts` included, so a test
 * there that reads files needs `node:fs` and breaks `pnpm -r build` (the same constraint that moved
 * the EIP-2335 keystore case out of core). `scripts/` belongs to no package build and is already
 * covered by `test:scripts` in CI.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

/**
 * Files whose coverage can vanish quietly, with the floor each must clear.
 *
 * The numbers were taken by counting the cases present when this was written. Lowering one is
 * allowed — coverage does get deliberately removed — but it must be a deliberate edit in the same
 * commit, which is the whole point: the edit is where the reviewer gets to ask why.
 */
const INVENTORY: { file: string; min: number; why: string }[] = [
  { file: 'packages/core/src/actions/committeeTree.test.ts', min: 16, why: 'frozen-root proofs; 4 of these are skipped on CI (FU-38)' },
  { file: 'packages/core/src/dvt.onchain.test.ts', min: 7, why: 'DVT_CONFIG vs the router, and the requireStake watch (FU-34)' },
  { file: 'packages/core/src/addresses.threeLegs.test.ts', min: 6, why: 'the three-legs split — the check that made it visible' },
  { file: 'packages/core/src/actions/committee.onchain.test.ts', min: 5, why: 'committee framing against the mounted validator' },
  { file: 'packages/core/src/addresses.airaccount.test.ts', min: 5, why: 'AirAccount stack edges, not just addresses' },
  { file: 'packages/core/src/addresses.gToken.test.ts', min: 3, why: 'Registry → staking → GTOKEN (FU-1)' },
  { file: 'packages/core/src/addresses.dvt.test.ts', min: 3, why: 'live-aggregator rooting (FU-22)' },
  { file: 'packages/airaccount/src/server/__tests__/kms-e2e.live.test.ts', min: 7, why: 'KMS live E2E, skipped without KMS_E2E=1' },
];

/** Count case declarations: `it(`, `it.each(`, `it.runIf(`, `it.skipIf(`, `test(`. */
function countCases(source: string): number {
  return (source.match(/^\s*(it|test)(\.(each|runIf|skipIf|concurrent|sequential)\b[^\n]*)?\s*\(/gm) ?? []).length;
}

describe('test inventory', () => {
  it.each(INVENTORY)('$file has at least $min cases', ({ file, min, why }) => {
    expect(existsSync(file), `${file} is gone — ${why}`).toBe(true);
    const found = countCases(readFileSync(file, 'utf8'));
    expect(
      found,
      `${file} declares ${found} cases, floor is ${min} (${why}). If cases were deliberately removed, ` +
        'lower the floor in this file in the same commit and say why in the message.',
    ).toBeGreaterThanOrEqual(min);
  });

  it('the counter recognises the forms actually used, and only those', () => {
    // The instrument check. A counter that matched nothing would report every file as empty and
    // fail loudly — but one that OVER-matches would inflate every count and hide a real removal,
    // which is the quiet direction.
    expect(countCases('  it("a", () => {});\n  it.runIf(x)("b", () => {});\n  it.each(y)("c", () => {});')).toBe(3);
    expect(countCases('  test("a", () => {});')).toBe(1);
    expect(countCases('// it("commented out", () => {});')).toBe(0);
    expect(countCases('  describe("not a case", () => {});\n  expect(it).toBeDefined();')).toBe(0);
  });

  it('every inventory entry points at a file that exists', () => {
    // Separate from the per-file case above so a typo in this manifest is distinguishable from a
    // file that was actually deleted — the two need different fixes.
    for (const { file } of INVENTORY) expect(existsSync(file), `inventory names a missing path: ${file}`).toBe(true);
  });
});
