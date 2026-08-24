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
 * Round six added the two COVERAGE cases (a counted entry that carries no comparable hash; a count
 * that came from an unrelated file), and round seven the five DECLARATION cases plus the PASS-SCOPE
 * case: an artifact whose `settings.compilationTarget` is missing / malformed / claims another
 * contract / claims this one twice must not have a main source guessed for it, and the green
 * sentence may only speak for the MUST_VERIFY set it actually enforces.
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

/**
 * Every contract in the script's MUST_VERIFY set. A fixture missing one of these would fail for
 * "MUST-VERIFY NOT VERIFIED" instead of the reason under test, so all four are always present.
 */
const CONTRACTS = ['Registry', 'BLSAggregator', 'DVTValidator', 'SuperPaymaster'] as const;

/** A checked contract that is NOT must-verify — used by the PASS-scope case. */
const NON_MUST_CONTRACT = 'GasTokenFactory';

/** The exact sentence a run may only print when the whole must-verify chain held. */
const UNCONDITIONAL_PASS = `and all ${CONTRACTS.length} must-verify artifacts hash-match every source they record`;

/**
 * The round-6 sentence. It claimed source verification for EVERY checked artifact while only the
 * must-verify set is ever enforced, so a run could print it a few lines under its own
 * "0 source(s) verified, 1 not covered" (CC-50 round-7 MEDIUM-2). It must never reappear.
 */
const OVERSTATED_PASS = 'every artifact hash-matches the sources it records';

