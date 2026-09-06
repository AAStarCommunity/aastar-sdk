/**
 * CC-115 B4 gate runner: `pnpm exec tsx scripts/repcredit/check-deployed-stack.ts [--network sepolia]`
 *
 * Offline checks always run. On-chain checks run when an RPC is reachable and are REQUIRED in
 * release mode (`REPCREDIT_REQUIRE_ONCHAIN=1`), because "we could not reach the chain" is the one
 * excuse that would let a stale pin ship — the same shape as the vacuous-PASS problem this repo
 * already fixed once in check-abi-drift.
 */
import { createPublicClient, http } from 'viem';

import { crossCheckedClientFromUrls } from '@aastar/core';
import { CANONICAL_ADDRESSES } from '@aastar/core';
import {
  checkAirAccountLeg,
  checkDeployedAbiPin,
  checkDeployedStackOnChain,
  readDeployedStackPin,
  summarise,
  type Check,
} from './deployed-stack.js';

const argv = process.argv.slice(2);
const network = argv.includes('--network') ? argv[argv.indexOf('--network') + 1] : 'sepolia';
const requireOnChain = process.env.REPCREDIT_REQUIRE_ONCHAIN === '1';
const rpc = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';

/**
 * FU-21. This gate's readings are an outward evidence claim, and a single RPC is a single party that
 * can be wrong, stale, or lying — with nothing downstream able to tell which. `REPCREDIT_RPC_URLS`
 * takes a comma-separated list; every read is then made on all of them and must agree.
 *
 * It is opt-in and defaults to today's behaviour, because a gate that starts failing the moment a
 * second endpoint hiccups is a gate that gets switched off. What the run always does is SAY which it
 * did — the thing FU-21 is really about is that "read from one endpoint" was invisible in the output.
 */
const crossRpcs = process.env.REPCREDIT_RPC_URLS ?? '';

/**
 * The address book for a chain id, or a loud failure.
 *
 * ## Why this is a function and not an index expression
 *
 * It used to be `CANONICAL_ADDRESSES[pin.chainId] as never`, which CI rejected with TS7053: the map
 * is keyed by literal chain ids and `pin.chainId` is a `number`. The `as never` looks like it
 * silences that, but it is applied to the RESULT — the index access itself is still unchecked, so
 * the cast was answering a question nobody asked.
 *
 * Casting the index instead would have compiled and been worse. An id with no entry yields
 * `undefined`, `as never` lets it through, and it reaches `checkAirAccountLeg` as a book whose every
 * lookup is `undefined` — which surfaces as a pile of address mismatches, i.e. a reading that looks
 * like a finding about the deployment rather than about the argument.
 *
 * So it throws. There is no useful behaviour for "run the deployed-stack gate against a chain we
 * have no addresses for", and the failure should name that, not describe nine wrong addresses.
 */
function addressBookFor(chainId: number): Record<string, string> {
  const book = (CANONICAL_ADDRESSES as Record<number, Record<string, string> | undefined>)[chainId];
  if (!book) {
    throw new Error(
      `check-deployed-stack: no canonical address book for chainId ${chainId}. ` +
        `Known: ${Object.keys(CANONICAL_ADDRESSES).join(', ')}.`,
    );
  }
  return book;
}

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
    const cross = crossCheckedClientFromUrls(crossRpcs);
    const client = cross ? cross.client : createPublicClient({ transport: http(rpc) });
    console.log('\n-- on-chain --');
    console.log(
      cross && cross.sources.length > 1
        ? `   sources: ${cross.sources.join(' + ')} (cross-checked; any disagreement fails the gate)`
        : `   sources: ${cross ? cross.sources[0] : new URL(rpc).host} — SINGLE ENDPOINT, not corroborated. ` +
          'Set REPCREDIT_RPC_URLS=<url,url> to cross-check (FU-21).',
    );
    if (cross?.sameProvider) {
      console.log(
        '   ⚠️  two of those hosts share a registrable domain — probably one provider, so agreement ' +
        'between them is weaker evidence than the count suggests.',
      );
    }
    const live = await checkDeployedStackOnChain(pin, client as never);
    // The AirAccount v0.33.0 leg (CC-115 B6-prep). Kept in the same on-chain block so a run that
    // could not reach a node reports ALL of it as unreached, rather than half-passing offline.
    live.push(...(await checkAirAccountLeg(pin, client as never, addressBookFor(pin.chainId) as never)));
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
