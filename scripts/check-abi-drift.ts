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

/**
 * Verify a foundry artifact against the sources it records.
 *
 * `metadata.sources[path].keccak256` is solc's own hash of each input file, so recomputing it over
 * the working tree proves the artifact was compiled from EXACTLY these bytes. Nothing here trusts
 * an mtime.
 */
function verifyArtifactSources(
  artifactPath: string,
  repoRoot: string,
  dirtyPaths: string[],
): { sourceCount: number; mismatched: string[]; unresolved: string[]; dirty: string[] } {
  // `git status --porcelain` lines are "XY <path>" (and "R  old -> new"); we only need the paths.
  const dirtySet = new Set(
    dirtyPaths.map((line) => line.replace(/^\S+\s+/, '').split(' -> ').pop()!.replace(/^"|"$/g, '')),
  );
  const dirty: string[] = [];
  const mismatched: string[] = [];
  const unresolved: string[] = [];
  let sourceCount = 0;
  let metadata: any;
  try {
    metadata = JSON.parse(fs.readFileSync(artifactPath, 'utf8')).metadata;
  } catch {
    return { sourceCount: 0, unresolved: ['<artifact is not readable JSON>'], mismatched, dirty };
  }
  const sources = metadata?.sources;
  if (!sources || typeof sources !== 'object') {
    return { sourceCount: 0, unresolved: ['<artifact carries no solc metadata.sources>'], mismatched, dirty };
  }
  for (const [relative, entry] of Object.entries<any>(sources)) {
    const file = path.resolve(repoRoot, relative);
    // Sources outside the repo (remappings into node_modules/lib) are the dependency's problem,
    // not this repo's revision — count them as resolved-elsewhere rather than as a mismatch.
    if (!file.startsWith(repoRoot + path.sep)) continue;
    if (!fs.existsSync(file)) {
      unresolved.push(relative);
      continue;
    }
    sourceCount++;
    if (dirtySet.has(relative)) dirty.push(relative);
    const actual = keccak256(fs.readFileSync(file));
    if (typeof entry?.keccak256 === 'string' && actual.toLowerCase() !== entry.keccak256.toLowerCase()) {
      mismatched.push(relative);
    }
  }
  return { sourceCount, mismatched, unresolved, dirty };
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
  sources: { sourceCount: number; mismatched: string[]; unresolved: string[]; dirty: string[] };
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
      ? verifyArtifactSources(up, repo.root, repo.dirtyPaths)
      : { sourceCount: 0, mismatched: [], unresolved: ['<no git repo>'], dirty: [] },
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
  const binding = src.mismatched.length
    ? `❌ ${src.mismatched.length}/${src.sourceCount} source(s) DIFFER from the artifact`
    : src.unresolved.length
      ? `⚠️  ${src.unresolved.length} source(s) unresolved`
      : `✅ ${src.sourceCount} source(s)`;
  console.log(`  ${entry.name}  ${entry.abiSha256.slice(0, 16)}  ${binding}  ${entry.artifact}`);
  for (const file of src.mismatched) console.log(`       ✗ ${file}`);
  for (const file of src.unresolved) console.log(`       ? ${file}`);
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
    console.error(`\nVENDORED ABI PIN MISMATCH: ${contractPinMismatch.length} contract(s):`);
    for (const line of contractPinMismatch) console.error(`  - ${line}`);
    console.error('  Update scripts/upstream-abi-pin.json in the same commit that re-syncs the ABI.');
    failed = true;
  } else if (pinnedContracts.length) {
    console.log(`\n✅ vendored ABI pin: ${pinnedContracts.length} contract(s) match scripts/upstream-abi-pin.json.`);
  }
}

// A MUST_VERIFY contract whose repo declares no pin is unattributable by construction: it would
// pass today and pass again tomorrow against a different, unreviewed revision.
if (STRICT) {
  const unpinnedMustVerify = checkedProvenance.filter(
    (e) => MUST_VERIFY.has(e.name) && e.repo && !PIN.repos?.[e.repo.label]?.revision,
  );
  if (unpinnedMustVerify.length) {
    console.error(
      `\nNO UPSTREAM PIN: ${unpinnedMustVerify.length} must-verify contract(s) come from a repo with no ` +
        `declared revision in scripts/upstream-abi-pin.json:`,
    );
    for (const entry of unpinnedMustVerify) console.error(`  - ${entry.name} (${entry.repo!.label})`);
    failed = true;
  }

}

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
  console.log(
    `\n⚠️  PASS, but ${expectedMissing.length} expected artifact(s) were missing and therefore NOT verified ` +
      `(see the skipped list). Re-run with --strict to make that a failure.`,
  );
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
  console.log(
    caveats.length
      ? `\nPASS (with caveats): ${checkedNames.length - unattributableDrift.length}/${checkedNames.length} ` +
        `checked SDK ABI(s) match a hash-verified upstream artifact; ${caveats.join('; ')}.`
      : '\nPASS: every checked SDK ABI matches its upstream out/ artifact, every expected artifact was present, ' +
        'and every artifact hash-matches the sources it records.',
  );
  console.log(
    STRICT
      ? `      Attributed to committed upstream revision(s): ${pinned || '(none pinned)'}.`
      : `      Upstream revision(s) seen: ${
          usedRepos.map((r) => `${r.label}@${(r.revision ?? 'unknown').slice(0, 8)}${r.dirtyPaths.length ? '(DIRTY)' : ''}`).join(', ') || '(none)'
        }. Run --strict to require a clean, pinned checkout.`,
  );
}
