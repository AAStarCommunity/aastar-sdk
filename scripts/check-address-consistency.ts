#!/usr/bin/env tsx
/**
 * Address-consistency drift check (Beta3.1 P2.8).
 *
 * SINGLE SOURCE OF TRUTH for SDK contract addresses:
 *   `CANONICAL_ADDRESSES` in `packages/core/src/addresses.ts` (keyed by chainId).
 *
 * How addresses flow in the SDK:
 *   ENV (REGISTRY, GTOKEN, ...) > config.{network}.json (only when
 *   AASTAR_LOAD_LOCAL_CONFIG=1, via packages/core/src/node-init.ts -> applyConfig)
 *   > CANONICAL_ADDRESSES defaults
 *     -> packages/core/src/constants.ts (*_ADDRESS exports)
 *       -> packages/core/src/contract-addresses.ts (CORE_ADDRESSES / TOKEN_ADDRESSES ...)
 *         -> all consumers.
 *
 * The root `config.{network}.json` files are dev/deploy-time overrides. For every
 * network that maps to a chain present in CANONICAL_ADDRESSES they MUST agree with
 * the canonical table -- otherwise a consumer running with local config resolves
 * different addresses than an npm consumer using canonical defaults. This script
 * asserts that agreement and exits non-zero on any divergence.
 *
 * NOTE on `@aastar/shared-config`: that package is an independent external repo
 * (github.com/AAStarCommunity/aastar-shared-config), vendored here ONLY as two git
 * submodules (ext/aastar-shared-config, lib/shared-config). It is NOT a pnpm
 * workspace package and is NOT consumed by the SDK runtime (its lone import in
 * scripts/deploy_paymaster_v4.ts is `// @ts-ignore`'d and unresolved). It therefore
 * is not a competing source of truth for the SDK and is intentionally out of scope
 * for this check. `@aastar/core` is authoritative; shared-config syncs on its own.
 *
 * Run: `pnpm exec tsx scripts/check-address-consistency.ts`
 *  or:  `pnpm run check:addresses`
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANONICAL_ADDRESSES } from '../packages/core/src/addresses.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

// network name -> chainId. Mirrors the resolution in packages/core/src/constants.ts.
// Only networks whose chainId exists in CANONICAL_ADDRESSES are checked; others
// (anvil, ethereum mainnet, *-2-10 variants) have no canonical table to compare to.
const NETWORK_CHAIN_IDS: Record<string, number> = {
  // 'op-mainnet' is the canonical chain-10 config; the legacy 'optimism' alias + its stale
  // config.optimism.json (missing paymasterV4, dead srcHash/updateTime) were removed (CC-30 G10).
  'op-mainnet': 10,
  sepolia: 11155111,
  'op-sepolia': 11155420,
};

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

interface Mismatch {
  key: string;
  config: string;
  canonical: string;
}

const canonicalTables = CANONICAL_ADDRESSES as Record<number, Record<string, string>>;

const lines: string[] = [];
let totalMismatches = 0;
let totalCompared = 0;
let filesChecked = 0;

for (const [network, chainId] of Object.entries(NETWORK_CHAIN_IDS)) {
  const canonical = canonicalTables[chainId];
  if (!canonical) continue; // no canonical table for this chain

  const configPath = resolve(repoRoot, `config.${network}.json`);
  if (!existsSync(configPath)) continue;

  filesChecked++;
  const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;

  const mismatches: Mismatch[] = [];
  let compared = 0;
  for (const [key, value] of Object.entries(config)) {
    if (typeof value !== 'string' || !ADDRESS_RE.test(value)) continue; // skip non-address fields
    if (!(key in canonical)) continue; // key not tracked canonically; nothing to compare
    compared++;
    if (canonical[key].toLowerCase() !== value.toLowerCase()) {
      mismatches.push({ key, config: value.toLowerCase(), canonical: canonical[key].toLowerCase() });
    }
  }

  totalCompared += compared;
  totalMismatches += mismatches.length;

  if (mismatches.length === 0) {
    lines.push(`  config.${network}.json (chain ${chainId}): OK (${compared} address keys match canonical)`);
  } else {
    lines.push(
      `  config.${network}.json (chain ${chainId}): ${mismatches.length}/${compared} address keys DIVERGE from canonical`,
    );
    for (const m of mismatches) {
      lines.push(`    - ${m.key}`);
      lines.push(`        config    = ${m.config}`);
      lines.push(`        canonical = ${m.canonical}`);
    }
  }
}

console.log('Address consistency check');
console.log('Source of truth: @aastar/core CANONICAL_ADDRESSES (packages/core/src/addresses.ts)');
console.log(`Checked ${filesChecked} config file(s), ${totalCompared} address comparison(s).\n`);
console.log(lines.join('\n'));

if (totalMismatches > 0) {
  console.error(
    `\nFAIL: ${totalMismatches} address(es) diverge between config.*.json and CANONICAL_ADDRESSES.`,
  );
  console.error('Reconcile each diverging key: update the stale config.{network}.json to match');
  console.error('packages/core/src/addresses.ts, or update the canonical table if the config is correct.');
  process.exit(1);
}

console.log('\nPASS: all checked config.*.json address keys agree with CANONICAL_ADDRESSES.');
