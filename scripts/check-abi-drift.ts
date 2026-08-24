#!/usr/bin/env tsx
/**
 * Upstream ABI value-drift check.
 *
 * `check:abi` (completeness) catches a MISSING contract. This catches the other half: a contract
 * that IS in the SDK but whose ABI has DRIFTED from the upstream — i.e. the upstream added/changed/
 * removed a function (and redeployed), but the SDK's copy is stale. Stale ABI → wrong selector /
 * arg layout → silent revert or bad decode (e.g. launch added `buyTokensFor`; SuperPaymaster upgrades).
 *
 * For every SDK ABI that has a matching upstream foundry artifact (`<C>.sol/<C>.json` in the repo's
 * `out/`), it compares the function/event/error SIGNATURE SETS (name + input types — what determines
 * the selector). Mismatch ⇒ drift. ABIs with no matching upstream artifact (EntryPoint, ERC20, other
 * standard/external) or whose upstream repo isn't checked out locally are skipped.
 *
 * Run: pnpm run check:abi-drift   (sibling repos must be present + freshly `forge build`-ed)
 */
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { keccak256 } from 'viem';

const SDK_ROOT = process.cwd();
const ABIS_DIR = path.join(SDK_ROOT, 'packages/core/src/abis');

// Upstream foundry `out/` dirs (sibling checkouts). First match for a contract name wins.
const OUT_DIRS = [
  '../SuperPaymaster/out',
  '../airaccount-contract/out',
  '../../mycelium/launch/contracts/out',
]
  .map((d) => path.resolve(SDK_ROOT, d))
  .filter((d) => fs.existsSync(d));

// SDK ABIs that are not single-contract artifacts (config blobs etc.) — never drift-checked.
const NON_CONTRACT = new Set(['abi.config']);

// Standard / external contracts whose SDK ABI comes from the official ERC-4337 / OpenZeppelin source,
// NOT from our upstream repos (which only keep local test/reference copies). Comparing against the
// upstream copy is apples-to-oranges, so exclude them from drift.
const STANDARD_EXTERNAL = new Set([
  'EntryPoint', 'SenderCreator', 'UserOperationLib',
  'SimpleAccount', 'SimpleAccountFactory', 'SimpleAccountV08', 'SimpleAccountFactoryV08',
  'Simple7702Account', 'LegacyAccount', 'ERC20',
]);

// Contracts whose SDK ABI intentionally differs from the bare upstream artifact (documented reason).
const KNOWN_DRIFT = new Map<string, string>([
  [
    'AAStarAirAccountV7',
    'SDK ABI intentionally merges the AirAccountExtension surface — those calls route through the ' +
      'V7 fallback→delegatecall, so consumers encode them against the account address.',
  ],
]);

// SDK ABI name collides with an UNRELATED upstream contract of the same name. The SDK tracks a
// different source than the OUT_DIRS scanned here, so diffing against the scanned artifact is a false
// positive. AAStarBLSAlgorithm: the SDK tracks the YetAnotherAA-Validator (DVT) contract that carries
// `registerWithProof(pubkey,popPoint,popSig)` (CC-17 / YAAA #165). airaccount-contract also has a
// same-named `src/validators/AAStarBLSAlgorithm.sol`, but v0.27.0 (#45 Part B) refactored it into a
// pure Safe-owned key aggregator (aggregateKeys/cacheAggregatedKey, no registerWithProof) — a distinct
// contract the SDK does NOT consume. YAAA isn't a scanned out/ dir, so skip rather than false-flag.
// See CC-27 (upstream rename decision) and scripts/abi-sync.ts (same skip).
const NAME_COLLISIONS = new Set(['AAStarBLSAlgorithm']);

function loadAbi(file: string): any[] {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(raw) ? raw : raw.abi || [];
}

/** name(intype1,intype2,…) for each entry of `kind` — the selector-determining signature. */
/**
 * Render a parameter type, EXPANDING tuples into their component types.
 *
 * Using the bare `type` field renders every struct as the literal string "tuple", so a struct that
 * gains, loses or reorders fields produces an IDENTICAL signature and this gate reports no drift.
 * That is not hypothetical: airaccount-contract #161 added tier1Limit/tier2Limit to InitConfig
 * (8 -> 10 fields) and `getAddress(address,uint256,tuple,bytes32,bytes32)` matched on both sides,
 * so the gate stayed green while `createAccount`/`getAddress` reverted on-chain against the new
 * factory. Expanding components is what makes a breaking struct change visible.
 */
function renderType(i: any): string {
  if (typeof i?.type === 'string' && i.type.startsWith('tuple') && Array.isArray(i.components)) {
    // Preserve any array suffix: tuple[] -> (a,b)[], tuple[2] -> (a,b)[2].
    const suffix = i.type.slice('tuple'.length);
    return `(${i.components.map(renderType).join(',')})${suffix}`;
  }
  return i?.type ?? '?';
}

function sigSet(abi: any[], kind: string): Set<string> {
  return new Set(
    abi
      .filter((e) => e.type === kind && e.name)
      .map((e) => `${e.name}(${(e.inputs || []).map(renderType).join(',')})`),
  );
}

