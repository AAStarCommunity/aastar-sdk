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
 * contract / claims this one twice / declares an extra target beside the correct one must not have
 * a main source guessed for it, and the green sentence may only speak for the MUST_VERIFY set it
 * actually enforces.
 *
 * Round eight added the PIN cases: round seven forced the declaration's VALUE (the contract name)
 * and never checked its KEY, so an artifact declaring `{ "<some other verified file>": "Registry" }`
 * exited 0 under `--strict` with the unconditional PASS while `contracts/src/Registry.sol` was never
 * hashed. The path is now compared byte-exact against a reviewed pin, and the cases below cover a
 * wrong path with the right name, a missing pin, a wrong pin over a correct artifact, a pin that can
 * escape its repo (`..` / absolute), and a pin belonging to another checkout — plus one REAL case
 * that holds the four shipped pins against the actual sibling artifacts.
 *
 * The already-working links (stale artifact, missing artifact, drift) are pinned here too, so a
 * later edit cannot trade one gate away for another.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
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

/** Declared upstream, vendored in the SDK, never built — the `expectedMissing` shape. */
const EXPECTED_MISSING_CONTRACT = 'CreditVaultGadget';

/** The fixture's upstream checkout, and the repo label the script derives from its directory name. */
const UPSTREAM_LABEL = 'SuperPaymaster';

/** A second, fully pinned repo label the fixture never builds — used by the repo-mismatch case. */
const OTHER_REPO_LABEL = 'airaccount-contract';

/** The exact sentence a run may only print when the whole must-verify chain held. */
const UNCONDITIONAL_PASS = `and all ${CONTRACTS.length} must-verify artifacts hash-match every source they record`;

/**
 * The round-6 sentence. It claimed source verification for EVERY checked artifact while only the
 * must-verify set is ever enforced, so a run could print it a few lines under its own
 * "0 source(s) verified, 1 not covered" (CC-50 round-7 MEDIUM-2). It must never reappear.
 */
const OVERSTATED_PASS = 'every artifact hash-matches the sources it records';

/**
 * The strict-mode sentence that names the revision the ABIs are attributed to. It is a claim about
 * BYTES, so it may only be printed when every must-verify source was proved to be a regular blob in
 * the pinned revision whose content equals the file this run read (CC-50 round-9 MEDIUM).
 */
const ATTRIBUTED_SENTENCE = 'Attributed to committed upstream revision(s)';

/**
 * The REAL pin check needs the sibling upstream checkouts. A missing artifact is a FAILURE, never a
 * `0/4` green (CC-50 round-9 LOW): the whole point of that case is that it is the only assertion in
 * this file made against real data, so silently measuring nothing is exactly the vacuous PASS the
 * gate exists to remove.
 *
 * An environment that genuinely has no upstreams — GitHub Actions, per the rationale block in
 * .github/workflows/ci.yml — must SAY SO by setting `REPCREDIT_UPSTREAM_ARTIFACTS=absent`. That
 * marks the test SKIPPED (visible in the run summary and in the skipped count), which is a
 * different signal from PASSED. Nothing infers absence on its own.
 */
const UPSTREAM_ARTIFACTS_ABSENT = process.env.REPCREDIT_UPSTREAM_ARTIFACTS === 'absent';

