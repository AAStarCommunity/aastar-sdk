/**
 * SYNTHETIC-UPSTREAM regression for the provenance chain in `scripts/check-abi-drift.ts`
 * (CC-50 round-5 MEDIUM-1).
 *
 * WHY A SYNTHETIC UPSTREAM
 * ------------------------
 * The states this gate must fail on cannot be produced against the real sibling checkouts without
 * writing into another repository's working tree, and two of them (an `out/` that belongs to no git
 * repo; an artifact with no `metadata.sources`) never occur locally at all — they are what a
 * tarball, a `git archive` or a downloaded CI artifact looks like. So every case below builds a
 * throwaway upstream repo + a throwaway SDK root in a temp dir and runs the REAL script against it.
 *
 * WHAT IT PINS
 * ------------
 * The two bypasses an independent reviewer measured on 249be89e, where `--strict` exited 0 and
 * printed the unqualified sentence "every artifact hash-matches the sources it records":
 *
 *   1. `metadata.sources` absent / unresolved / empty → `verifyArtifactSources` reported
 *      `unresolved`, which was printed and never failed. ZERO source bytes were hashed.
 *   2. `out/` outside any git checkout → `repoProvenanceFor` returned null and the NO UPSTREAM PIN
 *      filter (`e.repo && …`) dropped exactly those entries, printing "upstream revisions (0)".
 *
 * Each case asserts BOTH halves: that the fixture really reproduces the bypassed state (the report
 * still shows "0 source(s)" / "upstream revisions (0)" — otherwise the case would be testing
 * something else), and that the run now fails and refuses to print the unqualified PASS.
 *
 * The already-working links (stale artifact, missing artifact, drift) are pinned here too, so a
 * later edit cannot trade one gate away for another.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { keccak256, toBytes } from 'viem';

const HERE = dirname(fileURLToPath(import.meta.url));
const SDK_REPO = resolve(HERE, '../..');
const SCRIPT = join(SDK_REPO, 'scripts/check-abi-drift.ts');
const TSX = join(SDK_REPO, 'node_modules/.bin/tsx');

/** The exact sentence a run may only print when the whole chain held. */
const UNQUALIFIED_PASS = 'and every artifact hash-matches the sources it records';

/**
 * Every contract in the script's MUST_VERIFY set. A fixture missing one of these would fail for
 * "MUST-VERIFY NOT VERIFIED" instead of the reason under test, so all four are always present.
 */
const CONTRACTS = ['Registry', 'BLSAggregator', 'DVTValidator', 'SuperPaymaster'] as const;
type Contract = (typeof CONTRACTS)[number];

/** Identical on both sides, so the signature-set comparison is never the thing that fails. */
function abiFor(name: Contract): unknown[] {
  return [
    { type: 'function', name: `ping${name}`, stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  ];
}

function sourceFor(name: Contract): string {
  return `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.28;\n\ncontract ${name} {\n    function ping${name}() external pure returns (uint256) { return 1; }\n}\n`;
}

type Bypass =
  | 'none'
  /** artifact carries no solc metadata at all — the tarball/`solc --abi` shape */
  | 'no-metadata-sources'
  /** metadata names a source file that is not on disk */
  | 'unresolved-source'
  /** metadata only names sources OUTSIDE the repo, so nothing in-repo is hashed */
  | 'zero-in-repo-sources'
  /** out/ belongs to no git checkout */
  | 'no-git-repo'
  /** artifact was built before the last (committed) source edit */
  | 'stale-artifact'
  /** the artifact simply is not there */
  | 'missing-artifact'
  /** the SDK's vendored ABI genuinely differs from a clean, committed upstream */
  | 'real-drift';

type Fixture = { root: string; sdkRoot: string; upstreamRoot: string };

function git(root: string, args: string[]): string {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });
}

/**
 * Build `<tmp>/<case>/{SuperPaymaster,sdk}` — the sibling layout the script resolves through
 * `../SuperPaymaster/out`.
 */