function findUpstreamArtifact(name: string): string | null {
  for (const out of OUT_DIRS) {
    const p = path.join(out, `${name}.sol`, `${name}.json`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Upstream SOURCE trees (sibling checkouts), used to decide whether an SDK ABI is EXPECTED to have
// an upstream artifact. Sources are the right oracle here because `forge clean` removes `out/` but
// never `src/`: "the contract exists upstream but its artifact is missing" is exactly the state that
// used to turn into a silent skip.
const SRC_DIRS: { label: string; dir: string }[] = [
  { label: 'SuperPaymaster', dir: '../SuperPaymaster/contracts/src' },
  { label: 'airaccount-contract', dir: '../airaccount-contract/src' },
  { label: 'launch', dir: '../launch/contracts/src' },
  { label: 'launch', dir: '../../mycelium/launch/contracts/src' },
]
  .map((e) => ({ ...e, dir: path.resolve(SDK_ROOT, e.dir) }))
  .filter((e) => fs.existsSync(e.dir));


// ---------------------------------------------------------------------------------------------
// UPSTREAM PROVENANCE (CC-50 round-4 MEDIUM-1)
//
// "checked 30 ABIs, here are their sha256s" still cannot say WHICH upstream revision produced
// them. A gate that reports green off a colleague's uncommitted edits is the next layer of the
// same vacuous-PASS problem strict mode was added to remove — measured for real: this script
// printed all four MUST_VERIFY ✅ while the SuperPaymaster worktree had 23 uncommitted changes,
// including Registry.sol and BLSAggregator.sol themselves.
//
// The chain this now establishes, end to end:
//
//   SDK ABI  ==(signature sets)==>  upstream artifact
//   artifact ==(solc metadata keccak256 of every source file)==>  on-disk source
//   source   ==(git status clean)==>  the committed revision
//   revision ==(scripts/upstream-abi-pin.json)==>  the revision that was reviewed
//
// Break any link and strict/release mode fails. The solc metadata hash is what makes the middle
// link cryptographic rather than a timestamp heuristic: a stale artifact (built before the last
// source edit) and a "too new" artifact (built from sources that were since reverted) both show
// up as a keccak mismatch, in either direction.
// ---------------------------------------------------------------------------------------------

type RepoProvenance = {
  label: string;
  root: string;
  revision: string | null;
  dirtyPaths: string[];
  /** Why this checkout cannot be used as a pinned reference, or null when it can. */
  unusable: string | null;
};

const PIN_FILE = path.join(SDK_ROOT, 'scripts/upstream-abi-pin.json');

type Pin = {
  repos?: Record<string, { revision: string; why?: string }>;
  contracts?: Record<string, { abiSha256: string; why?: string }>;
};

function loadPin(): Pin {
  if (!fs.existsSync(PIN_FILE)) return {};
  return JSON.parse(fs.readFileSync(PIN_FILE, 'utf8')) as Pin;
}

const PIN = loadPin();

function git(root: string, args: string[]): string {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

const repoCache = new Map<string, RepoProvenance>();

/** git repo that owns `somePath`, with its revision and working-tree state. */
function repoProvenanceFor(somePath: string): RepoProvenance | null {
  let root: string;
  try {
    root = git(path.dirname(somePath), ['rev-parse', '--show-toplevel']).trim();
  } catch {
    return null;
  }
  const cached = repoCache.get(root);
  if (cached) return cached;
  const label = path.basename(root);
  let provenance: RepoProvenance;
  try {
    const revision = git(root, ['rev-parse', 'HEAD']).trim();
    const dirtyPaths = git(root, ['status', '--porcelain'])
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    provenance = { label, root, revision, dirtyPaths, unusable: null };
    const declared = PIN.repos?.[label]?.revision;
    if (declared && !revision.startsWith(declared)) {
      provenance.unusable = `pinned at ${declared} (scripts/upstream-abi-pin.json) but the checkout is at ${revision}`;
    } else if (dirtyPaths.length) {
      provenance.unusable =
        `${dirtyPaths.length} uncommitted change(s) — the artifacts in out/ cannot be attributed to ` +
        `revision ${revision.slice(0, 8)}`;
    }
  } catch (error) {
    provenance = { label, root, revision: null, dirtyPaths: [], unusable: `not a usable git checkout: ${String(error)}` };
  }
  repoCache.set(root, provenance);
  return provenance;
}

/** A `metadata.sources[path].keccak256` this run can actually compare against on-disk bytes. */
const SOLC_SOURCE_HASH = /^0x[0-9a-f]{64}$/i;

/** What `verifyArtifactSources` established, per source entry, for one artifact. */
type SourceVerification = {
  /** in-repo entries that were on disk and hash-compared (matched + mismatched) */
  sourceCount: number;
  /** in-repo entries whose on-disk bytes hash to exactly the keccak256 the artifact records */
  verified: string[];
  mismatched: string[];
  /** named by the artifact, in-repo, but not on disk */
  unresolved: string[];
  /** the artifact records no usable keccak256 for these, so they can never be compared */
  unverifiable: string[];
  /** resolves outside the repo root — real bytes exist somewhere, but not in the repo we attribute to */
  external: string[];
  dirty: string[];
  /** the source declaring THIS contract, per the artifact's own compilationTarget/sourceName */
  mainSource: string | null;
  /** null once `mainSource` is in `verified`; otherwise why the contract's own source was not verified */
  mainSourceProblem: string | null;
  /** how `mainSourceProblem` is reported: the artifact never claimed the contract, or the chain broke */
  mainSourceGapLabel: string;
};

/**
 * The source file that declares THIS contract, taken from the artifact's own metadata.
 *
 * solc writes `settings.compilationTarget = { "<path>": "<ContractName>" }` — its own answer to
 * "which file declares this contract". For a MUST-VERIFY contract that declaration is the ONLY
 * accepted answer (`declaredOnly`): it must be a non-empty object with EXACTLY ONE entry whose
 * value is this contract's name.
 *
 * Round-6 kept three guesses behind it — a single-key target naming a DIFFERENT contract,
 * `sourceName`, and an unambiguous `<Name>.sol` basename — and an independent reviewer measured
 * all of them exiting 0 under `--strict` with the unconditional PASS while ZERO bytes of the
 * contract's own source were hashed (CC-50 round-7 MEDIUM-1). An artifact that declares a
 * compilation target and does not claim this contract has said it is not the artifact for it;
 * guessing past that is the bypass, not a convenience. Missing / malformed / unclaimed / claimed
 * more than once all fail closed here.
 *
 * The guesses survive for contracts OUTSIDE `MUST_VERIFY` (non-foundry artifact shapes still get a
 * best-effort main source in the report), where they cannot reach the release gate: only
 * must-verify contracts are fed to `provenanceGaps`.
 */
function mainSourceOf(
  artifact: any,
  metadata: any,
  name: string,
  sources: Record<string, any>,
  declaredOnly: boolean,
): { source: string | null; declarationProblem: string | null; declarationLabel: string } {
  const target = metadata?.settings?.compilationTarget;
  const isTargetObject = Boolean(target) && typeof target === 'object' && !Array.isArray(target);
  const claims = isTargetObject ? Object.entries<any>(target).filter(([, contract]) => contract === name) : [];
  if (claims.length === 1) return { source: claims[0][0], declarationProblem: null, declarationLabel: '' };

  if (declaredOnly) {
    if (claims.length > 1) {
      return {
        source: null,
        declarationProblem:
          `metadata.settings.compilationTarget claims ${name} ${claims.length} times ` +
          `(${claims.map(([rel]) => rel).join(', ')}), so the artifact does not identify ONE source for it`,
        declarationLabel: 'MAIN SOURCE AMBIGUOUS',
      };
    }
    const why = !isTargetObject
      ? target === undefined || target === null
        ? 'the artifact declares no metadata.settings.compilationTarget'
        : `metadata.settings.compilationTarget is ${Array.isArray(target) ? 'an array' : typeof target}, ` +
          'not the { "<path>": "<ContractName>" } object solc writes'
      : !Object.keys(target).length
        ? 'metadata.settings.compilationTarget is empty'
        : `metadata.settings.compilationTarget names ${Object.keys(target).length} target(s) and NONE of them ` +
          `is ${name} (${Object.entries<any>(target).map(([rel, c]) => `${rel} => ${String(c)}`).join(', ')})`;
    return {
      source: null,
      // No sourceName / basename fallback: a must-verify artifact that will not name its own
      // compilation target is a gap, and guessing one hides it behind a green tick.
      declarationProblem: `${why} — a must-verify artifact must declare exactly one compilation target for ${name}`,
      declarationLabel: 'MAIN SOURCE UNDECLARED',
    };
  }

  const fallback = (): string | null => {
    if (isTargetObject && Object.keys(target).length === 1) return Object.keys(target)[0];
    if (typeof artifact?.sourceName === 'string' && artifact.sourceName) return artifact.sourceName;
    const byBasename = Object.keys(sources).filter((rel) => path.basename(rel) === `${name}.sol`);
    return byBasename.length === 1 ? byBasename[0] : null;
  };
  return { source: fallback(), declarationProblem: null, declarationLabel: '' };
}

/**
 * Verify a foundry artifact against the sources it records.
 *
 * `metadata.sources[path].keccak256` is solc's own hash of each input file, so recomputing it over
 * the working tree proves the artifact was compiled from EXACTLY these bytes. Nothing here trusts
 * an mtime.
 *
 * COUNTING IS NOT COVERAGE (CC-50 round-6 MEDIUM). The previous shape incremented one counter per
 * in-repo entry and only compared the ones that happened to carry a `keccak256` string, so an entry
 * of `{ "urls": [...] }` or `{ "keccak256": null }` — and any source resolving outside the repo —
 * silently became "1 source(s) ✅" while ZERO bytes of that file were ever hashed. Every entry now
 * lands in exactly one bucket, and only `verified` means "compared and matched".
 */
function verifyArtifactSources(
  artifactPath: string,
  repoRoot: string,
  dirtyPaths: string[],
  name: string,
  /** must-verify contracts get NO main-source guessing — see `mainSourceOf` */
  declaredOnly: boolean,
): SourceVerification {
  // `git status --porcelain` lines are "XY <path>" (and "R  old -> new"); we only need the paths.
  const dirtySet = new Set(
    dirtyPaths.map((line) => line.replace(/^\S+\s+/, '').split(' -> ').pop()!.replace(/^"|"$/g, '')),
  );
  const empty = (over: Partial<SourceVerification>): SourceVerification => ({
    sourceCount: 0,
    verified: [],
    mismatched: [],
    unresolved: [],
    unverifiable: [],
    external: [],
    dirty: [],
    mainSource: null,
    mainSourceProblem: null,
    mainSourceGapLabel: 'MAIN SOURCE NOT VERIFIED',
    ...over,
  });
  let artifact: any;
  try {
    artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  } catch {
    return empty({
      unresolved: ['<artifact is not readable JSON>'],
      mainSourceProblem: 'the artifact is not readable JSON, so it names no source for this contract',
    });
  }
  const metadata = artifact?.metadata;
  const sources = metadata?.sources;
  if (!sources || typeof sources !== 'object') {
    return empty({
      unresolved: ['<artifact carries no solc metadata.sources>'],
      mainSourceProblem: 'the artifact carries no solc metadata.sources, so it records no source for this contract',
    });
  }

  const dirty: string[] = [];
  const verified: string[] = [];
  const mismatched: string[] = [];
  const unresolved: string[] = [];
  const unverifiable: string[] = [];
  const external: string[] = [];
  for (const [relative, entry] of Object.entries<any>(sources)) {
    // No usable hash => nothing to compare against, wherever the file lives. This must be decided
    // BEFORE the in-repo test: an entry with no `keccak256` used to be counted and then skipped.
    const declared = typeof entry?.keccak256 === 'string' ? entry.keccak256.trim() : '';
    if (!SOLC_SOURCE_HASH.test(declared)) {
      unverifiable.push(relative);
      continue;
    }
    const file = path.resolve(repoRoot, relative);
    // Sources outside the repo (remappings into node_modules/lib) belong to a different tree, so
    // this repo's revision cannot attest to them. Recorded, never counted as verification.
    if (!file.startsWith(repoRoot + path.sep)) {
      external.push(relative);
      continue;
    }
    if (!fs.existsSync(file)) {
      unresolved.push(relative);
      continue;
    }
    if (dirtySet.has(relative)) dirty.push(relative);
    const actual = keccak256(fs.readFileSync(file));
    if (actual.toLowerCase() !== declared.toLowerCase()) mismatched.push(relative);
    else verified.push(relative);
  }

  // Coverage, not counting: the artifact must prove ITS OWN contract source was verified. A green
  // built purely out of unrelated in-repo sources (a vendored/remapped `<Name>.sol` next to a
  // correctly-hashed sibling) is exactly the "1 source(s) ✅ on a file never compared" bypass.
  const declared = mainSourceOf(artifact, metadata, name, sources, declaredOnly);
  const mainSource = declared.source;
  let mainSourceProblem: string | null = null;
  let mainSourceGapLabel = 'MAIN SOURCE NOT VERIFIED';
  const verifiedSet = new Set(verified);
  if (declared.declarationProblem) {
    // The artifact never claimed this contract. Reported as its own gap kind so a reader can tell
    // "the chain broke" from "the artifact refuses to say which file this contract came from".
    mainSourceProblem = declared.declarationProblem;
    mainSourceGapLabel = declared.declarationLabel;
  } else if (!mainSource) {
    mainSourceProblem =
      `the artifact does not name its own contract source (no metadata.settings.compilationTarget ` +
      `entry for ${name}, no sourceName, no unambiguous ${name}.sol)`;
  } else if (!verifiedSet.has(mainSource)) {
    const why = mismatched.includes(mainSource)
      ? 'its on-disk bytes do NOT hash to the keccak256 the artifact records'
      : unresolved.includes(mainSource)
        ? 'it is not on disk in this checkout'
        : unverifiable.includes(mainSource)
          ? 'the artifact records no usable keccak256 for it'
          : external.includes(mainSource)
            ? 'it resolves OUTSIDE the repo this artifact is attributed to'
            : 'the artifact does not record it under metadata.sources at all';
    mainSourceProblem = `${mainSource} — ${why}`;
  }

  return {
    sourceCount: verified.length + mismatched.length,
    verified,
    mismatched,
    unresolved,
    unverifiable,
    external,
    dirty,
    mainSource,
    mainSourceProblem,
    mainSourceGapLabel,
  };
}

/**
 * ABIs that MUST be verified against a real upstream artifact in strict mode.
 *
 * These are the contracts the RepCredit evidence run encodes calldata against and whose upstream
 * interface is actively changing, so "we did not check it" must never read as "it matches".
 * A name here fails strict mode when it is skipped for ANY reason — repo absent, `out/` cleaned,
 * artifact missing, name collision — instead of quietly dropping into the skipped bucket
 * (CC-50, [from:docs] second round).
 */
const MUST_VERIFY = new Map<string, string>([
  ['Registry', 'RepCredit credit-policy / credit-limit surface (SP)'],
  ['BLSAggregator', 'slash + reputation quorum surface (SP)'],
  ['DVTValidator', 'executeWithProof path used by the evidence runner (SP)'],
  ['SuperPaymaster', 'paymaster surface exercised by the gasless lifecycle (SP)'],
]);

/**
 * STRICT MODE (`--strict`, `STRICT_ABI_DRIFT=1`, or the legacy `REQUIRE_UPSTREAM=1`).
 *
 * Without it this gate had exactly one hard-failure mode for missing inputs: NO upstream `out/`
 * directory at all. Everything finer-grained — an `out/` that exists but was `forge clean`ed, a
 * single contract whose artifact was never built — fell into `skipped` and the script still
 * printed PASS. That is how a run went from "checked 30" to "checked 12" while staying green
 * (CC-50). Strict mode fails PER EXPECTED CONTRACT instead:
 *
 *   - an SDK ABI whose contract is declared in an upstream `src/` tree but has no artifact  → FAIL
 *   - anything in MUST_VERIFY that was not actually compared                                → FAIL
 *
 * Both lists (checked / skipped-with-reason) are printed either way, so a green run states what
 * it verified rather than leaving the reader to assume.
 */
const STRICT =
  process.argv.includes('--strict') ||
  process.env.STRICT_ABI_DRIFT === '1' ||
  process.env.REQUIRE_UPSTREAM === '1';

/** contract name -> upstream repo label, from the upstream SOURCE trees. */
function upstreamSourceIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const { label, dir } of SRC_DIRS) {
    const walk = (d: string): void => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) {
          if (/(^|\/)(test|mock|mocks|node_modules)$/i.test(p) || /test/i.test(e.name)) continue;
          walk(p);
          continue;
        }
        if (!e.name.endsWith('.sol')) continue;
        const text = fs.readFileSync(p, 'utf8');
        for (const m of text.matchAll(/^\s*contract\s+([A-Za-z0-9_]+)/gm)) {
          if (!index.has(m[1])) index.set(m[1], label);
        }
      }
    };
    walk(dir);
  }
  return index;
}

