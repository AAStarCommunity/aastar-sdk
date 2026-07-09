#!/usr/bin/env tsx
/**
 * Unified upstream ABI sync — scan (completeness + value-drift) across the 3 upstream repos, and
 * optionally auto-fix (copy missing / refresh drifted ABIs from the upstream foundry `out/`).
 *
 * This is the "scan + update the raw ABIs" half of the maintenance flow. The "decide what to wrap"
 * half is `abi-triage.ts`, which consumes the `--json` change report this emits.
 *
 *   pnpm run abi:sync            scan only — report missing + drifted (exit 1 if any)
 *   pnpm run abi:sync --fix      also copy missing + overwrite drifted ABIs from upstream out/
 *   pnpm run abi:sync --json     emit the machine-readable change report (for abi:triage)
 *
 * The 3 levels (upstream repos): SuperPaymaster, AirAccount, launch(sale). Each has a `src/` (to
 * enumerate the concrete deployable contracts we care about) and an `out/` (the compiled ABI JSON
 * we copy from). Missing a sibling repo locally → that level is skipped with a warning.
 */
import * as fs from 'fs';
import * as path from 'path';

const SDK_ROOT = process.cwd();
const ABIS_DIR = path.join(SDK_ROOT, 'packages/core/src/abis');
const FIX = process.argv.includes('--fix');
const JSON_OUT = process.argv.includes('--json');

interface Level {
  name: string;
  srcDirs: string[];
  outDirs: string[];
  ignore: string[];
}

const LEVELS: Level[] = [
  { name: 'SuperPaymaster', srcDirs: ['../SuperPaymaster/contracts/src'], outDirs: ['../SuperPaymaster/out'], ignore: ['BasePaymasterUpgradeable', 'PaymasterBase', 'BLS'] },
  // AAStarBLSKeyRegistry: airaccount-contract's Safe-owned BLS key registry (CC-27 renamed from
  // AAStarBLSAlgorithm, PR #182). The SDK does NOT consume it — it tracks the YAAA (DVT) contract
  // instead (see NAME_COLLISIONS below) — so it is intentionally not shipped as an SDK ABI.
  { name: 'AirAccount', srcDirs: ['../airaccount-contract/src'], outDirs: ['../airaccount-contract/out'], ignore: ['AAStarAirAccountBase', 'AAStarAgentStorageLayout', 'AlgTierLib', 'ERC8004Addresses', 'AAStarBLSKeyRegistry'] },
  { name: 'launch', srcDirs: ['../launch/contracts/src', '../../mycelium/launch/contracts/src'], outDirs: ['../launch/contracts/out', '../../mycelium/launch/contracts/out'], ignore: ['SaleContract', 'MockGToken'] },
];

// SDK ABIs sourced from official ERC-4337 / OZ (not our repos) — never auto-synced from upstream.
const STANDARD_EXTERNAL = new Set(['EntryPoint', 'SenderCreator', 'UserOperationLib', 'SimpleAccount', 'SimpleAccountFactory', 'SimpleAccountV08', 'SimpleAccountFactoryV08', 'Simple7702Account', 'LegacyAccount', 'ERC20', 'abi.config']);
// Intentional, documented divergence from the bare upstream artifact.
const KNOWN_DRIFT = new Map<string, string>([['AAStarAirAccountV7', 'SDK ABI intentionally merges the AirAccountExtension surface (fallback→delegatecall).']]);
// SDK ABI name collides with an UNRELATED upstream contract of the same name — the SDK tracks a
// different source than the one abi-sync scans, so diffing against the scanned artifact is a false
// positive. AAStarBLSAlgorithm: the SDK tracks the YetAnotherAA-Validator (DVT) contract that carries
// `registerWithProof(pubkey,popPoint,popSig)` (CC-17 / YAAA #165). airaccount-contract also has a
// same-named `src/validators/AAStarBLSAlgorithm.sol`, but v0.27.0 (#45 Part B) refactored it into a
// pure Safe-owned key aggregator (aggregateKeys/cacheAggregatedKey, no registerWithProof) — a distinct
// contract the SDK does NOT consume. CC-27 (airaccount PR #182, merged 2026-07-09) then renamed
// airaccount's copy to `AAStarBLSKeyRegistry` (ignored above in the AirAccount level); the SDK keeps
// its `AAStarBLSAlgorithm.json` pointing at the YAAA version. YAAA isn't a configured source level
// (submodule availability is flaky), so skip the drift check rather than diff against the wrong artifact.
const NAME_COLLISIONS = new Set(['AAStarBLSAlgorithm']);