function buildFixture(bypass: Bypass): Fixture {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'cc50-provenance-')));
  const upstreamRoot = join(root, 'SuperPaymaster');
  const sdkRoot = join(root, 'sdk');
  const srcDir = join(upstreamRoot, 'contracts/src');
  const abisDir = join(sdkRoot, 'packages/core/src/abis');
  mkdirSync(srcDir, { recursive: true });
  mkdirSync(abisDir, { recursive: true });
  mkdirSync(join(sdkRoot, 'scripts'), { recursive: true });

  for (const name of CONTRACTS) {
    writeFileSync(join(srcDir, `${name}.sol`), sourceFor(name));
  }
  // Foundry repos gitignore `out/`; without this the build products themselves would read as
  // uncommitted changes and every case would fail for the wrong reason.
  writeFileSync(join(upstreamRoot, '.gitignore'), 'out/\n');

  if (bypass !== 'no-git-repo') {
    git(upstreamRoot, ['init', '-q', '-b', 'main']);
    git(upstreamRoot, ['config', 'user.email', 'fixture@example.invalid']);
    git(upstreamRoot, ['config', 'user.name', 'fixture']);
    git(upstreamRoot, ['add', '-A']);
    git(upstreamRoot, ['commit', '-q', '-m', 'fixture upstream']);
  }

  // Artifacts. `metadata.sources[rel].keccak256` is solc's own hash of the input file; the script
  // recomputes it over the working tree, which is what makes the artifact⇄source link cryptographic.
  for (const name of CONTRACTS) {
    if (bypass === 'missing-artifact' && name === 'Registry') continue;
    const rel = `contracts/src/${name}.sol`;
    const outDir = join(upstreamRoot, 'out', `${name}.sol`);
    mkdirSync(outDir, { recursive: true });
    const sources: Record<string, { keccak256: string }> = {
      [rel]: { keccak256: keccak256(toBytes(sourceFor(name))) },
    };
    let metadata: unknown = { sources };
    if (bypass === 'no-metadata-sources' && name === 'Registry') metadata = undefined;
    if (bypass === 'unresolved-source' && name === 'Registry') {
      metadata = { sources: { 'contracts/src/Ghost.sol': { keccak256: keccak256(toBytes('ghost')) } } };
    }
    if (bypass === 'zero-in-repo-sources' && name === 'Registry') {
      // Resolves OUTSIDE the repo root, so the script skips it as "the dependency's problem" and
      // ends up having hashed nothing at all for this contract.
      metadata = { sources: { '../vendor/Outside.sol': { keccak256: keccak256(toBytes('outside')) } } };
    }
    writeFileSync(
      join(outDir, `${name}.json`),
      JSON.stringify({ abi: abiFor(name), bytecode: { object: '0x60006000fd' }, metadata }, null, 2),
    );
  }

  // The SDK side: vendored ABIs + the committed pin.
  const contracts: Record<string, { abiSha256: string; why: string }> = {};
  for (const name of CONTRACTS) {
    const abi = abiFor(name);
    const vendored =
      bypass === 'real-drift' && name === 'Registry'
        ? [...abi, { type: 'function', name: 'ghost', stateMutability: 'view', inputs: [], outputs: [] }]
        : abi;
    writeFileSync(join(abisDir, `${name}.json`), JSON.stringify(vendored, null, 2));
    contracts[name] = {
      abiSha256: createHash('sha256').update(JSON.stringify(vendored)).digest('hex'),
      why: 'fixture',
    };
  }

  const repos: Record<string, { revision: string; why: string }> = {};
  if (bypass !== 'no-git-repo') {
    repos.SuperPaymaster = { revision: git(upstreamRoot, ['rev-parse', 'HEAD']).trim(), why: 'fixture' };
  }
  writeFileSync(join(sdkRoot, 'scripts/upstream-abi-pin.json'), JSON.stringify({ repos, contracts }, null, 2));

  if (bypass === 'stale-artifact') {
    // Edit AND COMMIT after the artifact was written: the checkout is clean and pinned, so only the
    // solc source hash can catch it.
    writeFileSync(join(srcDir, 'Registry.sol'), `${sourceFor('Registry')}// edited after the build\n`);
    git(upstreamRoot, ['commit', '-qam', 'edit after build']);
    repos.SuperPaymaster = { revision: git(upstreamRoot, ['rev-parse', 'HEAD']).trim(), why: 'fixture' };
    writeFileSync(join(sdkRoot, 'scripts/upstream-abi-pin.json'), JSON.stringify({ repos, contracts }, null, 2));
  }

  return { root, sdkRoot, upstreamRoot };
}

type Run = { status: number; output: string };