if (OUT_DIRS.length === 0) {
  if (STRICT) {
    console.error('FAIL: strict mode is on but no upstream out/ dir is present — nothing to check against.');
    console.error('      Check out the upstream repos as siblings and `forge build` them, or drop --strict.');
    process.exit(1);
  }
  console.log('⚠️  no upstream out/ dirs found locally — skipping ABI value-drift check.');
  console.log('    NOTE: this is a SKIP, not a verification. Run with --strict to make it fail instead.');
  process.exit(0);
}

const SOURCE_INDEX = upstreamSourceIndex();

type Skipped = { name: string; reason: string; expected: boolean };

let drift = 0;
const checkedNames: string[] = [];
/**
 * What each verified contract was actually compared against (CC-50 round-3 LOW): the upstream
 * artifact path plus the sha256 of its normalised ABI. "checked 30" only means something if the
 * run can say WHICH artifacts those were — a PASS that cannot name its inputs is the same class of
 * claim as the vacuous PASS strict mode exists to prevent.
 */
const checkedProvenance: {
  name: string;
  artifact: string;
  abiSha256: string;
  /** Upstream git revision + working-tree state the artifact is attributed to. */
  repo: RepoProvenance | null;
  /** solc-metadata source verification: does the artifact match the sources on disk? */
  sources: SourceVerification;
}[] = [];
const skippedEntries: Skipped[] = [];
/** Drift measured against an artifact whose sources are uncommitted upstream — reported, not failed (lenient). */
const unattributableDrift: { name: string; problems: string[]; dirtySources: string[] }[] = [];
/** Never drift-checked BY DESIGN (standard/external, or not a contract) — listed so the inventory adds up. */
const excludedEntries: { name: string; reason: string }[] = [];
console.log('=== Upstream ABI value-drift (vs ' + OUT_DIRS.length + ' upstream out/ dir(s)) ===');
console.log(`mode: ${STRICT ? 'STRICT (missing expected artifacts fail)' : 'lenient (missing artifacts are skipped)'}\n`);

