#!/usr/bin/env tsx
/**
 * Upstream ABI completeness check.
 *
 * The SDK's contract ABIs (packages/core/src/abis/*.json) must stay in sync with the upstream
 * contract repos. Until now nothing FLAGGED a missing one — e.g. AAStarGlobalGuard had to be
 * copied in by hand. This scans each upstream repo's CONCRETE contracts (skipping
 * interfaces/libraries/abstract/test/mock) and reports any whose ABI isn't in the SDK.
 *
 * Upstream repos are sibling checkouts; if one isn't present locally it's skipped with a warning
 * (so this never hard-fails in an environment without the siblings). Exit code 1 if any concrete
 * upstream contract is missing from the SDK (when the repo IS present).
 *
 * Run: pnpm run check:abi   (or: pnpm exec tsx scripts/check-abi-completeness.ts)
 */
import * as fs from 'fs';
import * as path from 'path';

const SDK_ROOT = process.cwd();
const ABIS_DIR = path.join(SDK_ROOT, 'packages/core/src/abis');

interface Upstream {
  name: string;
  /** Candidate source dirs (first that exists wins). Relative to SDK root or absolute-ish. */
  srcDirs: string[];
  /** Contract basenames intentionally NOT shipped as SDK ABIs (abstract bases / pure libs / parsers consumers don't call). */
  ignore?: string[];
  /**
   * Concrete contracts that MUST be found by the scan. Without them an empty or mis-pointed
   * source dir (wrong checkout, sparse clone, moved src/) scans zero contracts and reports 100%.
   */
  sentinels: string[];
}

const UPSTREAMS: Upstream[] = [
  {
    name: 'SuperPaymaster',
    srcDirs: ['../SuperPaymaster/contracts/src'],
    ignore: ['BasePaymasterUpgradeable', 'PaymasterBase', 'BLS'],
    sentinels: ['SuperPaymaster', 'Registry', 'GTokenStaking'],
  },
  {
    name: 'AirAccount',
    srcDirs: ['../airaccount-contract/src'],
    // AAStarBLSKeyRegistry: airaccount's Safe-owned BLS key registry (CC-27 rename of AAStarBLSAlgorithm,
    // PR #182). The SDK tracks the YAAA (DVT) contract instead, so this one is intentionally not shipped.
    ignore: ['AAStarAirAccountBase', 'AAStarAgentStorageLayout', 'AlgTierLib', 'ERC8004Addresses', 'AAStarBLSKeyRegistry'],
    sentinels: ['AAStarAirAccountV7', 'AAStarAirAccountFactoryV7'],
  },
  {
    name: 'launch (sale)',
    srcDirs: ['../launch/contracts/src', '../../mycelium/launch/contracts/src'],
    ignore: ['SaleContract', 'MockGToken'], // SaleContract superseded by V2; MockGToken is a test mock
    sentinels: ['SaleContractV2', 'APNTsSaleContract'],
  },
];

// Upstream contracts the SDK ships MERGED into a union ABI rather than as a file of their own name.
// The extension halves are only reachable through the core's fallback at the SAME address, so a
// standalone copy would invite encoding calls against the wrong address. Presence is satisfied by
// the union file; its byte-provenance and union-equality are verified by scripts/check-sp550-abis.ts.
const MERGED_INTO: Record<string, string> = {
  SuperPaymasterAdmin: 'SuperPaymaster-5.5.0.full', // SP 5.5.0 core ∪ Admin (SDK #417)
  xPNTsTokenV2: 'xPNTsTokenV2.full', // xPNTs v2 core ∪ Ext
  xPNTsTokenV2Ext: 'xPNTsTokenV2.full',
};

const sdkAbis = new Set(
  fs.existsSync(ABIS_DIR)
    ? fs.readdirSync(ABIS_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''))
    : [],
);

