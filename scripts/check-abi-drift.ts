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

function loadAbi(file: string): any[] {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(raw) ? raw : raw.abi || [];
}

/** name(intype1,intype2,…) for each entry of `kind` — the selector-determining signature. */
function sigSet(abi: any[], kind: string): Set<string> {
  return new Set(
    abi
      .filter((e) => e.type === kind && e.name)
      .map((e) => `${e.name}(${(e.inputs || []).map((i: any) => i.type).join(',')})`),
  );
}

function findUpstreamArtifact(name: string): string | null {
  for (const out of OUT_DIRS) {
    const p = path.join(out, `${name}.sol`, `${name}.json`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

if (OUT_DIRS.length === 0) {
  console.log('⚠️  no upstream out/ dirs found locally — skipping ABI value-drift check.');
  process.exit(0);
}

let drift = 0;
let checked = 0;
let skipped = 0;
console.log('=== Upstream ABI value-drift (vs ' + OUT_DIRS.length + ' upstream out/ dir(s)) ===\n');

for (const file of fs.readdirSync(ABIS_DIR).filter((f) => f.endsWith('.json'))) {
  const name = file.replace(/\.json$/, '');
  if (NON_CONTRACT.has(name) || STANDARD_EXTERNAL.has(name)) continue;
  if (KNOWN_DRIFT.has(name)) {
    console.log(`ℹ️  ${name}: known intentional drift — ${KNOWN_DRIFT.get(name)}`);
    continue;
  }
  const up = findUpstreamArtifact(name);
  if (!up) {
    skipped++;
    continue;
  }
  checked++;
  const sdk = loadAbi(path.join(ABIS_DIR, file));
  const ups = loadAbi(up);
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

console.log(`\nchecked ${checked} ABI(s) against upstream out/; skipped ${skipped} (external/standard or no artifact).`);
if (drift > 0) {
  console.error(
    `\nDRIFT: ${drift} contract ABI(s) differ from upstream. Re-build the upstream (forge build) and ` +
      `re-copy its <C>.sol/<C>.json into packages/core/src/abis/.`,
  );
  process.exit(1);
}
console.log('PASS: every checked SDK ABI matches its upstream out/ artifact.');