for (const file of fs.readdirSync(ABIS_DIR).filter((f) => f.endsWith('.json'))) {
  const name = file.replace(/\.json$/, '');
  if (NON_CONTRACT.has(name)) {
    excludedEntries.push({ name, reason: 'not a single-contract artifact' });
    continue;
  }
  if (STANDARD_EXTERNAL.has(name)) {
    excludedEntries.push({ name, reason: 'standard/external contract — SDK ABI comes from the official source, not our upstreams' });
    continue;
  }
  if (NAME_COLLISIONS.has(name)) {
    console.log(`ℹ️  ${name}: skipped — name collides with an unrelated upstream contract; SDK tracks a different source (see CC-27).`);
    skippedEntries.push({ name, reason: 'name collision with an unrelated upstream contract (CC-27)', expected: false });
    continue;
  }
  if (KNOWN_DRIFT.has(name)) {
    console.log(`ℹ️  ${name}: known intentional drift — ${KNOWN_DRIFT.get(name)}`);
    skippedEntries.push({ name, reason: `documented intentional drift: ${KNOWN_DRIFT.get(name)}`, expected: false });
    continue;
  }
  const up = findUpstreamArtifact(name);
  if (!up) {
    const repo = SOURCE_INDEX.get(name);
    skippedEntries.push({
      name,
      reason: repo
        ? `NO ARTIFACT, but ${repo}/src declares this contract — the upstream needs \`forge build\``
        : 'no upstream artifact and no upstream source declares it (external/standard contract)',
      // Expected == the upstream repo IS checked out and declares the contract, so an artifact
      // should exist. That is the state a clean/failed build produces, and the one that used to
      // pass vacuously.
      expected: Boolean(repo),
    });
    continue;
  }
  checkedNames.push(name);
  const sdk = loadAbi(path.join(ABIS_DIR, file));
  const ups = loadAbi(up);
  const repo = repoProvenanceFor(up);
  const provenance = {
    name,
    artifact: up,
    // Hash the ABI itself, not the artifact file: bytecode/metadata churn on every rebuild and
    // would make the digest useless for answering "did the interface change?".
    abiSha256: createHash('sha256').update(JSON.stringify(ups)).digest('hex'),
    repo,
    sources: repo
      ? verifyArtifactSources(up, repo.root, repo.dirtyPaths, name, MUST_VERIFY.has(name))
      : {
          sourceCount: 0,
          verified: [],
          mismatched: [],
          unresolved: ['<no git repo>'],
          unverifiable: [],
          external: [],
          dirty: [],
          mainSource: null,
          mainSourceProblem: 'the artifact resolves to no git checkout, so no source could be attributed',
          mainSourceGapLabel: 'MAIN SOURCE NOT VERIFIED',
        },
  };
  checkedProvenance.push(provenance);
  const problems: string[] = [];
  for (const kind of ['function', 'event', 'error']) {
    const a = sigSet(sdk, kind);
    const b = sigSet(ups, kind);
    const missingInSdk = [...b].filter((s) => !a.has(s)); // upstream has it, SDK's copy doesn't (stale)
    const goneUpstream = [...a].filter((s) => !b.has(s)); // SDK has it, upstream removed/renamed it
    if (missingInSdk.length) problems.push(`${kind} added upstream, missing in SDK: ${missingInSdk.join(', ')}`);
    if (goneUpstream.length) problems.push(`${kind} in SDK but gone upstream: ${goneUpstream.join(', ')}`);
  }
  if (problems.length) {
    // A diff against an artifact built from UNCOMMITTED upstream sources is not evidence that the
    // SDK's copy is stale — it is the same "cannot attribute this artifact" problem one layer up,
    // and the sibling repo's owner is mid-round more often than not. Report it, do not fail the
    // lenient run on it; strict mode still fails, both here and on the dirty-checkout gate below.
    const unattributable = provenance.sources.dirty;
    if (unattributable.length) {
      unattributableDrift.push({ name, problems, dirtySources: unattributable });
      console.log(`⚠️  ${name}: differs from an UNATTRIBUTABLE artifact (built from uncommitted upstream sources)`);
      for (const p of problems) console.log(`   ${p}`);
      console.log(`   uncommitted: ${unattributable.join(', ')}`);
    } else {
      drift++;
      console.log(`❌ ${name}`);
      for (const p of problems) console.log(`   ${p}`);
    }
  }
}