/** Identical on both sides, so the signature-set comparison is never the thing that fails. */
function abiFor(name: string): unknown[] {
  return [
    { type: 'function', name: `ping${name}`, stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  ];
}

function sourceFor(name: string): string {
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
  /** the contract's own source entry carries NO comparable keccak256 (urls-only / null) */
  | 'unhashable-source-entry'
  /** the contract's own source lives outside the repo; an UNRELATED in-repo source is hashed instead */
  | 'main-source-outside-repo'
  /** compilationTarget has ONE entry and it names a DIFFERENT contract (round-6 single-key fallback) */
  | 'target-single-key-other-contract'
  /** compilationTarget names several targets, none of them this contract; `sourceName` decoys */
  | 'target-claims-nothing'
  /** no compilationTarget at all; `sourceName` points at an unrelated, correctly-hashed sibling */
  | 'target-missing-sourcename-decoy'
  /** compilationTarget is a string, not solc's object; the whole block used to be skipped */
  | 'target-malformed'
  /** two compilationTarget entries both claim this contract — the artifact identifies no ONE source */
  | 'target-claims-twice'
  /** a CHECKED but non-must-verify contract with zero source coverage (PASS-scope wording) */
  | 'non-must-source-gap'
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
  // A fifth contract that IS checked but is NOT in MUST_VERIFY, so its provenance gap can never
  // fail the gate — only the PASS wording can report it honestly.
  if (bypass === 'non-must-source-gap') {
    writeFileSync(join(srcDir, `${NON_MUST_CONTRACT}.sol`), sourceFor(NON_MUST_CONTRACT));
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
    const sources: Record<string, unknown> = {
      [rel]: { keccak256: keccak256(toBytes(sourceFor(name))) },
    };
    // solc's own answer to "which source declares this contract" — what the coverage gate reads.
    let metadata: unknown = { sources, settings: { compilationTarget: { [rel]: name } } };
    // Only the decoy cases set it: a hardhat-shaped `sourceName` the round-6 fallback chain trusted
    // whenever compilationTarget did not hand back an answer.
    let sourceName: string | undefined;

    // ---------------------------------------------------------------------------------------
    // CC-50 round-7 MEDIUM-1. Four artifact shapes in which compilationTarget exists-but-does-not-
    // claim / is missing / is malformed, plus one in which it claims the contract TWICE. Round-6
    // resolved a main source anyway (single key -> `sourceName` -> `<Name>.sol`), landed on an
    // UNRELATED but correctly-hashed in-repo sibling, and exited 0 under --strict with the
    // unconditional PASS while `contracts/src/Registry.sol` was never hashed.
    // ---------------------------------------------------------------------------------------
    const sibling = `contracts/src/${'BLSAggregator'}.sol`;
    const siblingSource = { keccak256: keccak256(toBytes(sourceFor('BLSAggregator'))) };
    if (name === 'Registry') {
      if (bypass === 'target-single-key-other-contract') {
        // ONE key, and it says this artifact compiled BLSAggregator. Round-6: `only.length === 1`.
        metadata = {
          sources: { [sibling]: siblingSource },
          settings: { compilationTarget: { [sibling]: 'BLSAggregator' } },
        };
      }
      if (bypass === 'target-claims-nothing') {
        const dvt = 'contracts/src/DVTValidator.sol';
        metadata = {
          sources: { [sibling]: siblingSource, [dvt]: { keccak256: keccak256(toBytes(sourceFor('DVTValidator'))) } },
          settings: { compilationTarget: { [sibling]: 'BLSAggregator', [dvt]: 'DVTValidator' } },
        };
        sourceName = sibling;
      }
      if (bypass === 'target-missing-sourcename-decoy') {
        metadata = { sources: { [sibling]: siblingSource } };
        sourceName = sibling;
      }
      if (bypass === 'target-malformed') {
        // A string where solc writes an object: round-6's `typeof target === 'object'` guard fell
        // straight through to `sourceName`, so a malformed declaration was WEAKER than none.
        metadata = { sources: { [sibling]: siblingSource }, settings: { compilationTarget: rel } };
        sourceName = sibling;
      }
      if (bypass === 'target-claims-twice') {
        // Both entries are in-repo and hash correctly, so nothing else in the chain complains —
        // the artifact simply does not identify ONE source for Registry. Round-6 took the first.
        metadata = {
          sources: { [rel]: { keccak256: keccak256(toBytes(sourceFor(name))) }, [sibling]: siblingSource },
          settings: { compilationTarget: { [rel]: name, [sibling]: name } },
        };
      }
    }
    if (bypass === 'no-metadata-sources' && name === 'Registry') metadata = undefined;
    if (bypass === 'unhashable-source-entry' && name === 'Registry') {
      // The file is in-repo and on disk, and it IS the contract's own source — but the artifact
      // records no hash for it, so there is nothing to compare. The old code counted the entry
      // (`sourceCount++`) and only then tested `typeof entry?.keccak256 === 'string'`, so this
      // printed "✅ 1 source(s)" over a file whose bytes were never read.
      metadata = {
        sources: { [rel]: { urls: ['bzz-raw://deadbeef'], license: 'MIT' } },
        settings: { compilationTarget: { [rel]: name } },
      };
    }
    if (bypass === 'main-source-outside-repo' && name === 'Registry') {
      // Registry's own source resolves OUTSIDE the repo (a vendored/remapped tree), while an
      // unrelated in-repo source is recorded with a correct hash. Counting alone gives
      // sourceCount = 1 and a green tick, though not one byte of Registry.sol was verified.
      const sibling = 'contracts/src/BLSAggregator.sol';
      metadata = {
        sources: {
          [sibling]: { keccak256: keccak256(toBytes(sourceFor('BLSAggregator'))) },
          '../vendor/Registry.sol': { keccak256: keccak256(toBytes(sourceFor('Registry'))) },
        },
        settings: { compilationTarget: { '../vendor/Registry.sol': 'Registry' } },
      };
    }
    if (bypass === 'unresolved-source' && name === 'Registry') {
      metadata = {
        sources: { 'contracts/src/Ghost.sol': { keccak256: keccak256(toBytes('ghost')) } },
        settings: { compilationTarget: { 'contracts/src/Ghost.sol': name } },
      };
    }
    if (bypass === 'zero-in-repo-sources' && name === 'Registry') {
      // Resolves OUTSIDE the repo root, so the script skips it as "the dependency's problem" and
      // ends up having hashed nothing at all for this contract.
      metadata = {
        sources: { '../vendor/Outside.sol': { keccak256: keccak256(toBytes('outside')) } },
        settings: { compilationTarget: { '../vendor/Outside.sol': name } },
      };
    }
    writeFileSync(
      join(outDir, `${name}.json`),
      JSON.stringify(
        { abi: abiFor(name), bytecode: { object: '0x60006000fd' }, metadata, ...(sourceName ? { sourceName } : {}) },
        null,
        2,
      ),
    );
  }

  if (bypass === 'non-must-source-gap') {
    // Checked (vendored ABI + upstream artifact) but outside MUST_VERIFY, and carrying NO
    // metadata.sources at all: zero source coverage that the release gate does not — and should
    // not — fail on. The PASS sentence is the only thing that can misreport it.
    const outDir = join(upstreamRoot, 'out', `${NON_MUST_CONTRACT}.sol`);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      join(outDir, `${NON_MUST_CONTRACT}.json`),
      JSON.stringify({ abi: abiFor(NON_MUST_CONTRACT), bytecode: { object: '0x60006000fd' } }, null, 2),
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

  if (bypass === 'non-must-source-gap') {
    const abi = abiFor(NON_MUST_CONTRACT);
    writeFileSync(join(abisDir, `${NON_MUST_CONTRACT}.json`), JSON.stringify(abi, null, 2));
    contracts[NON_MUST_CONTRACT] = {
      abiSha256: createHash('sha256').update(JSON.stringify(abi)).digest('hex'),
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
      // The unconditional sentence is allowed here, and ONLY here — scoped to must-verify, never
      // the round-6 "every artifact" overstatement.
      expect(strict.output).toContain(UNCONDITIONAL_PASS);
      expect(strict.output).not.toContain(OVERSTATED_PASS);
      expect(strict.output).not.toContain('NOT RELEASE-SCOPE CAVEAT');
      expect(strict.output).toContain('Attributed to committed upstream revision(s): SuperPaymaster@');
      expect(strict.output).not.toContain('MUST-VERIFY PROVENANCE INCOMPLETE');
      // Sanity: it really did hash the sources rather than skipping them.
      expect(strict.output).toMatch(/Registry\s+\w{16}\s+✅ 1 source\(s\) verified/);
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
      expect(strict.output).not.toContain(UNCONDITIONAL_PASS);
      // Lenient stays usable for a developer mid-edit, but must not overstate what it checked.
      expect(lenient.status, lenient.output).toBe(0);
      expect(lenient.output).not.toContain(UNCONDITIONAL_PASS);
      expect(lenient.output).toContain('INCOMPLETE PROVENANCE');
      expect(lenient.output).toContain('LENIENT MODE');
    });
  }, 120_000);

  it('BYPASS 1b: a source named in metadata but absent on disk fails strict', () => {
    withFixture('unresolved-source', (_lenient, strict) => {
      expect(strict.output).toContain('contracts/src/Ghost.sol');
      expect(strict.status, strict.output).toBe(1);
      expect(strict.output).toContain('SOURCE HASHES INCOMPLETE');
      expect(strict.output).not.toContain(UNCONDITIONAL_PASS);
    });
  }, 120_000);

  it('BYPASS 1c: an artifact that records ZERO in-repo sources fails strict (sourceCount = 0)', () => {
    withFixture('zero-in-repo-sources', (_lenient, strict) => {
      // Nothing is "unresolved" here — the old code would print a green ✅ 0 source(s) tick.
      expect(strict.output).toMatch(/Registry\s+\w{16}\s+⚠️  0 source\(s\) verified, 1 not covered/);
      expect(strict.status, strict.output).toBe(1);
      expect(strict.output).toContain('NO SOURCE HASHES');
      expect(strict.output).not.toContain(UNCONDITIONAL_PASS);
    });
  }, 120_000);

  // ---------------------------------------------------------------------------------------
  // CC-50 round-6 MEDIUM: `sourceCount` was a COUNT, not COVERAGE. Both cases below exited 0
  // under --strict and printed the unqualified PASS while the must-verify contract's own
  // source was never compared. They are independent: (a) breaks the entry, (b) breaks which
  // file the entry points at.
  // ---------------------------------------------------------------------------------------
  it('COVERAGE a: a source entry with no comparable keccak256 is a gap, not a counted ✅', () => {
    withFixture('unhashable-source-entry', (lenient, strict) => {
      // The fixture really is the reported shape: in-repo, on disk, and the ONLY source recorded.
      expect(strict.output).toContain('contracts/src/Registry.sol (no usable keccak256 in the artifact)');
      // It must never be counted as verified — that tick was the false claim.
      expect(strict.output).not.toMatch(/Registry\s+\w{16}\s+✅ 1 source\(s\) verified/);
      expect(strict.status, strict.output).toBe(1);
      expect(strict.output).toContain('MUST-VERIFY PROVENANCE INCOMPLETE');
      expect(strict.output).toContain('carry no usable keccak256');
      // Zero bytes were compared, so the "no source hashes" claim must fire too.
      expect(strict.output).toContain('NO SOURCE HASHES');
      expect(strict.output).toContain('MAIN SOURCE NOT VERIFIED');
      expect(strict.output).not.toContain(UNCONDITIONAL_PASS);
      expect(lenient.status, lenient.output).toBe(0);
      expect(lenient.output).not.toContain(UNCONDITIONAL_PASS);
      expect(lenient.output).toContain('LENIENT MODE');
    });
  }, 120_000);

  it('COVERAGE b: an unrelated in-repo source cannot stand in for the contract\'s own source', () => {
    withFixture('main-source-outside-repo', (lenient, strict) => {
      // The fixture reproduces the bypass exactly: one in-repo source IS verified, so a
      // count-based rule sees `sourceCount = 1` and ticks green…
      expect(strict.output).toMatch(/Registry\s+\w{16}\s+⚠️  1 source\(s\) verified, 1 not covered/);
      // …and the only entry it reports as NOT covered is Registry's own source, i.e. the one
      // source that was verified is the unrelated sibling.
      expect(strict.output).toContain('../vendor/Registry.sol (resolves outside this repo)');
      // …while Registry.sol itself was never hashed. Coverage, not counting:
      expect(strict.status, strict.output).toBe(1);
      expect(strict.output).toContain('MUST-VERIFY PROVENANCE INCOMPLETE');
      expect(strict.output).toContain(
        'MAIN SOURCE NOT VERIFIED: ../vendor/Registry.sol — it resolves OUTSIDE the repo this artifact is attributed to',
      );
      // NO SOURCE HASHES must NOT be what saves us here — one source really was verified, which
      // is precisely why the count-based rule let this through.
      expect(strict.output).not.toContain('NO SOURCE HASHES');
      expect(strict.output).not.toContain(UNCONDITIONAL_PASS);
      expect(lenient.status, lenient.output).toBe(0);
      expect(lenient.output).not.toContain(UNCONDITIONAL_PASS);
      expect(lenient.output).toContain('LENIENT MODE');
    });
  }, 120_000);

  // ---------------------------------------------------------------------------------------
  // CC-50 round-7 MEDIUM-1: the main source must come from the artifact's OWN declaration.
  // Every case below was measured exiting 0 under --strict on b2399ebf with the unconditional
  // PASS, because `mainSourceOf` kept guessing after compilationTarget declined to answer.
  // Each fixture keeps the rest of the chain intact (clean, committed, pinned upstream; every
  // recorded source in-repo, on disk and correctly hashed) so ONLY the declaration gate can be
  // what fails — that is the mutation proof.
  // ---------------------------------------------------------------------------------------
  const declarationBypasses: Array<{ bypass: Bypass; what: string; label: string; expectRow: RegExp; because: string }> = [
    {
      bypass: 'target-single-key-other-contract',
      what: 'a single-key compilationTarget naming a DIFFERENT contract',
      label: 'MAIN SOURCE UNDECLARED',
      expectRow: /Registry\s+\w{16}\s+✅ 1 source\(s\) verified/,
      because: 'NONE of them is Registry',
    },
    {
      bypass: 'target-claims-nothing',
      what: 'a compilationTarget that claims other contracts, with sourceName decoying',
      label: 'MAIN SOURCE UNDECLARED',
      expectRow: /Registry\s+\w{16}\s+✅ 2 source\(s\) verified/,
      because: 'names 2 target(s) and NONE of them is Registry',
    },
    {
      bypass: 'target-missing-sourcename-decoy',
      what: 'no compilationTarget at all, with sourceName decoying',
      label: 'MAIN SOURCE UNDECLARED',
      expectRow: /Registry\s+\w{16}\s+✅ 1 source\(s\) verified/,
      because: 'declares no metadata.settings.compilationTarget',
    },
    {
      bypass: 'target-malformed',
      what: 'a malformed (string) compilationTarget',
      label: 'MAIN SOURCE UNDECLARED',
      expectRow: /Registry\s+\w{16}\s+✅ 1 source\(s\) verified/,
      because: 'compilationTarget is string',
    },
    {
      bypass: 'target-claims-twice',
      what: 'a compilationTarget that claims this contract TWICE',
      label: 'MAIN SOURCE AMBIGUOUS',
      expectRow: /Registry\s+\w{16}\s+✅ 2 source\(s\) verified/,
      because: 'claims Registry 2 times',
    },
  ];

  for (const { bypass, what, label, expectRow, because } of declarationBypasses) {
    it(`DECLARATION: ${what} fails strict instead of resolving an unrelated source`, () => {
      withFixture(bypass, (lenient, strict) => {
        // The fixture really is the green-looking shape: every source the artifact records WAS
        // hashed and matched, so counting/coverage-by-count sees nothing wrong…
        expect(strict.output).toMatch(expectRow);
        expect(strict.output).not.toContain('NO SOURCE HASHES');
        expect(strict.output).not.toContain('SOURCE HASHES INCOMPLETE');
        expect(strict.output).not.toContain('ARTIFACT ⇄ SOURCE MISMATCH');
        // …and yet Registry.sol itself was never attributed. Fail closed, do not guess:
        expect(strict.status, strict.output).toBe(1);
        expect(strict.output).toContain('MUST-VERIFY PROVENANCE INCOMPLETE');
        expect(strict.output).toContain(label);
        expect(strict.output).toContain(because);
        expect(strict.output).not.toContain(UNCONDITIONAL_PASS);
        expect(strict.output).not.toContain(OVERSTATED_PASS);
        // Lenient stays usable, but must not print a green it did not earn.
        expect(lenient.status, lenient.output).toBe(0);
        expect(lenient.output).not.toContain(UNCONDITIONAL_PASS);
        expect(lenient.output).toContain('INCOMPLETE PROVENANCE');
        expect(lenient.output).toContain('LENIENT MODE');
      });
    }, 120_000);
  }

  // ---------------------------------------------------------------------------------------
  // CC-50 round-7 MEDIUM-2: PASS scope. Source coverage is enforced for MUST_VERIFY only, so the
  // green sentence may only speak for that set — and anything else with a gap must be named.
  // ---------------------------------------------------------------------------------------
  it('SCOPE: a checked NON-must-verify artifact with zero source coverage passes, but is named as a non-release-scope caveat', () => {
    withFixture('non-must-source-gap', (lenient, strict) => {
      // The fixture reproduces the reported self-contradiction: the checked table says this
      // artifact verified nothing…
      expect(strict.output).toMatch(/GasTokenFactory\s+\w{16}\s+⚠️  0 source\(s\) verified, 1 not covered/);
      // …while the must-verify set really is complete, so the run legitimately exits 0.
      expect(strict.status, strict.output).toBe(0);
      expect(strict.output).not.toContain('MUST-VERIFY PROVENANCE INCOMPLETE');
      // The green may only claim what was enforced, and must not fold the gap into "every artifact".
      expect(strict.output).toContain(UNCONDITIONAL_PASS);
      expect(strict.output).not.toContain(OVERSTATED_PASS);
      expect(strict.output).toContain(
        'NOT RELEASE-SCOPE CAVEAT: 1 further checked artifact(s) are outside the must-verify set',
      );
      expect(strict.output).toContain('GasTokenFactory');
      expect(lenient.status, lenient.output).toBe(0);
      expect(lenient.output).toContain('NOT RELEASE-SCOPE CAVEAT');
    });
  }, 120_000);

  it('BYPASS 2: an out/ that belongs to NO git checkout fails strict instead of being filtered away', () => {
    withFixture('no-git-repo', (lenient, strict) => {
      // The reported symptom: every must-verify contract ticked against zero known revisions.
      expect(strict.output).toContain('--- upstream revisions (0) ---');
      expect(strict.status, strict.output).toBe(1);
      expect(strict.output).toContain('NO UPSTREAM PROVENANCE');
      expect(strict.output).not.toContain(UNCONDITIONAL_PASS);
      expect(lenient.status, lenient.output).toBe(0);
      expect(lenient.output).not.toContain(UNCONDITIONAL_PASS);
    });
  }, 120_000);

  it('still fails a STALE artifact on a clean, pinned checkout (the link that already worked)', () => {
    withFixture('stale-artifact', (_lenient, strict) => {
      expect(strict.status, strict.output).toBe(1);
      expect(strict.output).toContain('ARTIFACT ⇄ SOURCE MISMATCH');
      expect(strict.output).not.toContain(UNCONDITIONAL_PASS);
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