function runGate(fixture: Fixture, strict: boolean): Run {
  const args = strict ? [SCRIPT, '--strict'] : [SCRIPT];
  try {
    const output = execFileSync(TSX, args, {
      cwd: fixture.sdkRoot,
      encoding: 'utf8',
      // Stop git's upward discovery at the fixture root so the `no-git-repo` case cannot be
      // accidentally satisfied by some ancestor repository of the temp dir.
      env: { ...process.env, GIT_CEILING_DIRECTORIES: fixture.root, STRICT_ABI_DRIFT: '', REQUIRE_UPSTREAM: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, output };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? -1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

/** Both modes, on one throwaway fixture that is always cleaned up. */
function withFixture(bypass: Bypass, assertions: (lenient: Run, strict: Run) => void): void {
  const fixture = buildFixture(bypass);
  try {
    assertions(runGate(fixture, false), runGate(fixture, true));
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
}

describe('check-abi-drift provenance chain (synthetic upstream)', () => {
  it('BASELINE: a clean, committed, pinned upstream with real source hashes passes strict', () => {
    withFixture('none', (lenient, strict) => {
      expect(strict.status, strict.output).toBe(0);
      expect(lenient.status, lenient.output).toBe(0);
      // The unqualified sentence is allowed here, and ONLY here.
      expect(strict.output).toContain(UNQUALIFIED_PASS);
      expect(strict.output).toContain('Attributed to committed upstream revision(s): SuperPaymaster@');
      expect(strict.output).not.toContain('MUST-VERIFY PROVENANCE INCOMPLETE');
      // Sanity: it really did hash the sources rather than skipping them.
      expect(strict.output).toMatch(/Registry\s+\w{16}\s+✅ 1 source\(s\)/);
    });
  }, 120_000);

  it('BYPASS 1a: an artifact with NO metadata.sources fails strict instead of passing green', () => {
    withFixture('no-metadata-sources', (lenient, strict) => {
      // The fixture reproduces the reported state: the artifact is reported as unresolved…
      expect(strict.output).toContain('<artifact carries no solc metadata.sources>');
      // …and that state used to exit 0 with the unqualified PASS. Now:
      expect(strict.status, strict.output).toBe(1);
      expect(strict.output).toContain('MUST-VERIFY PROVENANCE INCOMPLETE');
      expect(strict.output).toContain('SOURCE HASHES INCOMPLETE');
      expect(strict.output).toContain('NO SOURCE HASHES');
      expect(strict.output).not.toContain(UNQUALIFIED_PASS);
      // Lenient stays usable for a developer mid-edit, but must not overstate what it checked.
      expect(lenient.status, lenient.output).toBe(0);
      expect(lenient.output).not.toContain(UNQUALIFIED_PASS);
      expect(lenient.output).toContain('INCOMPLETE PROVENANCE');
      expect(lenient.output).toContain('LENIENT MODE');
    });
  }, 120_000);

  it('BYPASS 1b: a source named in metadata but absent on disk fails strict', () => {
    withFixture('unresolved-source', (_lenient, strict) => {
      expect(strict.output).toContain('contracts/src/Ghost.sol');
      expect(strict.status, strict.output).toBe(1);
      expect(strict.output).toContain('SOURCE HASHES INCOMPLETE');
      expect(strict.output).not.toContain(UNQUALIFIED_PASS);
    });
  }, 120_000);

  it('BYPASS 1c: an artifact that records ZERO in-repo sources fails strict (sourceCount = 0)', () => {
    withFixture('zero-in-repo-sources', (_lenient, strict) => {
      // Nothing is "unresolved" here — the old code would print a green ✅ 0 source(s) tick.
      expect(strict.output).toMatch(/Registry\s+\w{16}\s+✅ 0 source\(s\)/);
      expect(strict.status, strict.output).toBe(1);
      expect(strict.output).toContain('NO SOURCE HASHES');
      expect(strict.output).not.toContain(UNQUALIFIED_PASS);
    });
  }, 120_000);

  it('BYPASS 2: an out/ that belongs to NO git checkout fails strict instead of being filtered away', () => {
    withFixture('no-git-repo', (lenient, strict) => {
      // The reported symptom: every must-verify contract ticked against zero known revisions.
      expect(strict.output).toContain('--- upstream revisions (0) ---');
      expect(strict.status, strict.output).toBe(1);
      expect(strict.output).toContain('NO UPSTREAM PROVENANCE');
      expect(strict.output).not.toContain(UNQUALIFIED_PASS);
      expect(lenient.status, lenient.output).toBe(0);
      expect(lenient.output).not.toContain(UNQUALIFIED_PASS);
    });
  }, 120_000);

  it('still fails a STALE artifact on a clean, pinned checkout (the link that already worked)', () => {
    withFixture('stale-artifact', (_lenient, strict) => {
      expect(strict.status, strict.output).toBe(1);
      expect(strict.output).toContain('ARTIFACT ⇄ SOURCE MISMATCH');
      expect(strict.output).not.toContain(UNQUALIFIED_PASS);
    });
  }, 120_000);

  it('still fails a MISSING must-verify artifact in BOTH modes', () => {
    withFixture('missing-artifact', (lenient, strict) => {
      expect(strict.status, strict.output).toBe(1);
      expect(lenient.status, lenient.output).toBe(1);
      expect(strict.output).toContain('MUST-VERIFY NOT VERIFIED');
      expect(lenient.output).toContain('MUST-VERIFY NOT VERIFIED');
    });
  }, 120_000);

  it('still fails REAL drift against a clean upstream in both modes', () => {
    withFixture('real-drift', (lenient, strict) => {
      expect(strict.status, strict.output).toBe(1);
      expect(lenient.status, lenient.output).toBe(1);
      expect(strict.output).toContain('DRIFT: 1 contract ABI(s) differ from upstream');
    });
  }, 120_000);
});