// ---- Inventory. Printed on every run, pass or fail: a bare "PASS" cannot tell you WHAT was
// verified, and that ambiguity is precisely what made a 12-contract run look like a 30-contract one.
const checkedSet = new Set(checkedNames);

// ---- Upstream revisions FIRST: a reader must be able to answer "green against what?" before
// reading a single sha256. Same discipline as the YAAA pin in the RepCredit suite.
const usedRepos = [...new Map(
  checkedProvenance.filter((e) => e.repo).map((e) => [e.repo!.root, e.repo!]),
).values()].sort((a, b) => a.label.localeCompare(b.label));
console.log(`\n--- upstream revisions (${usedRepos.length}) ---`);
if (!usedRepos.length) console.log('  (none — no artifact resolved to a git checkout)');
for (const repo of usedRepos) {
  const declared = PIN.repos?.[repo.label]?.revision;
  const state = repo.dirtyPaths.length ? `DIRTY: ${repo.dirtyPaths.length} change(s)` : 'clean';
  console.log(
    `  ${repo.label} @ ${repo.revision ?? 'unknown'} (${state})` +
      `${declared ? `  pinned=${declared.slice(0, 12)}` : '  [NO PIN DECLARED]'}`,
  );
  if (repo.unusable) console.log(`     ⚠️  ${repo.unusable}`);
}

console.log(`\n--- checked (${checkedNames.length}) — contract, abi sha256, artifact⇄source, upstream artifact ---`);
if (!checkedProvenance.length) console.log('(none)');
for (const entry of [...checkedProvenance].sort((a, b) => a.name.localeCompare(b.name))) {
  const src = entry.sources;
  // Say what was COMPARED, never how many entries were seen: `N source(s)` used to include
  // entries that carried no comparable hash at all (CC-50 round-6 MEDIUM).
  const uncovered = src.unresolved.length + src.unverifiable.length + src.external.length;
  const binding = src.mismatched.length
    ? `❌ ${src.mismatched.length}/${src.sourceCount} source(s) DIFFER from the artifact`
    : uncovered
      ? `⚠️  ${src.verified.length} source(s) verified, ${uncovered} not covered`
      : `✅ ${src.verified.length} source(s) verified`;
  console.log(`  ${entry.name}  ${entry.abiSha256.slice(0, 16)}  ${binding}  ${entry.artifact}`);
  for (const file of src.mismatched) console.log(`       ✗ ${file}`);
  for (const file of src.unresolved) console.log(`       ? ${file} (named by the artifact, not on disk)`);
  for (const file of src.unverifiable) console.log(`       ? ${file} (no usable keccak256 in the artifact)`);
  for (const file of src.external) console.log(`       ? ${file} (resolves outside this repo)`);
  if (src.mainSourceProblem) console.log(`       ⚠️  ${src.mainSourceGapLabel}: ${src.mainSourceProblem}`);
}
console.log(`--- skipped (${skippedEntries.length}) ---`);
for (const entry of skippedEntries.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`  ${entry.expected ? '⚠️ ' : '  '}${entry.name}: ${entry.reason}`);
}