const firstDir = (cands: string[]) => cands.map((d) => path.resolve(SDK_ROOT, d)).find((d) => fs.existsSync(d));
const loadAbi = (file: string): any[] => { const r = JSON.parse(fs.readFileSync(file, 'utf8')); return Array.isArray(r) ? r : r.abi || []; };
const sigSet = (abi: any[], kind: string) => new Set(abi.filter((e) => e.type === kind && e.name).map((e) => `${e.name}(${(e.inputs || []).map((i: any) => i.type).join(',')})`));

function concreteContracts(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (/(^|\/)(test|mock|mocks|lib|libs|interfaces?|node_modules)$/i.test(p) || /test/i.test(e.name)) continue; walk(p); }
      else if (e.name.endsWith('.sol')) { for (const m of fs.readFileSync(p, 'utf8').matchAll(/^\s*(abstract\s+contract|contract|interface|library)\s+([A-Za-z0-9_]+)/gm)) if (m[1] === 'contract') out.push(m[2]); }
    }
  };
  walk(dir);
  return [...new Set(out)];
}
const findArtifact = (outDir: string, name: string) => { const p = path.join(outDir, `${name}.sol`, `${name}.json`); return fs.existsSync(p) ? p : null; };

const sdkAbis = new Set(fs.readdirSync(ABIS_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')));

type FnChange = { contract: string; kind: 'function' | 'event' | 'error'; sig: string; change: 'added' | 'removed' };
const report = { missing: [] as { level: string; contract: string; copiedFrom?: string }[], drifted: [] as string[], changes: [] as FnChange[], newContracts: [] as string[] };
const log = (m: string) => { if (!JSON_OUT) console.log(m); };

for (const lvl of LEVELS) {
  const src = firstDir(lvl.srcDirs);
  const out = firstDir(lvl.outDirs);
  if (!src || !out) { log(`⚠️  ${lvl.name}: src/out not found locally — skipped`); continue; }
  log(`\n📦 ${lvl.name}`);

  // (1) completeness — concrete contracts missing from the SDK
  for (const c of concreteContracts(src)) {
    if (lvl.ignore.includes(c) || sdkAbis.has(c)) continue;
    const art = findArtifact(out, c);
    report.missing.push({ level: lvl.name, contract: c, copiedFrom: art ?? undefined });
    report.newContracts.push(c);
    if (FIX && art) { fs.writeFileSync(path.join(ABIS_DIR, `${c}.json`), JSON.stringify({ abi: loadAbi(art) }, null, 2)); log(`   ➕ copied missing ABI ${c} (remember to export in abis/index.ts)`); }
    else log(`   ❌ MISSING ABI: ${c}${art ? '' : ' (no out/ artifact — forge build upstream)'}`);
  }
}

// (2) value-drift — SDK ABI vs upstream out/ signature sets
for (const name of sdkAbis) {
  if (STANDARD_EXTERNAL.has(name) || KNOWN_DRIFT.has(name) || NAME_COLLISIONS.has(name)) continue;
  const art = LEVELS.map((l) => firstDir(l.outDirs)).filter(Boolean).map((d) => findArtifact(d!, name)).find(Boolean);
  if (!art) continue;
  const sdk = loadAbi(path.join(ABIS_DIR, `${name}.json`));
  const ups = loadAbi(art);
  let drifted = false;
  for (const kind of ['function', 'event', 'error'] as const) {
    const a = sigSet(sdk, kind), b = sigSet(ups, kind);
    for (const s of [...b].filter((x) => !a.has(x))) { report.changes.push({ contract: name, kind, sig: s, change: 'added' }); drifted = true; }
    for (const s of [...a].filter((x) => !b.has(x))) { report.changes.push({ contract: name, kind, sig: s, change: 'removed' }); drifted = true; }
  }
  if (drifted) {
    report.drifted.push(name);
    if (FIX) { fs.writeFileSync(path.join(ABIS_DIR, `${name}.json`), JSON.stringify({ abi: ups }, null, 2)); log(`   🔄 refreshed drifted ABI ${name}`); }
    else log(`   ❌ DRIFT ${name}: ${report.changes.filter((c) => c.contract === name).map((c) => `${c.change} ${c.kind} ${c.sig}`).join('; ')}`);
  }
}

if (JSON_OUT) { console.log(JSON.stringify(report, null, 2)); process.exit(0); }

const problems = report.missing.length + report.drifted.length;
log(`\n${report.missing.length} missing · ${report.drifted.length} drifted · ${report.changes.length} fn/event/error change(s).`);
if (FIX) { log('✅ applied fixes (review `git diff packages/core/src/abis/`, add exports for any new contract, then run abi:triage).'); process.exit(0); }
if (problems > 0) { console.error('\nRun `pnpm run abi:sync --fix` to refresh ABIs, then `pnpm run abi:triage` to decide wrapping.'); process.exit(1); }
log('PASS: ABIs complete + in sync with upstream.');
