#!/usr/bin/env tsx
/**
 * Upstream DEPLOYMENT / address sync — the companion to abi-sync.
 *
 * abi-sync keeps the contract INTERFACE in step. This keeps the DEPLOYED ADDRESSES in step — the
 * part that actually changes when an upstream ships a new network (esp. MAINNET) or redeploys. The
 * ABI is usually identical mainnet-vs-testnet, so abi-sync stays silent on a mainnet launch; THIS
 * is what flags it.
 *
 * It detects, per upstream repo, which chainIds have deployment artifacts (foundry `broadcast/<script>/
 * <chainId>/`, SuperPaymaster's `deployments/config.<net>.json`, `.env.<net>`), compares to the SDK's
 * address books (CANONICAL_ADDRESSES + LAUNCH_SALE_ADDRESSES), and reports:
 *   • chainIds an upstream deployed to but the SDK doesn't cover (← a mainnet launch shows up here),
 *   • for SuperPaymaster (clean config files), per-key ADDRESS drift vs the SDK's config.<net>.json,
 *   • mainnet-readiness gaps the SDK must fill (DVT environments.mainnet, launch sale mainnet group).
 *
 * This is DETECTION. Resolving a mainnet launch (fill addresses → on-chain verify → DVT/KMS env →
 * test → release) is driven by the `address-sync` skill. On-chain verification is the acceptance,
 * never the deployment file.
 *
 *   pnpm run address:sync
 */
import * as fs from 'fs';
import * as path from 'path';

const SDK_ROOT = process.cwd();
const ADDR_TS = path.join(SDK_ROOT, 'packages/core/src/addresses.ts');

const NET2CHAIN: Record<string, number> = {
  'op-mainnet': 10, optimism: 10, mainnet: 1, ethereum: 1,
  sepolia: 11155111, 'sepolia-2-10': 11155111,
  'op-sepolia': 11155420, 'op-sepolia-2-10': 11155420, anvil: 31337,
};
const CHAIN_NAME: Record<number, string> = { 1: 'Ethereum', 10: 'Optimism', 11155111: 'Sepolia', 11155420: 'OP-Sepolia', 31337: 'Anvil' };
const MAINNETS = new Set([1, 10]);

interface Repo { name: string; roots: string[]; deployDir?: string }
const REPOS: Repo[] = [
  { name: 'SuperPaymaster', roots: ['../SuperPaymaster'], deployDir: 'deployments' },
  { name: 'AirAccount', roots: ['../airaccount-contract'] },
  { name: 'launch', roots: ['../launch/contracts', '../../mycelium/launch/contracts'] },
];

const resolveRoot = (r: Repo) => r.roots.map((d) => path.resolve(SDK_ROOT, d)).find((d) => fs.existsSync(d));

/** chainIds with a foundry broadcast dir under <root>/broadcast/<script>/<chainId>/. */
function broadcastChains(root: string): Set<number> {
  const found = new Set<number>();
  const bdir = path.join(root, 'broadcast');
  if (!fs.existsSync(bdir)) return found;
  for (const script of fs.readdirSync(bdir, { withFileTypes: true })) {
    if (!script.isDirectory()) continue;
    for (const c of fs.readdirSync(path.join(bdir, script.name), { withFileTypes: true })) {
      const n = Number(c.name);
      if (c.isDirectory() && Number.isInteger(n)) found.add(n);
    }
  }
  return found;
}

/** chainIds for which a deployments/config.<net>.json exists with at least one non-zero address. */
function deployConfigChains(root: string, dir: string): Map<number, string> {
  const out = new Map<number, string>();
  const d = path.join(root, dir);
  if (!fs.existsSync(d)) return out;
  for (const f of fs.readdirSync(d)) {
    const m = f.match(/^config\.(.+)\.json$/);
    if (!m) continue;
    const chain = NET2CHAIN[m[1]];
    if (!chain) continue;
    const txt = fs.readFileSync(path.join(d, f), 'utf8');
    if (/0x[a-fA-F0-9]{40}/.test(txt.replace(/0x0{40}/g, ''))) out.set(chain, f);
  }
  return out;
}

/** numeric top-level keys of an `export const NAME = { ... }` object in addresses.ts. */
function sdkChainKeys(name: string): Set<number> {
  const txt = fs.readFileSync(ADDR_TS, 'utf8');
  const start = txt.indexOf(`export const ${name}`);
  if (start < 0) return new Set();
  // grab until the matching closing of the first-level object (heuristic: next "\n};")
  const body = txt.slice(start, txt.indexOf('\n};', start));
  return new Set([...body.matchAll(/^\s{2,4}(\d+):\s*\{/gm)].map((m) => Number(m[1])));
}

const canonicalChains = sdkChainKeys('CANONICAL_ADDRESSES');
const saleChains = sdkChainKeys('LAUNCH_SALE_ADDRESSES');

let problems = 0;
console.log('=== Upstream deployment / address sync ===\n');
console.log(`SDK address books: CANONICAL chains [${[...canonicalChains].join(', ')}] · LAUNCH_SALE chains [${[...saleChains].join(', ')}]\n`);

for (const repo of REPOS) {
  const root = resolveRoot(repo);
  if (!root) { console.log(`⚠️  ${repo.name}: not found locally — skipped`); continue; }
  const chains = broadcastChains(root);
  const cfgChains = repo.deployDir ? deployConfigChains(root, repo.deployDir) : new Map<number, string>();
  for (const c of cfgChains.keys()) chains.add(c);
  const book = repo.name === 'launch' ? saleChains : canonicalChains;

  console.log(`📦 ${repo.name}: deployed to [${[...chains].map((c) => CHAIN_NAME[c] ?? c).join(', ') || 'none detected'}]`);
  const missing = [...chains].filter((c) => c !== 31337 && !book.has(c));
  for (const c of missing) {
    problems++;
    const tag = MAINNETS.has(c) ? '🔴 MAINNET' : 'testnet';
    const where = repo.name === 'launch' ? 'LAUNCH_SALE_ADDRESSES' : 'CANONICAL_ADDRESSES';
    console.log(`   ❌ ${tag} chain ${CHAIN_NAME[c] ?? c} deployed upstream but NOT in SDK ${where}`);
  }
  if (!missing.length) console.log(`   ✅ all upstream chains covered by the SDK book`);
  console.log('');
}

// Mainnet-readiness gaps in SDK config (beyond addresses)
console.log('— mainnet-readiness (fill before a mainnet launch) —');
const dvt = fs.readFileSync(path.join(SDK_ROOT, 'packages/core/src/dvt.ts'), 'utf8');
if (/mainnet:\s*null/.test(dvt)) { problems++; console.log('   ❌ DVT environments.mainnet = null (gasless relay/keeper not configured for mainnet)'); }
else console.log('   ✅ DVT environments.mainnet is configured');
if (!saleChains.has(10) && !saleChains.has(1)) { console.log('   ⚠️  LAUNCH_SALE_ADDRESSES has no mainnet group (add when the sale stack launches on mainnet)'); }

console.log(`\n${problems} gap(s). On a real mainnet launch, follow the address-sync skill (fill addresses → on-chain verify → DVT/KMS env → check:addresses → test → release).`);
process.exit(problems > 0 ? 1 : 0);