console.log(`--- excluded by design (${excludedEntries.length}) ---`);
console.log(excludedEntries.length ? excludedEntries.map((e) => e.name).sort().join(', ') : '(none)');

const expectedMissing = skippedEntries.filter((e) => e.expected);
const mustVerifyMissing = [...MUST_VERIFY.entries()].filter(([name]) => !checkedSet.has(name));

console.log('\n--- must-verify ---');
for (const [name, why] of MUST_VERIFY) {
  console.log(`  ${checkedSet.has(name) ? '✅' : '❌'} ${name} — ${why}`);
}

console.log(
  `\nchecked ${checkedNames.length} ABI(s) against upstream out/; skipped ${skippedEntries.length} ` +
    `(${expectedMissing.length} of them EXPECTED an artifact); excluded by design ${excludedEntries.length}.`,
);

let failed = false;
if (drift > 0) {
  console.error(
    `\nDRIFT: ${drift} contract ABI(s) differ from upstream. Re-build the upstream (forge build) and ` +
      `re-copy its <C>.sol/<C>.json into packages/core/src/abis/.`,
  );
  failed = true;
}
// ---- Provenance gates. All of these are the SAME failure in different clothing: an ABI the run
// cannot attribute to a reviewed, committed upstream revision. Gated on strict/release because a
// developer mid-edit in a sibling repo must still be able to run the lenient check; the release
// checklist and CI use --strict.
const artifactSourceMismatch = checkedProvenance.filter((e) => e.sources.mismatched.length);
if (artifactSourceMismatch.length) {
  const message =
    `ARTIFACT ⇄ SOURCE MISMATCH: ${artifactSourceMismatch.length} artifact(s) were NOT built from the ` +
    `sources now on disk (solc metadata keccak256 disagrees) — the artifact is stale or the sources moved:`;
  if (STRICT) console.error(`\n${message}`);
  else console.log(`\n⚠️  ${message}`);
  for (const entry of artifactSourceMismatch) {
    const line = `  - ${entry.name}: ${entry.sources.mismatched.join(', ')}`;
    if (STRICT) console.error(line);
    else console.log(line);
  }
  if (STRICT) {
    console.error('  Re-run `forge build` in the upstream checkout so the artifact matches its source.');
    failed = true;
  }
}

const unpinnedOrDirty = usedRepos.filter((repo) => repo.unusable);
if (unpinnedOrDirty.length) {
  const message =
    `UPSTREAM NOT PINNED/CLEAN: ${unpinnedOrDirty.length} upstream checkout(s) cannot back a release-grade ABI claim:`;
  if (STRICT) console.error(`\n${message}`);
  else console.log(`\n⚠️  ${message}`);
  for (const repo of unpinnedOrDirty) {
    const line = `  - ${repo.label} @ ${repo.revision ?? 'unknown'}: ${repo.unusable}`;
    if (STRICT) console.error(line);
    else console.log(line);
  }
  if (STRICT) {
    console.error('  Commit (or stash) the upstream changes and update scripts/upstream-abi-pin.json to the reviewed revision.');
    failed = true;
  }
}

if (unattributableDrift.length) {
  const message =
    `UNATTRIBUTABLE DRIFT: ${unattributableDrift.length} contract(s) differ from an upstream artifact ` +
    `built from UNCOMMITTED sources — the diff describes someone's work in progress, not the SDK:`;
  if (STRICT) console.error(`\n${message}`);
  else console.log(`\n⚠️  ${message}`);
  for (const entry of unattributableDrift) {
    const line = `  - ${entry.name} (uncommitted: ${entry.dirtySources.join(', ')})`;
    if (STRICT) console.error(line);
    else console.log(line);
  }
  if (STRICT) failed = true;
  else console.log('    Not failing the lenient run. `--strict` (release) requires a clean upstream checkout.');
}

// Self-consistency of the SDK's OWN committed copy against its OWN committed pin. Deliberately
// NOT gated on strict: it needs no upstream checkout at all, and "the vendored ABI is still the
// one that was reviewed" must hold on every run, including one where the sibling repos are absent.
/** Did every pinned contract's vendored ABI match its pinned sha256? Required by the final PASS. */
let vendoredPinHolds = true;
{
  const pinnedContracts = Object.entries(PIN.contracts ?? {});
  const contractPinMismatch = pinnedContracts.flatMap(([name, expected]) => {
    const file = path.join(ABIS_DIR, `${name}.json`);
    if (!fs.existsSync(file)) return [`${name}: pinned, but packages/core/src/abis/${name}.json is missing`];
    const actual = createHash('sha256').update(JSON.stringify(loadAbi(file))).digest('hex');
    return actual === expected.abiSha256
      ? []
      : [`${name}: vendored ABI sha256 ${actual.slice(0, 16)} != pinned ${expected.abiSha256.slice(0, 16)}`];
  });
  if (contractPinMismatch.length) {
    vendoredPinHolds = false;
    console.error(`\nVENDORED ABI PIN MISMATCH: ${contractPinMismatch.length} contract(s):`);
    for (const line of contractPinMismatch) console.error(`  - ${line}`);
    console.error('  Update scripts/upstream-abi-pin.json in the same commit that re-syncs the ABI.');
    failed = true;
  } else if (pinnedContracts.length) {
    console.log(`\n✅ vendored ABI pin: ${pinnedContracts.length} contract(s) match scripts/upstream-abi-pin.json.`);
  }
}

