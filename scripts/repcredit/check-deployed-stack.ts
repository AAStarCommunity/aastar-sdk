/**
 * CC-115 B4 gate runner: `pnpm exec tsx scripts/repcredit/check-deployed-stack.ts [--network sepolia]`
 *
 * Offline checks always run. On-chain checks run when an RPC is reachable and are REQUIRED in
 * release mode (`REPCREDIT_REQUIRE_ONCHAIN=1`), because "we could not reach the chain" is the one
 * excuse that would let a stale pin ship — the same shape as the vacuous-PASS problem this repo
 * already fixed once in check-abi-drift.
 */
import { createPublicClient, http } from 'viem';

import { checkDeployedAbiPin, checkDeployedStackOnChain, readDeployedStackPin, summarise, type Check } from './deployed-stack.js';

const argv = process.argv.slice(2);
const network = argv.includes('--network') ? argv[argv.indexOf('--network') + 1] : 'sepolia';
const requireOnChain = process.env.REPCREDIT_REQUIRE_ONCHAIN === '1';
const rpc = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';

const sdkRoot = process.cwd();
const upstreamRoot = process.env.REPCREDIT_SP_ROOT || `${sdkRoot}/../SuperPaymaster`;

async function main() {
  const pin = readDeployedStackPin(network, sdkRoot);
  const checks: Check[] = [];

  console.log(`\n== CC-115 B4 deployed-stack gate — ${network} ==`);
  console.log(`   aggregator ${pin.addresses.blsAggregator}  ${pin.aggregator.version}`);
  console.log(`   manifest   ${pin.manifest.sha256.slice(0, 16)}…  (${pin.manifest.stackKind})`);
  console.log(`   ABI        ${pin.aggregator.abi.repo}@${pin.aggregator.abi.revision.slice(0, 12)}:${pin.aggregator.abi.path}\n`);

  console.log('-- offline (repo + pin) --');
  const offline = checkDeployedAbiPin(pin, sdkRoot, upstreamRoot);
  checks.push(...offline);
  console.log(summarise(offline).text);

  let onChainRan = false;
  try {
    const client = createPublicClient({ transport: http(rpc) });
    console.log('\n-- on-chain --');
    const live = await checkDeployedStackOnChain(pin, client as never);
    checks.push(...live);
    onChainRan = true;
    console.log(summarise(live).text);
  } catch (error) {
    const detail = `on-chain checks could not run against ${rpc.slice(0, 48)}… — ${String(error).slice(0, 200)}`;
    if (requireOnChain) {
      checks.push({ name: 'onchain:reachable', ok: false, detail });
      console.log(`\n❌ ${detail}`);
    } else {
      console.log(`\n⚠️  SKIPPED: ${detail}`);
      console.log('   (set REPCREDIT_REQUIRE_ONCHAIN=1 to make this a failure — release mode does)');
    }
  }

  const total = summarise(checks);
  console.log(
    `\n${total.ok ? '✅' : '❌'} ${checks.length} check(s), ${total.failed.length} failed; on-chain ${onChainRan ? 'RAN' : 'did NOT run'}`,
  );
  if (!total.ok) {
    console.log('\nfailed:');
    for (const f of total.failed) console.log(`  ❌ ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