/** Walk a dir for *.sol and return concrete (non-interface/library/abstract) contract names. */
function concreteContracts(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (/(^|\/)(test|mock|mocks|lib|libs|interfaces?|node_modules)$/i.test(p) || /test/i.test(e.name)) continue;
        walk(p);
      } else if (e.name.endsWith('.sol')) {
        const src = fs.readFileSync(p, 'utf8');
        // a concrete contract = `contract X` NOT preceded by `abstract`, and not interface/library
        for (const m of src.matchAll(/^\s*(abstract\s+contract|contract|interface|library)\s+([A-Za-z0-9_]+)/gm)) {
          if (m[1] === 'contract') out.push(m[2]);
        }
      }
    }
  };
  walk(dir);
  return [...new Set(out)];
}

// Set REQUIRE_UPSTREAM=1 to turn "no upstream checked out" into a hard failure instead of a
// vacuous pass. Without it this script prints PASS after inspecting zero upstream contracts,
// which reads as "ABIs complete" when nothing was inspected — see .github/workflows/ci.yml.
const REQUIRE_UPSTREAM = process.env.REQUIRE_UPSTREAM === '1';

let totalMissing = 0;
let scannedUpstreams = 0;
const unscannable: string[] = [];
console.log('=== Upstream ABI completeness (SDK has ' + sdkAbis.size + ' ABIs) ===\n');

for (const up of UPSTREAMS) {
  const dir = up.srcDirs.map((d) => path.resolve(SDK_ROOT, d)).find((d) => fs.existsSync(d));
  if (!dir) {
    console.log(`⚠️  ${up.name}: source not found locally (${up.srcDirs.join(' | ')}) — skipped`);
    continue;
  }
  scannedUpstreams++;
  const found = concreteContracts(dir);
  const absent = up.sentinels.filter((c) => !found.includes(c));
  if (found.length === 0 || absent.length) {
    // A scan that did not see the contracts it must see has not inspected this upstream,
    // whatever percentage it would print — so it fails the run, separately from "ABI missing".
    console.log(`❌ ${up.name} (${dir.replace(SDK_ROOT + '/', '')}): scanned ${found.length} concrete contract(s); ` +
      `required sentinel(s) not found: ${absent.join(', ') || '(none — but zero contracts)'} — wrong or empty source dir`);
    unscannable.push(up.name);
    console.log('');
    continue;
  }
  const contracts = found.filter((c) => !(up.ignore ?? []).includes(c));
  const has = (c: string) => sdkAbis.has(c) || (MERGED_INTO[c] !== undefined && sdkAbis.has(MERGED_INTO[c]));
  const present = contracts.filter(has);
  const missing = contracts.filter((c) => !has(c));
  const merged = present.filter((c) => !sdkAbis.has(c));
  totalMissing += missing.length;
  const pct = contracts.length ? Math.round((present.length / contracts.length) * 100) : 100;
  console.log(`📦 ${up.name} (${dir.replace(SDK_ROOT + '/', '')})`);
  console.log(`   concrete contracts: ${contracts.length} | in SDK: ${present.length} (${pct}%)`);
  if (merged.length) console.log(`   ℹ️  shipped merged: ${merged.map((c) => `${c} → ${MERGED_INTO[c]}.json`).join(', ')}`);
  if (missing.length) console.log(`   ❌ MISSING ABIs: ${missing.join(', ')}`);
  else console.log(`   ✅ all concrete contracts have an SDK ABI`);
  console.log('');
}

if (unscannable.length) {
  console.error(`FAIL: ${unscannable.join(', ')}: source dir present but its required sentinel contracts were not found — nothing there was actually checked.`);
}
if (totalMissing > 0) {
  console.error(`FAIL: ${totalMissing} upstream contract ABI(s) missing from the SDK. Copy them into ${ABIS_DIR.replace(SDK_ROOT + '/', '')} (+ export in abis/index.ts).`);
  process.exit(1);
}
if (unscannable.length) process.exit(1);
if (scannedUpstreams === 0) {
  if (REQUIRE_UPSTREAM) {
    console.error(`FAIL: REQUIRE_UPSTREAM=1 but none of the ${UPSTREAMS.length} upstream sources is checked out — nothing was inspected.`);
    process.exit(1);
  }
  console.log('⚠️  no upstream source checked out — this run inspected NOTHING.');
  console.log('    It is a SKIP, not a verification. Run with REQUIRE_UPSTREAM=1 to make it fail instead.');
  process.exit(0);
}
console.log('PASS: every concrete upstream contract present locally has an SDK ABI.');