// ---------------------------------------------------------------------------------------------
// MUST-VERIFY PROVENANCE, END TO END (CC-50 round-5 MEDIUM-1)
//
// The gates above each catch ONE broken link. Two ways of having NO link at all still exited 0
// under --strict, and both printed the unqualified PASS:
//
//   1. an artifact carrying no `metadata.sources` (or sources that do not resolve on disk):
//      `verifyArtifactSources` reported them as `unresolved`, which was PRINTED and never set
//      `failed`, so strict mode passed having hashed ZERO source bytes;
//   2. an `out/` that belongs to no git checkout at all — a tarball, a `git archive`, a CI
//      artifact download. `repoProvenanceFor` returns null for those, and the NO UPSTREAM PIN
//      filter dropped exactly those entries (`e.repo && …`), so strict mode passed and printed
//      "--- upstream revisions (0) ---" with all four must-verify contracts ticked.
//
// Both are the same class as the vacuous PASS this gate exists to remove: dirty and stale were
// already red, and MISSING — no provenance whatsoever — was the one state left green. So a
// must-verify contract must now satisfy the WHOLE chain, and every missing link is named:
//
//   repo  ->  declared pin  ->  clean revision matching that pin  ->  artifact
//         ->  a non-empty, fully resolved set of source hashes that the artifact matches
//         ->  the artifact's OWN contract source among them
//         ->  the vendored ABI sha256 this repo committed
//
// Anything less and strict/release fails, and the final PASS line is not allowed to claim the
// artifacts hash-match their sources.
//
// ROUND-6 (CC-50): the source-hash link was a COUNT, not COVERAGE. `sourceCount` was incremented
// for every in-repo entry and the comparison was then made conditional, so two shapes reached
// `--strict` exit 0 with the unqualified PASS while ZERO bytes of the must-verify contract were
// hashed: (a) an entry carrying no comparable `keccak256` (`{ "urls": [...] }`, `null`) counted as
// one verified source; (b) the contract's own source resolving OUTSIDE the repo — silently skipped
// as "the dependency's problem" — while an unrelated in-repo source supplied the count. So every
// entry now lands in exactly one bucket (verified / mismatched / unresolved / unverifiable /
// external) and only `verified` counts, and a must-verify artifact must additionally prove that
// the source solc names as ITS OWN (metadata.settings.compilationTarget, sourceName) is in that
// verified set. Verifying *a* source and verifying *this contract* are different claims.
// ---------------------------------------------------------------------------------------------
function provenanceGaps(entry: (typeof checkedProvenance)[number]): string[] {
  const gaps: string[] = [];
  const repo = entry.repo;
  if (!repo) {
    gaps.push(
      'NO UPSTREAM PROVENANCE: the artifact resolves to no git checkout (tarball / git archive / ' +
        'downloaded CI artifact), so it cannot be attributed to any revision',
    );
  } else {
    if (!repo.revision) gaps.push(`NO UPSTREAM REVISION: ${repo.label} is not a usable git checkout`);
    if (repo.unusable) gaps.push(`UNUSABLE CHECKOUT: ${repo.unusable}`);
    if (!PIN.repos?.[repo.label]?.revision) {
      gaps.push(`NO UPSTREAM PIN: ${repo.label} declares no revision in scripts/upstream-abi-pin.json`);
    }
  }
  const src = entry.sources;
  if (src.unresolved.length) {
    gaps.push(`SOURCE HASHES INCOMPLETE: ${src.unresolved.length} named but not on disk — ${src.unresolved.join(', ')}`);
  }
  // Counting an entry the run could never compare is how a green was printed over zero verified
  // bytes: `{ "urls": [...] }` and `{ "keccak256": null }` both incremented the old counter and
  // then skipped the comparison (CC-50 round-6 MEDIUM (a)).
  if (src.unverifiable.length) {
    gaps.push(
      `SOURCE HASHES INCOMPLETE: ${src.unverifiable.length} entry/entries carry no usable keccak256 ` +
        `(missing, null, or not a 32-byte hex hash), so they can never be compared — ${src.unverifiable.join(', ')}`,
    );
  }
  // A source outside the repo is not "the dependency's problem" for a MUST-VERIFY contract: this
  // repo's pinned revision cannot attest to bytes it does not contain.
  if (src.external.length) {
    gaps.push(
      `SOURCE HASHES INCOMPLETE: ${src.external.length} source(s) resolve OUTSIDE the repo this ` +
        `artifact is attributed to, so its revision cannot attest to them — ${src.external.join(', ')}`,
    );
  }
  if (!src.verified.length) {
    gaps.push(
      'NO SOURCE HASHES: the artifact records no in-repo source this run could hash and match, so ' +
        '"the artifact matches the sources it records" was never established',
    );
  }
  // COVERAGE, not count (CC-50 round-6 MEDIUM (b)): verifying some unrelated in-repo source says
  // nothing about THIS contract. Its own declared source must be in the verified set.
  if (src.mainSourceProblem) {
    gaps.push(`${src.mainSourceGapLabel}: ${src.mainSourceProblem}`);
  }
  if (src.mismatched.length) gaps.push(`ARTIFACT ⇄ SOURCE MISMATCH: ${src.mismatched.join(', ')}`);
  if (!PIN.contracts?.[entry.name]?.abiSha256) {
    gaps.push(`NO VENDORED ABI PIN: scripts/upstream-abi-pin.json declares no abiSha256 for ${entry.name}`);
  }
  return gaps;
}

/**
 * Checked contracts OUTSIDE the must-verify set whose artifact⇄source binding is NOT established.
 *
 * These do not gate the release — `provenanceGaps` is only applied to `MUST_VERIFY` — but the final
 * PASS used to claim "every artifact hash-matches the sources it records" in the same run whose own
 * `checked` table printed `⚠️  0 source(s) verified, 1 not covered` a few lines above (CC-50 round-7
 * MEDIUM-2). A green that contradicts its own report is worse than a narrower green: the sentence is
 * now scoped to the must-verify set and every remaining artifact with a gap is named as an explicit
 * out-of-release-scope caveat.
 */
const nonMustSourceCaveats = checkedProvenance
  .filter((entry) => !MUST_VERIFY.has(entry.name))
  .filter((entry) => {
    const src = entry.sources;
    const uncovered = src.unresolved.length + src.unverifiable.length + src.external.length;
    return Boolean(uncovered || src.mismatched.length || src.mainSourceProblem);
  })
  .map((entry) => entry.name)
  .sort();

const mustVerifyGaps = checkedProvenance
  .filter((e) => MUST_VERIFY.has(e.name))
  .map((e) => ({ name: e.name, gaps: provenanceGaps(e) }))
  .filter((e) => e.gaps.length > 0);

