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

describe('what counts as justified', () => {
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

describe('THE CASE — dapp, before and after', () => {
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

describe('the baseline', () => {
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