/** Identical on both sides, so the signature-set comparison is never the thing that fails. */
function abiFor(name: string): unknown[] {
  return [
    { type: 'function', name: `ping${name}`, stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  ];
}

/** A dependency source that lives in a submodule, not in the superproject's own tree. */
const DEP_SOURCE = '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.28;\n\nlibrary DepLib { }\n';

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
  /** compilationTarget claims this contract correctly AND declares an extra, unrelated target */
  | 'target-claims-plus-extra'
  /** ONE target, value === this contract, key = an unrelated file that hashes fine (round-8) */
  | 'declared-path-not-pinned'
  /** the pin declares no repo/sourcePath for a must-verify contract */
  | 'pin-source-path-missing'
  /** the pin names a different (also verified, in-repo) file than the artifact declares */
  | 'pin-source-path-wrong'
  /** the pinned sourcePath escapes the repo it is pinned to */
  | 'pin-source-path-traversal'
  /** the pinned sourcePath is absolute, so it is not inside the pinned repo at all */
  | 'pin-source-path-absolute'
  /** the pinned path is fine, but it is pinned to a DIFFERENT repo than the artifact came from */
  | 'pin-repo-mismatch'
  /** a CHECKED but non-must-verify contract with zero source coverage (PASS-scope wording) */
  | 'non-must-source-gap'
  /** the same gap, in a run that ALSO has an expected-but-missing artifact (third PASS path) */
  | 'expected-missing-plus-non-must-gap'
  /** out/ belongs to no git checkout */
  | 'no-git-repo'
  /** artifact was built before the last (committed) source edit */
  | 'stale-artifact'
  /** the artifact simply is not there */
  | 'missing-artifact'
  /** the SDK's vendored ABI genuinely differs from a clean, committed upstream */
  | 'real-drift'
  // ---------------------------------------------------------------------------------------
  // CC-50 round-9 MEDIUM: BYTE ATTRIBUTION. Everything above settles WHICH path the artifact
  // must have come from. These settle whether the pinned REVISION actually contains the bytes
  // at that path — the link that was only ever a `startsWith(repoRoot + sep)` string test with
  // a `readFileSync` that follows links.
  // ---------------------------------------------------------------------------------------
  /** the pinned source is a COMMITTED symlink to a file outside the repo (the measured bypass) */
  | 'worktree-source-symlink-outside'
  /** the same, pointing INSIDE the repo — a realpath-prefix mitigation alone would pass this */
  | 'worktree-source-symlink-inside'
  /** the pinned source is a regular file on disk that the pinned revision does not track at all */
  | 'source-untracked-gitignored'
  /** worktree has a regular file; the PINNED revision has that path as a symlink */
  | 'pinned-entry-symlink'
  /** worktree has a regular file; the PINNED revision has that path as a submodule gitlink */
  | 'pinned-entry-submodule'
  /** worktree file and artifact agree perfectly, but those bytes are not in the pinned revision */
  | 'worktree-bytes-differ-from-pinned-blob'
  /** POSITIVE: a source inside a PINNED submodule is attributed through the gitlink */
  | 'source-in-pinned-submodule';

type Fixture = { root: string; sdkRoot: string; upstreamRoot: string };

function git(root: string, args: string[]): string {
  // advice.addEmbeddedRepo off: the submodule fixtures add a nested repo on purpose and the hint
  // is 15 lines of stderr per case.
  return execFileSync('git', ['-c', 'advice.addEmbeddedRepo=false', '-C', root, ...args], { encoding: 'utf8' });
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

  // ---------------------------------------------------------------------------------------
  // CC-50 round-9. Shape `contracts/src/Registry.sol` ITSELF. Every case below leaves the whole
  // rest of the chain intact — clean checkout, HEAD == pin (except where noted), exactly one
  // compilation target whose key is byte-exact the pinned path and whose value is `Registry`,
  // and an artifact whose keccak256 matches the bytes a naive `readFileSync` returns. That is
  // what makes the byte-attribution link provably the only thing that can fail.
  // ---------------------------------------------------------------------------------------
  const registrySol = join(srcDir, 'Registry.sol');
  /** What `contracts/src/Registry.sol` finally holds — the bytes the artifact must record. */
  let registryContent = sourceFor('Registry');
  if (bypass === 'worktree-source-symlink-outside') {
    // The measured bypass: the pinned path is a committed symlink whose target is OUTSIDE the
    // repo. solc hashes the target's bytes, the gate re-hashed the same target's bytes, and the
    // revision named in `Attributed to committed upstream revision(s)` holds only the link.
    const outside = join(root, 'outside');
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, 'Registry.sol'), sourceFor('Registry'));
    rmSync(registrySol);
    symlinkSync('../../../outside/Registry.sol', registrySol);
  }
  if (bypass === 'worktree-source-symlink-inside') {
    // Same shape, target INSIDE the repo and itself committed. A realpath-prefix check — the
    // narrow mitigation proposed for round 9 — would pass this: the resolved path really is under
    // the repo root and the bytes really are in the revision, just not at the pinned path.
    writeFileSync(join(srcDir, 'Registry.impl.sol'), sourceFor('Registry'));
    rmSync(registrySol);
    symlinkSync('Registry.impl.sol', registrySol);
  }
  if (bypass === 'pinned-entry-symlink' || bypass === 'pinned-entry-submodule') {
    // Committed FIRST as a non-blob, then replaced by a regular file in a second commit that
    // becomes HEAD. The pin below stays on the first commit, which is the only way a working tree
    // can hold a regular file while the pinned tree holds a symlink/gitlink without being dirty.
    writeFileSync(join(srcDir, 'Registry.impl.sol'), sourceFor('Registry'));
    rmSync(registrySol);
    if (bypass === 'pinned-entry-symlink') {
      symlinkSync('Registry.impl.sol', registrySol);
    } else {
      // A nested git repo at that path is exactly what a submodule looks like on disk, and the
      // parent records it as a 160000 gitlink.
      mkdirSync(registrySol, { recursive: true });
      writeFileSync(join(registrySol, 'placeholder.txt'), 'nested repo standing in for a submodule\n');
      git(registrySol, ['init', '-q', '-b', 'main']);
      git(registrySol, ['config', 'user.email', 'fixture@example.invalid']);
      git(registrySol, ['config', 'user.name', 'fixture']);
      git(registrySol, ['add', '-A']);
      git(registrySol, ['commit', '-q', '-m', 'nested']);
    }
  }
  if (bypass === 'worktree-bytes-differ-from-pinned-blob') {
    // First commit carries one revision of the file; the second (HEAD) carries another. The
    // artifact is built from the SECOND, so artifact ⇄ working tree agree byte for byte — and the
    // pinned revision still does not contain those bytes.
    writeFileSync(registrySol, sourceFor('Registry'));
  }
  if (bypass === 'source-in-pinned-submodule') {
    // POSITIVE. Foundry dependencies live in submodules and `ls-tree -r` stops at the gitlink, so
    // a gate that only looked for a direct tree entry would reject every artifact that records a
    // lib source. The superproject's pinned revision DOES fix these bytes — through the exact
    // commit id in the gitlink — so attribution must follow it.
    const dep = join(upstreamRoot, 'contracts/lib/dep');
    mkdirSync(dep, { recursive: true });
    writeFileSync(join(dep, 'Dep.sol'), DEP_SOURCE);
    git(dep, ['init', '-q', '-b', 'main']);
    git(dep, ['config', 'user.email', 'fixture@example.invalid']);
    git(dep, ['config', 'user.name', 'fixture']);
    git(dep, ['add', '-A']);
    git(dep, ['commit', '-q', '-m', 'dep']);
  }
  // A fifth contract that IS checked but is NOT in MUST_VERIFY, so its provenance gap can never
  // fail the gate — only the PASS wording can report it honestly.
  // Both PASS-scope cases carry the same non-must-verify gap; only one of them ALSO makes the run
  // take the `expectedMissing` branch (CC-50 round-8 LOW-3).
  const hasNonMustGap = bypass === 'non-must-source-gap' || bypass === 'expected-missing-plus-non-must-gap';
  if (hasNonMustGap) {
    writeFileSync(join(srcDir, `${NON_MUST_CONTRACT}.sol`), sourceFor(NON_MUST_CONTRACT));
  }
  if (bypass === 'expected-missing-plus-non-must-gap') {
    // Declared in the upstream `src/` tree with an SDK ABI and NO artifact: the `forge clean` shape
    // that makes `expectedMissing` non-empty, on a contract outside MUST_VERIFY so the lenient run
    // still reaches a PASS.
    writeFileSync(join(srcDir, `${EXPECTED_MISSING_CONTRACT}.sol`), sourceFor(EXPECTED_MISSING_CONTRACT));
  }
  // Foundry repos gitignore `out/`; without this the build products themselves would read as
  // uncommitted changes and every case would fail for the wrong reason.
  writeFileSync(join(upstreamRoot, '.gitignore'), 'out/\n');
  if (bypass === 'source-untracked-gitignored') {
    // A regular file, in-repo, correct bytes, and the checkout stays CLEAN — because the pinned
    // path is gitignored, so the revision tracks nothing at all there. The generated-code shape,
    // and the purest form of "these bytes are not in that revision": the blob does not exist.
    appendFileSync(join(upstreamRoot, '.gitignore'), 'contracts/src/Registry.sol\n');
  }

  if (bypass !== 'no-git-repo') {
    git(upstreamRoot, ['init', '-q', '-b', 'main']);
    git(upstreamRoot, ['config', 'user.email', 'fixture@example.invalid']);
    git(upstreamRoot, ['config', 'user.name', 'fixture']);
    git(upstreamRoot, ['add', '-A']);
    git(upstreamRoot, ['commit', '-q', '-m', 'fixture upstream']);
  }

  // CC-50 round-9. A working tree can only hold a REGULAR file at a path whose pinned tree holds a
  // symlink/gitlink — or hold bytes the pinned tree does not have — if the pin names an EARLIER
  // commit. So these three cases pin the commit just made and then move HEAD on. That necessarily
  // also raises `UNUSABLE CHECKOUT` (pin != HEAD); the assertions below name the new gap
  // specifically, and the symlink/untracked cases above have no such companion at all.
  let pinnedRevisionOverride: string | null = null;
  if (
    bypass === 'pinned-entry-symlink' ||
    bypass === 'pinned-entry-submodule' ||
    bypass === 'worktree-bytes-differ-from-pinned-blob'
  ) {
    pinnedRevisionOverride = git(upstreamRoot, ['rev-parse', 'HEAD']).trim();
    if (bypass === 'worktree-bytes-differ-from-pinned-blob') {
      registryContent = `${sourceFor('Registry')}// the revision the artifact was actually built from\n`;
      writeFileSync(registrySol, registryContent);
    } else {
      rmSync(registrySol, { recursive: true, force: true });
      writeFileSync(registrySol, registryContent);
    }
    git(upstreamRoot, ['add', '-A']);
    git(upstreamRoot, ['commit', '-q', '-m', 'replace with a regular file']);
  }

  // Artifacts. `metadata.sources[rel].keccak256` is solc's own hash of the input file; the script
  // recomputes it over the working tree, which is what makes the artifact⇄source link cryptographic.
  for (const name of CONTRACTS) {
    if (bypass === 'missing-artifact' && name === 'Registry') continue;
    const rel = `contracts/src/${name}.sol`;
    const outDir = join(upstreamRoot, 'out', `${name}.sol`);
    mkdirSync(outDir, { recursive: true });
    const sources: Record<string, unknown> = {
      [rel]: { keccak256: keccak256(toBytes(name === 'Registry' ? registryContent : sourceFor(name))) },
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
      if (bypass === 'target-claims-plus-extra') {
        // ONE entry claims Registry correctly and hashes correctly; the artifact just declares a
        // second, unrelated target. Picking the matching entry out of several is still a guess, and
        // a multi-target artifact is not the single-contract artifact this attribution is about
        // ([from:docs] round-7 boundary correction).
        metadata = {
          sources: { [rel]: { keccak256: keccak256(toBytes(sourceFor(name))) }, [sibling]: siblingSource },
          settings: { compilationTarget: { [rel]: name, [sibling]: 'BLSAggregator' } },
        };
      }
      if (bypass === 'declared-path-not-pinned') {
        // CC-50 round-8 MEDIUM. EXACTLY ONE target and its value IS `Registry`, so every round-7
        // check passes — but the key names a sibling. That sibling is in-repo, on disk and hashes
        // correctly, so nothing else in the chain complains, while `contracts/src/Registry.sol` is
        // not recorded, not hashed, and does not appear in the output at all.
        metadata = {
          sources: { [sibling]: siblingSource },
          settings: { compilationTarget: { [sibling]: name } },
        };
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
    if (bypass === 'source-in-pinned-submodule' && name === 'Registry') {
      // An extra recorded source that lives in the submodule, with its true keccak256. Attribution
      // has to walk superproject@rev -> gitlink oid -> blob to reach it.
      metadata = {
        sources: { ...sources, 'contracts/lib/dep/Dep.sol': { keccak256: keccak256(toBytes(DEP_SOURCE)) } },
        settings: { compilationTarget: { [rel]: name } },
      };
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

  if (hasNonMustGap) {
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
  type ContractPin = { abiSha256: string; repo?: string; sourcePath?: string; why: string };
  const contracts: Record<string, ContractPin> = {};
  for (const name of CONTRACTS) {
    const abi = abiFor(name);
    const vendored =
      bypass === 'real-drift' && name === 'Registry'
        ? [...abi, { type: 'function', name: 'ghost', stateMutability: 'view', inputs: [], outputs: [] }]
        : abi;
    writeFileSync(join(abisDir, `${name}.json`), JSON.stringify(vendored, null, 2));
    contracts[name] = {
      abiSha256: createHash('sha256').update(JSON.stringify(vendored)).digest('hex'),
      // The reviewed source path (CC-50 round-8). Every must-verify contract must pin one, so it is
      // the default here and only the pin cases below take it away or bend it.
      repo: UPSTREAM_LABEL,
      sourcePath: `contracts/src/${name}.sol`,
      why: 'fixture',
    };
  }
  // Round-8 pin cases. All of them leave the ARTIFACT alone (clean, committed, pinned upstream;
  // exactly one compilation target claiming this contract; every recorded source in-repo, on disk
  // and correctly hashed), so the pin binding is provably the only thing that can fail.
  if (bypass === 'pin-source-path-missing') {
    delete contracts.Registry.repo;
    delete contracts.Registry.sourcePath;
  }
  if (bypass === 'pin-source-path-wrong') {
    // Points at a sibling that IS in the verified source set — a wrong pin must not be rescued by
    // the file it names happening to hash.
    contracts.Registry.sourcePath = 'contracts/src/BLSAggregator.sol';
  }
  if (bypass === 'pin-source-path-traversal') contracts.Registry.sourcePath = '../vendor/Registry.sol';
  if (bypass === 'pin-source-path-absolute') contracts.Registry.sourcePath = '/etc/Registry.sol';
  if (bypass === 'pin-repo-mismatch') contracts.Registry.repo = OTHER_REPO_LABEL;

  if (bypass === 'expected-missing-plus-non-must-gap') {
    // An SDK ABI whose upstream artifact was never built. No pin entry: the vendored-pin check only
    // walks what the pin declares, and this contract is outside MUST_VERIFY either way.
    writeFileSync(
      join(abisDir, `${EXPECTED_MISSING_CONTRACT}.json`),
      JSON.stringify(abiFor(EXPECTED_MISSING_CONTRACT), null, 2),
    );
  }
  if (hasNonMustGap) {
    const abi = abiFor(NON_MUST_CONTRACT);
    writeFileSync(join(abisDir, `${NON_MUST_CONTRACT}.json`), JSON.stringify(abi, null, 2));
    contracts[NON_MUST_CONTRACT] = {
      abiSha256: createHash('sha256').update(JSON.stringify(abi)).digest('hex'),
      why: 'fixture',
    };
  }

  const repos: Record<string, { revision: string; why: string }> = {};
  if (bypass !== 'no-git-repo') {
    repos[UPSTREAM_LABEL] = {
      revision: pinnedRevisionOverride ?? git(upstreamRoot, ['rev-parse', 'HEAD']).trim(),
      why: 'fixture',
    };
  }
  if (bypass === 'pin-repo-mismatch') {
    // A fully pinned SECOND repo, so `pinnedSourceFor` accepts the pin and the only thing left to
    // catch is that the artifact came from the other checkout.
    repos[OTHER_REPO_LABEL] = { revision: 'a'.repeat(40), why: 'fixture' };
  }
  writeFileSync(join(sdkRoot, 'scripts/upstream-abi-pin.json'), JSON.stringify({ repos, contracts }, null, 2));

  if (bypass === 'stale-artifact') {
    // Edit AND COMMIT after the artifact was written: the checkout is clean and pinned, so only the
    // solc source hash can catch it.
    writeFileSync(join(srcDir, 'Registry.sol'), `${sourceFor('Registry')}// edited after the build\n`);
    git(upstreamRoot, ['commit', '-qam', 'edit after build']);
    repos[UPSTREAM_LABEL] = { revision: git(upstreamRoot, ['rev-parse', 'HEAD']).trim(), why: 'fixture' };
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
      // The out-of-repo entry is still reported as a gap of its own…
      expect(strict.output).toContain(
        'SOURCE HASHES INCOMPLETE: 1 source(s) resolve OUTSIDE the repo this artifact is attributed to',
      );
      // …and since round-8 the run rejects it one gate EARLIER, on identity rather than on
      // verification: a path outside the repo can never be the reviewed in-repo source path, so
      // `MAIN SOURCE PATH NOT PINNED` fires before `MAIN SOURCE NOT VERIFIED` is reached. Strictly
      // stronger — the same fixture, failed sooner. The NOT VERIFIED label is still pinned by
      // COVERAGE a, whose declared path IS the pinned one and merely carries no comparable hash.
      expect(strict.output).toContain('MAIN SOURCE PATH NOT PINNED');
      expect(strict.output).toContain('but scripts/upstream-abi-pin.json pins Registry to contracts/src/Registry.sol');
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
      expectRow: /Registry\s+\w{16}\s+⚠️  1 source\(s\) verified, main source NOT attributed/,
      because: 'declares 1 target',
    },
    {
      bypass: 'target-claims-nothing',
      what: 'a compilationTarget that claims other contracts, with sourceName decoying',
      label: 'MAIN SOURCE AMBIGUOUS',
      expectRow: /Registry\s+\w{16}\s+⚠️  2 source\(s\) verified, main source NOT attributed/,
      because: 'declares 2 targets',
    },
    {
      bypass: 'target-missing-sourcename-decoy',
      what: 'no compilationTarget at all, with sourceName decoying',
      label: 'MAIN SOURCE UNDECLARED',
      expectRow: /Registry\s+\w{16}\s+⚠️  1 source\(s\) verified, main source NOT attributed/,
      because: 'declares no metadata.settings.compilationTarget',
    },
    {
      bypass: 'target-malformed',
      what: 'a malformed (string) compilationTarget',
      label: 'MAIN SOURCE UNDECLARED',
      expectRow: /Registry\s+\w{16}\s+⚠️  1 source\(s\) verified, main source NOT attributed/,
      because: 'compilationTarget is string',
    },
    {
      bypass: 'target-claims-twice',
      what: 'a compilationTarget that claims this contract TWICE',
      label: 'MAIN SOURCE AMBIGUOUS',
      expectRow: /Registry\s+\w{16}\s+⚠️  2 source\(s\) verified, main source NOT attributed/,
      because: '2 of them claim Registry',
    },
    {
      // The declaration must be the artifact's WHOLE answer: one correct claim next to an extra,
      // unrelated target is still a set this gate would have to choose from.
      bypass: 'target-claims-plus-extra',
      what: 'a correct claim alongside an EXTRA unrelated compilation target',
      label: 'MAIN SOURCE AMBIGUOUS',
      expectRow: /Registry\s+\w{16}\s+⚠️  2 source\(s\) verified, main source NOT attributed/,
      because: '1 of them claim Registry',
    },
  ];

  for (const { bypass, what, label, expectRow, because } of declarationBypasses) {
    it(`DECLARATION: ${what} fails strict instead of resolving an unrelated source`, () => {
      withFixture(bypass, (lenient, strict) => {
        // The fixture really is the green-looking shape: every source the artifact records WAS
        // hashed and matched, so counting/coverage-by-count sees nothing wrong — the row states that
        // count with NOTHING "not covered", and is ⚠️ only because the main source was never
        // attributed (CC-50 round-8 LOW-2: a row may no longer print ✅ above its own gap).
        expect(strict.output).toMatch(expectRow);
        expect(strict.output).not.toMatch(/Registry\s+\w{16}\s+✅/);
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
  // CC-50 round-8 MEDIUM: the declaration's KEY. Round-7 forced the single compilationTarget
  // entry's VALUE to be the contract name and never looked at the path it points at, so
  // `{ "<any verified file>": "Registry" }` exited 0 under --strict with the unconditional PASS
  // while Registry.sol was never hashed and never appeared in the output. The release basis is now
  // a path this repo REVIEWED (`contracts[<name>].sourcePath` in `contracts[<name>].repo`),
  // compared byte-exact — so a wrong path, a missing pin, a pin that can escape its repo, and a
  // pin belonging to another checkout all fail closed. Every fixture below leaves the whole rest of
  // the chain intact, which is what makes the pin binding provably the only thing that fails.
  // ---------------------------------------------------------------------------------------
  it('PIN a: a well-formed declaration naming a file that is NOT the pinned source fails strict', () => {
    withFixture('declared-path-not-pinned', (lenient, strict) => {
      // The artifact satisfies every round-7 rule: EXACTLY ONE compilation target, and its value IS
      // `Registry`. The file it names is in-repo, on disk and hashes correctly, so nothing else in
      // the chain has anything to say…
      expect(strict.output).toMatch(/Registry\s+\w{16}\s+⚠️  1 source\(s\) verified, main source NOT attributed/);
      expect(strict.output).not.toContain('MAIN SOURCE UNDECLARED');
      expect(strict.output).not.toContain('MAIN SOURCE AMBIGUOUS');
      expect(strict.output).not.toContain('NO SOURCE HASHES');
      expect(strict.output).not.toContain('SOURCE HASHES INCOMPLETE');
      expect(strict.output).not.toContain('ARTIFACT ⇄ SOURCE MISMATCH');
      // …and yet the contract's own reviewed source was never hashed. That was the exit-0 bypass:
      expect(strict.status, strict.output).toBe(1);
      expect(strict.output).toContain('MUST-VERIFY PROVENANCE INCOMPLETE');
      expect(strict.output).toContain('MAIN SOURCE PATH NOT PINNED');
      expect(strict.output).toContain(
        'the artifact declares contracts/src/BLSAggregator.sol => Registry, but scripts/upstream-abi-pin.json ' +
          'pins Registry to contracts/src/Registry.sol (SuperPaymaster)',
      );
      expect(strict.output).not.toContain(UNCONDITIONAL_PASS);
      expect(strict.output).not.toContain(OVERSTATED_PASS);
      expect(lenient.status, lenient.output).toBe(0);
      expect(lenient.output).not.toContain(UNCONDITIONAL_PASS);
      expect(lenient.output).toContain('INCOMPLETE PROVENANCE');
      expect(lenient.output).toContain('LENIENT MODE');
    });
  }, 120_000);

  const pinBypasses: Array<{ bypass: Bypass; what: string; label: string; because: string }> = [
    {
      bypass: 'pin-source-path-missing',
      what: 'a must-verify contract with NO pinned source path',
      label: 'NO PINNED SOURCE PATH',
      because: 'must pin the canonical source file that declares it',
    },
    {
      // The artifact is correct and the PIN is wrong. It must fail just as hard: a green here would
      // mean the gate verified some other file's provenance and called it Registry's.
      bypass: 'pin-source-path-wrong',
      what: 'a pinned source path that disagrees with a CORRECT declaration',
      label: 'MAIN SOURCE PATH NOT PINNED',
      because: 'pins Registry to contracts/src/BLSAggregator.sol',
    },
    {
      bypass: 'pin-source-path-traversal',
      what: 'a pinned source path that escapes the repo it is pinned to',
      label: 'PINNED SOURCE PATH INVALID',
      because: 'contains an empty, "." or ".." segment',
    },
    {
      bypass: 'pin-source-path-absolute',
      what: 'an ABSOLUTE pinned source path',
      label: 'PINNED SOURCE PATH INVALID',
      because: 'is absolute — a pinned source must be relative to the upstream repo root',
    },
    {
      bypass: 'pin-repo-mismatch',
      what: 'a pinned source path belonging to a DIFFERENT pinned repo',
      label: 'MAIN SOURCE REPO MISMATCH',
      because: 'is pinned to the airaccount-contract checkout, but this artifact is attributed to SuperPaymaster',
    },
  ];

  for (const { bypass, what, label, because } of pinBypasses) {
    it(`PIN: ${what} fails strict`, () => {
      withFixture(bypass, (lenient, strict) => {
        // Same falsifiability discipline as the declaration cases: the artifact itself is perfect,
        // every recorded source is in-repo, on disk and correctly hashed, so ONLY the pin binding
        // can be what fails.
        expect(strict.output).not.toContain('NO SOURCE HASHES');
        expect(strict.output).not.toContain('SOURCE HASHES INCOMPLETE');
        expect(strict.output).not.toContain('ARTIFACT ⇄ SOURCE MISMATCH');
        expect(strict.output).not.toMatch(/Registry\s+\w{16}\s+✅/);
        expect(strict.status, strict.output).toBe(1);
        expect(strict.output).toContain('MUST-VERIFY PROVENANCE INCOMPLETE');
        expect(strict.output).toContain(label);
        expect(strict.output).toContain(because);
        expect(strict.output).not.toContain(UNCONDITIONAL_PASS);
        expect(strict.output).not.toContain(OVERSTATED_PASS);
        expect(lenient.status, lenient.output).toBe(0);
        expect(lenient.output).not.toContain(UNCONDITIONAL_PASS);
        expect(lenient.output).toContain('INCOMPLETE PROVENANCE');
        expect(lenient.output).toContain('LENIENT MODE');
      });
    }, 120_000);
  }

  // ---------------------------------------------------------------------------------------
  // CC-50 round-9 MEDIUM: BYTE ATTRIBUTION TO THE PINNED REVISION.
  //
  // Round-8 fixed WHICH path a must-verify artifact must come from. Whether the pinned REVISION
  // contains the bytes at that path was still a `path.resolve(root, rel).startsWith(root + sep)`
  // string test followed by a `readFileSync` that happily follows links. An independent reviewer
  // measured `--strict` exit 0, the unconditional PASS and
  // `Attributed to committed upstream revision(s): SuperPaymaster@…` against an upstream whose
  // `contracts/src/core/Registry.sol` was a COMMITTED SYMLINK to a file outside the repo.
  //
  // The four attribution checks are asserted one at a time, and the first two need NO help from
  // any other broken link: the checkout is clean, HEAD IS the pinned revision, the artifact
  // records exactly one compilation target whose key is byte-exact the pinned path, and its
  // keccak256 matches what a naive read returns. Only the new gate can be what fails.
  // ---------------------------------------------------------------------------------------
  const attributionBypasses: Array<{
    bypass: Bypass;
    what: string;
    label: string;
    because: string;
    /** These two need an earlier pin than HEAD, so `UNUSABLE CHECKOUT` legitimately co-fires. */
    pinBehindHead?: boolean;
    /** Asserted absent — the narrower mitigations that would NOT have caught this case. */
    notLabel?: string;
  }> = [
    {
      bypass: 'worktree-source-symlink-outside',
      what: 'a COMMITTED symlink whose target is outside the repo (the measured exit-0 bypass)',
      label: 'WORKTREE SOURCE NOT A REGULAR FILE',
      because: 'is a symbolic link -> ../../../outside/Registry.sol',
    },
    {
      bypass: 'worktree-source-symlink-inside',
      what: 'a committed symlink whose target is INSIDE the repo and itself committed',
      label: 'WORKTREE SOURCE NOT A REGULAR FILE',
      because: 'is a symbolic link -> Registry.impl.sol',
      // The realpath-prefix mitigation proposed with the finding would have passed this one: the
      // resolved path IS under the repo root. A symlink is refused for what it is, not for where
      // it points.
      notLabel: 'WORKTREE SOURCE ESCAPES THE REPO',
    },
    {
      bypass: 'source-untracked-gitignored',
      what: 'a regular, correctly-hashing file the pinned revision does not track at all',
      label: 'SOURCE ABSENT FROM PINNED REVISION',
      because: 'contracts/src/Registry.sol does not exist in',
    },
    {
      bypass: 'pinned-entry-symlink',
      what: 'a regular working-tree file whose PINNED tree entry is a symlink',
      label: 'PINNED TREE ENTRY NOT A REGULAR BLOB',
      because: 'is a SYMLINK in',
      pinBehindHead: true,
    },
    {
      bypass: 'pinned-entry-submodule',
      what: 'a regular working-tree file whose PINNED tree entry is a submodule gitlink',
      label: 'PINNED TREE ENTRY NOT A REGULAR BLOB',
      because: 'is a SUBMODULE gitlink in',
      pinBehindHead: true,
    },
    {
      bypass: 'worktree-bytes-differ-from-pinned-blob',
      what: 'working-tree bytes the artifact matches exactly but the pinned revision does not hold',
      label: 'WORKTREE BYTES NOT IN PINNED REVISION',
      because: 'on disk',
      pinBehindHead: true,
    },
  ];

  for (const { bypass, what, label, because, pinBehindHead, notLabel } of attributionBypasses) {
    it(`ATTRIBUTION: ${what} fails strict`, () => {
      withFixture(bypass, (lenient, strict) => {
        // The bytes themselves are never the problem: whatever a naive read returns hashes to
        // exactly what the artifact records, so the pre-round-9 chain saw nothing wrong.
        expect(strict.output).not.toContain('ARTIFACT ⇄ SOURCE MISMATCH');
        expect(strict.output).not.toContain('MAIN SOURCE UNDECLARED');
        expect(strict.output).not.toContain('MAIN SOURCE AMBIGUOUS');
        expect(strict.output).not.toContain('MAIN SOURCE PATH NOT PINNED');
        expect(strict.output).not.toMatch(/Registry\s+\w{16}\s+✅/);
        if (!pinBehindHead) {
          // Clean checkout, HEAD == pin: the new gate is provably the only failing link.
          expect(strict.output).not.toContain('UPSTREAM NOT PINNED/CLEAN');
          expect(strict.output).not.toContain('UNUSABLE CHECKOUT');
        }
        if (notLabel) expect(strict.output).not.toContain(notLabel);

        expect(strict.status, strict.output).toBe(1);
        expect(strict.output).toContain('MUST-VERIFY PROVENANCE INCOMPLETE');
        expect(strict.output).toContain(`SOURCE NOT ATTRIBUTED TO PINNED REVISION: ${label}`);
        expect(strict.output).toContain(because);
        // The green sentence AND the attribution sentence are both claims this run cannot make.
        expect(strict.output).not.toContain(UNCONDITIONAL_PASS);
        expect(strict.output).not.toContain(OVERSTATED_PASS);
        expect(strict.output).not.toContain(ATTRIBUTED_SENTENCE);
        // The must-verify roll-call may not tick it green either (round-9 LOW-1).
        expect(strict.output).toMatch(/⚠️  Registry — compared, provenance INCOMPLETE/);

        expect(lenient.status, lenient.output).toBe(0);
        expect(lenient.output).not.toContain(UNCONDITIONAL_PASS);
        expect(lenient.output).toContain('INCOMPLETE PROVENANCE');
        expect(lenient.output).toContain('LENIENT MODE');
      });
    }, 120_000);
  }

  it('ATTRIBUTION positive: a regular tracked blob at the pinned path is attributed and passes strict', () => {
    withFixture('none', (lenient, strict) => {
      expect(strict.status, strict.output).toBe(0);
      expect(strict.output).toContain(UNCONDITIONAL_PASS);
      expect(strict.output).toContain(ATTRIBUTED_SENTENCE);
      // Attributed, not merely compared: the row is green and the roll-call ticks it.
      expect(strict.output).toMatch(/Registry\s+\w{16}\s+✅ 1 source\(s\) verified/);
      expect(strict.output).toContain('✅ Registry —');
      expect(strict.output).not.toContain('SOURCE NOT ATTRIBUTED TO PINNED REVISION');
      expect(lenient.status, lenient.output).toBe(0);
    });
  }, 120_000);

  it('ATTRIBUTION positive: a source inside a PINNED submodule is attributed through the gitlink', () => {
    // `git ls-tree -r` stops at a gitlink, so a gate that only accepted direct tree entries would
    // reject every foundry artifact that records a `contracts/lib/**` source — which is most of
    // them. The superproject's pinned revision does fix those bytes, through the commit id in the
    // gitlink, so the chain stays cryptographic: superproject@rev -> gitlink oid -> blob.
    withFixture('source-in-pinned-submodule', (lenient, strict) => {
      expect(strict.status, strict.output).toBe(0);
      expect(strict.output).toMatch(/Registry\s+\w{16}\s+✅ 2 source\(s\) verified/);
      expect(strict.output).toContain(UNCONDITIONAL_PASS);
      expect(strict.output).toContain(ATTRIBUTED_SENTENCE);
      expect(strict.output).not.toContain('SOURCE NOT ATTRIBUTED TO PINNED REVISION');
      expect(lenient.status, lenient.output).toBe(0);
    });
  }, 120_000);

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

  it('SCOPE: the expected-missing lenient PASS names the non-release-scope gap too', () => {
    withFixture('expected-missing-plus-non-must-gap', (lenient, strict) => {
      // This run takes the THIRD PASS path: lenient, with an artifact that was expected and never
      // built. It already knows it verified less than it looks, and it was the one green that said
      // nothing about the checked artifact whose binding is unestablished (CC-50 round-8 LOW-3).
      expect(lenient.status, lenient.output).toBe(0);
      expect(lenient.output).toContain('expected artifact(s) were missing and therefore NOT verified');
      expect(lenient.output).toMatch(/GasTokenFactory\s+\w{16}\s+⚠️  0 source\(s\) verified/);
      expect(lenient.output).toContain(
        'NOT RELEASE-SCOPE CAVEAT: 1 further checked artifact(s) are outside the must-verify set',
      );
      expect(lenient.output).toContain('GasTokenFactory');
      expect(lenient.output).not.toContain(UNCONDITIONAL_PASS);
      expect(lenient.output).not.toContain(OVERSTATED_PASS);
      // Strict is unchanged: an expected artifact that was never built is a failure there.
      expect(strict.status, strict.output).toBe(1);
      expect(strict.output).toContain('MISSING ARTIFACTS');
      expect(strict.output).toContain(EXPECTED_MISSING_CONTRACT);
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

  // ---------------------------------------------------------------------------------------
  // The REAL positives for the round-8 pin. Everything above is synthetic by necessity; this is
  // the other half — the four pins this repo actually ships must agree, byte for byte, with what
  // the real sibling artifacts declare. A pin that only ever appears in fixtures would be a gate
  // pointed at nothing.
  //
  // It deliberately does NOT assert the source hash matches: `SuperPaymaster` is mid-round (CC-50
  // B2), so BLSAggregator.sol is uncommitted upstream and its bytes legitimately differ from the
  // artifact right now. That is the strict gate's job and it is red on it today. What must hold
  // regardless is the BINDING: the artifact declares exactly this path, and this path is the file
  // that carries the contract.
  // ---------------------------------------------------------------------------------------
  it.skipIf(UPSTREAM_ARTIFACTS_ABSENT)('REAL: each shipped must-verify pin is byte-exact the real artifact\'s single compilation target', () => {
    const pin = JSON.parse(readFileSync(join(SDK_REPO, 'scripts/upstream-abi-pin.json'), 'utf8'));
    let measured = 0;
    for (const name of CONTRACTS) {
      const entry = pin.contracts?.[name];
      // The pin itself, independent of any checkout being present.
      expect(entry, `${name} has no pin entry`).toBeTruthy();
      expect(typeof entry.repo, `${name}.repo`).toBe('string');
      expect(typeof entry.sourcePath, `${name}.sourcePath`).toBe('string');
      expect(pin.repos?.[entry.repo]?.revision, `${entry.repo} revision`).toBeTruthy();
      expect(entry.sourcePath.endsWith('.sol')).toBe(true);
      expect(entry.sourcePath.startsWith('/')).toBe(false);
      expect(entry.sourcePath.split('/').some((seg: string) => seg === '' || seg === '.' || seg === '..')).toBe(false);

      const repoRoot = resolve(SDK_REPO, '..', entry.repo);
      const artifactPath = join(repoRoot, 'out', `${name}.sol`, `${name}.json`);
      // A FAILURE, not a warning and not a `continue` (CC-50 round-9 LOW). This used to
      // `console.warn` and carry on, so a run with no sibling checkouts reported `0/4 measured`
      // and stayed green — the one assertion in this file made against real data degrading into
      // the exact vacuous PASS the gate exists to remove. Declare absence with
      // REPCREDIT_UPSTREAM_ARTIFACTS=absent (a visible SKIP) or build the upstream.
      expect(
        existsSync(artifactPath),
        `no artifact at ${artifactPath} — run \`forge build\` in ${entry.repo}, or set ` +
          'REPCREDIT_UPSTREAM_ARTIFACTS=absent to declare this environment has no upstream checkouts',
      ).toBe(true);
      const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
      const target = artifact?.metadata?.settings?.compilationTarget;
      const entries = Object.entries(target ?? {});
      expect(entries.length, `${name} compilation targets`).toBe(1);
      expect(entries[0][0], `${name} compilation target path`).toBe(entry.sourcePath);
      expect(entries[0][1], `${name} compilation target contract`).toBe(name);
      // The pinned path is in the artifact's recorded source set, with a comparable hash — the
      // set membership the strict gate then requires to be VERIFIED.
      const recorded = artifact?.metadata?.sources?.[entry.sourcePath];
      expect(recorded?.keccak256, `${name} source hash`).toMatch(/^0x[0-9a-f]{64}$/i);
      // Content sanity, NOT the release basis (a comment could satisfy it): the reviewed file is
      // on disk in that repo and does declare this contract.
      const sourceFile = join(repoRoot, entry.sourcePath);
      expect(existsSync(sourceFile), `${entry.sourcePath} on disk`).toBe(true);
      expect(readFileSync(sourceFile, 'utf8')).toMatch(new RegExp(`^\\s*contract\\s+${name}\\b`, 'm'));
      measured += 1;
    }
    // The count is asserted, not merely printed: a green here now means all four were measured.
    expect(measured, 'must-verify contracts measured against a real artifact').toBe(CONTRACTS.length);
    console.log(`REAL pin check: ${measured}/${CONTRACTS.length} must-verify contracts measured against a real artifact.`);
  }, 30_000);

  it('still fails REAL drift against a clean upstream in both modes', () => {
    withFixture('real-drift', (lenient, strict) => {
      expect(strict.status, strict.output).toBe(1);
      expect(lenient.status, lenient.output).toBe(1);
      expect(strict.output).toContain('DRIFT: 1 contract ABI(s) differ from upstream');
    });
  }, 120_000);
});
