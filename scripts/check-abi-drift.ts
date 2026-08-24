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
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

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
const checkedProvenance: { name: string; artifact: string; abiSha256: string }[] = [];
const skippedEntries: Skipped[] = [];
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
  checkedProvenance.push({
    name,
    artifact: up,
    // Hash the ABI itself, not the artifact file: bytecode/metadata churn on every rebuild and
    // would make the digest useless for answering "did the interface change?".
    abiSha256: createHash('sha256').update(JSON.stringify(ups)).digest('hex'),
  });
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
    drift++;
    console.log(`❌ ${name}`);
    for (const p of problems) console.log(`   ${p}`);
  }
}

// ---- Inventory. Printed on every run, pass or fail: a bare "PASS" cannot tell you WHAT was
// verified, and that ambiguity is precisely what made a 12-contract run look like a 30-contract one.
const checkedSet = new Set(checkedNames);
console.log(`\n--- checked (${checkedNames.length}) — contract, upstream artifact, abi sha256 ---`);
if (!checkedProvenance.length) console.log('(none)');
for (const entry of [...checkedProvenance].sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`  ${entry.name}  ${entry.abiSha256.slice(0, 16)}  ${entry.artifact}`);
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
  console.log('\nPASS: every checked SDK ABI matches its upstream out/ artifact, and every expected artifact was present.');
}
