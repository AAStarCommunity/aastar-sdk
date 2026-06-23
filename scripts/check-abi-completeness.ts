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
}

const UPSTREAMS: Upstream[] = [
  {
    name: 'SuperPaymaster',
    srcDirs: ['../SuperPaymaster/contracts/src'],
    ignore: ['BasePaymasterUpgradeable', 'PaymasterBase', 'BLS'],
  },
  {
    name: 'AirAccount',
    srcDirs: ['../airaccount-contract/src'],
    ignore: ['AAStarAirAccountBase', 'AAStarAgentStorageLayout', 'AlgTierLib', 'ERC8004Addresses'],
  },
  {
    name: 'launch (sale)',
    srcDirs: ['../launch/contracts/src', '../../mycelium/launch/contracts/src'],
    ignore: ['SaleContract', 'MockGToken'], // SaleContract superseded by V2; MockGToken is a test mock
  },
];

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

let totalMissing = 0;
console.log('=== Upstream ABI completeness (SDK has ' + sdkAbis.size + ' ABIs) ===\n');

for (const up of UPSTREAMS) {
  const dir = up.srcDirs.map((d) => path.resolve(SDK_ROOT, d)).find((d) => fs.existsSync(d));
  if (!dir) {
    console.log(`⚠️  ${up.name}: source not found locally (${up.srcDirs.join(' | ')}) — skipped`);
    continue;
  }
  const contracts = concreteContracts(dir).filter((c) => !(up.ignore ?? []).includes(c));
  const present = contracts.filter((c) => sdkAbis.has(c));
  const missing = contracts.filter((c) => !sdkAbis.has(c));
  totalMissing += missing.length;
  const pct = contracts.length ? Math.round((present.length / contracts.length) * 100) : 100;
  console.log(`📦 ${up.name} (${dir.replace(SDK_ROOT + '/', '')})`);
  console.log(`   concrete contracts: ${contracts.length} | in SDK: ${present.length} (${pct}%)`);
  if (missing.length) console.log(`   ❌ MISSING ABIs: ${missing.join(', ')}`);
  else console.log(`   ✅ all concrete contracts have an SDK ABI`);
  console.log('');
}

if (totalMissing > 0) {
  console.error(`FAIL: ${totalMissing} upstream contract ABI(s) missing from the SDK. Copy them into ${ABIS_DIR.replace(SDK_ROOT + '/', '')} (+ export in abis/index.ts).`);
  process.exit(1);
}
console.log('PASS: every concrete upstream contract present locally has an SDK ABI.');