if (mustVerifyGaps.length) {
  const message =
    `MUST-VERIFY PROVENANCE INCOMPLETE: ${mustVerifyGaps.length} contract(s) cannot be attributed end to ` +
    `end (repo -> committed pinned revision -> artifact -> every source hash -> vendored ABI):`;
  const emit = STRICT ? console.error : console.log;
  emit(STRICT ? `\n${message}` : `\n⚠️  ${message}`);
  for (const entry of mustVerifyGaps) {
    emit(`  - ${entry.name}`);
    for (const gap of entry.gaps) emit(`      ${gap}`);
  }
  if (STRICT) {
    console.error(
      '  A must-verify ABI that was not attributed is a FAILURE, not a caveat. Build the artifact from a ' +
        'clean, committed upstream checkout that scripts/upstream-abi-pin.json names.',
    );
    failed = true;
  } else {
    console.log('    Not failing the lenient run. `--strict` (release) requires the full chain.');
  }
}

/**
 * May the final PASS claim the artifacts were verified against their sources?
 *
 * Only when EVERY must-verify contract has the entire chain intact. Anything else and the run
 * says what it actually established.
 */
const mustVerifyFullyAttributed =
  mustVerifyGaps.length === 0 && mustVerifyMissing.length === 0 && vendoredPinHolds;

if (STRICT && expectedMissing.length) {
  console.error(`\nMISSING ARTIFACTS: ${expectedMissing.length} contract(s) are declared in an upstream src/ tree but have no out/ artifact:`);
  for (const entry of expectedMissing) console.error(`  - ${entry.name}: ${entry.reason}`);
  console.error('  Run `forge build` in the upstream checkout. In strict mode an unverified ABI is a failure, not a skip.');
  failed = true;
}
// Deliberately NOT gated on strict mode. There is no acceptable state in which these four went
// unverified, and `check:abi-drift` (without the suffix) is the command people actually type and
// the one the CI rationale note names — leaving it green with all four unverified reproduced the
// exact false signal strict mode was added to remove.
if (mustVerifyMissing.length) {
  console.error(`\nMUST-VERIFY NOT VERIFIED: ${mustVerifyMissing.length} contract(s) that must always be compared were not:`);
  for (const [name, why] of mustVerifyMissing) console.error(`  - ${name} (${why})`);
  failed = true;
}
if (failed) process.exit(1);

if (expectedMissing.length) {
  // Reachable in lenient mode only — strict already failed on it above.
  console.log(
    `\n⚠️  PASS, but ${expectedMissing.length} expected artifact(s) were missing and therefore NOT verified ` +
      `(see the skipped list). Re-run with --strict to make that a failure.`,
  );
  if (!mustVerifyFullyAttributed) {
    console.log(
      `      ...and ${mustVerifyGaps.length} must-verify contract(s) have INCOMPLETE PROVENANCE, so nothing ` +
        'here establishes that their artifacts match the sources they record.',
    );
  }
  console.log('      LENIENT MODE: none of the above is enforced. `--strict` (the release gate) fails on all of it.');
} else {
  const pinned = usedRepos
    .filter((repo) => PIN.repos?.[repo.label]?.revision)
    .map((repo) => `${repo.label}@${repo.revision!.slice(0, 8)}`)
    .join(', ');
  // Say exactly what held. A blanket "everything matches" after downgrading a diff to a warning is
  // the same overstatement as a PASS that will not name its `checked N`.
  const caveats: string[] = [];
  if (unattributableDrift.length) {
    caveats.push(`${unattributableDrift.length} contract(s) differed from an UNATTRIBUTABLE artifact (see above)`);
  }
  if (artifactSourceMismatch.length) {
    caveats.push(`${artifactSourceMismatch.length} artifact(s) did not hash-match their sources`);
  }
  // The claim "every artifact hash-matches the sources it records" is only true when the source
  // hashes were actually computed. With no provenance at all (no metadata.sources, unresolved
  // sources, or an out/ outside any git checkout) that sentence asserts a verification this run
  // never performed — the same overstatement in a different place.
  if (mustVerifyGaps.length) {
    caveats.push(
      `${mustVerifyGaps.length} must-verify contract(s) have INCOMPLETE PROVENANCE, so their artifact⇄source ` +
        'binding is not established (see above)',
    );
  } else if (!mustVerifyFullyAttributed) {
    caveats.push('must-verify provenance was not fully established (see above)');
  }
  console.log(
    caveats.length
      ? `\nPASS (with caveats): ${checkedNames.length - unattributableDrift.length}/${checkedNames.length} ` +
        `checked SDK ABI(s) match an upstream artifact; ${caveats.join('; ')}.`
      : '\nPASS: every checked SDK ABI matches its upstream out/ artifact, every expected artifact was present, ' +
        `and all ${MUST_VERIFY.size} must-verify artifacts hash-match every source they record.`,
  );
  // Never let the green sentence contradict the `checked` table above it: source coverage is only
  // ENFORCED for the must-verify set, so every other artifact with a gap is named right here rather
  // than folded into a blanket "every artifact" (CC-50 round-7 MEDIUM-2).
  if (nonMustSourceCaveats.length) {
    console.log(
      `      NOT RELEASE-SCOPE CAVEAT: ${nonMustSourceCaveats.length} further checked artifact(s) are outside the ` +
        'must-verify set and their artifact⇄source binding is NOT established — they were compared by ABI only: ' +
        `${nonMustSourceCaveats.join(', ')}.`,
    );
  }
  console.log(
    STRICT
      ? `      Attributed to committed upstream revision(s): ${pinned || '(none pinned)'}.`
      : `      Upstream revision(s) seen: ${
          usedRepos.map((r) => `${r.label}@${(r.revision ?? 'unknown').slice(0, 8)}${r.dirtyPaths.length ? '(DIRTY)' : ''}`).join(', ') || '(none)'
        }.`,
  );
  // LENIENT SEMANTICS, stated rather than implied (CC-50 round-4 LOW-3): this mode reports the
  // provenance gates instead of enforcing them, so its exit code says "no drift I can attribute",
  // never "release-grade". `--strict` is the only mode whose green means the full chain held.
  if (!STRICT) {
    console.log(
      caveats.length
        ? '      LENIENT MODE: the caveats above are NOT enforced here. `--strict` (the release gate) fails on them.'
        : '      LENIENT MODE: no caveat was raised, but only `--strict` enforces the pin/clean-checkout chain.',
    );
  }
}
