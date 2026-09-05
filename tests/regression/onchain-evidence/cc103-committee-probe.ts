/**
 * CC-103 on-chain truth probe (READ-ONLY).
 *
 * Establishes what is actually deployed before the SDK syncs to it, rather than trusting
 * the cross-repo task comments. Covers: router->validator mount, committee validator state
 * (TREE_DEPTH / epochLength / quorum sentinel / active set), account stack versions, and the
 * SuperPaymaster guardian-slash aggregator.
 *
 * Env: SEPOLIA_RPC_URL (or RPC_URL) from .env.sepolia.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createPublicClient, http, type Address, type Hex } from 'viem';
import { sepolia } from 'viem/chains';

dotenv.config({ path: path.resolve(import.meta.dirname, '../../../.env.sepolia') });

const RPC = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL;
if (!RPC) throw new Error('missing SEPOLIA_RPC_URL / RPC_URL');
const pc = createPublicClient({ chain: sepolia, transport: http(RPC) });

const fn = (name: string, inputs: any[], outputs: any[]) =>
  [{ type: 'function', name, stateMutability: 'view', inputs, outputs }] as const;

async function rd(label: string, address: Address, name: string, inputs: any[], outputs: any[], args: any[] = []) {
  try {
    const v = await pc.readContract({ address, abi: fn(name, inputs, outputs) as any, functionName: name, args });
    const s = Array.isArray(v) ? JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x)) : String(v);
    console.log(`  ${label.padEnd(38)} ${s.length > 90 ? s.slice(0, 90) + '…' : s}`);
    return v;
  } catch (e: any) {
    console.log(`  ${label.padEnd(38)} X ${(e?.shortMessage || e?.message || e).toString().slice(0, 58)}`);
    return null;
  }
}

// SDK canonical today (v0.28.0 stack)
const OLD_ROUTER = '0xA6bdfD17C178b43B464736408e0Fe03D5a7684eB' as Address;
const OLD_FACTORY = '0x778ab75636F1350c31930078208eFB02E9765ed3' as Address;
// CC-103 / airaccount-contract v0.31.0 stack
const NEW_ROUTER = '0xA15127e8601e77De7C655bf04ca75cccD8C968f0' as Address;
const CMT_VAL = '0x1A8Db639b5d8Bd5742edB083656EDD56f416cd64' as Address;
const NEW_FACTORY = '0x25C1E9F9120a406581f93bA82f7Cfd6805512791' as Address;
const NEW_IMPL = '0x4873b7C1c07BE1b52d6583A64F5E902e593BDdad' as Address;
const ENROLLED = '0xf249d5708cC3e1Dff42F5B36935FF270BeC403A0' as Address;
// SuperPaymaster proxy (SDK canonical) — guardian-slash aggregator lives behind it
const SP = '0x09DF0d2e3722EC0e401fE3819E64278a42ae4DE9' as Address;

const addr = [{ type: 'address' }];
const u256 = [{ type: 'uint256' }];
const b32 = [{ type: 'bytes32' }];
const str = [{ type: 'string' }];
const bool = [{ type: 'bool' }];
const MAX_U256 = (1n << 256n) - 1n;

async function main() {
  console.log(`block=${await pc.getBlockNumber()}  rpc=${RPC!.slice(0, 40)}…\n`);

  console.log('== router.getAlgorithm(0x01) ==');
  await rd('OLD router 0xA6bd (SDK canonical)', OLD_ROUTER, 'getAlgorithm', [{ type: 'uint8' }], addr, [1]);
  await rd('NEW router 0xA151 (CC-103)', NEW_ROUTER, 'getAlgorithm', [{ type: 'uint8' }], addr, [1]);

  console.log('\n== committee validator 0x1A8Db639 ==');
  const active = await rd('committeeActive()', CMT_VAL, 'committeeActive', [], bool);
  const q = (await rd('requiredQuorum()', CMT_VAL, 'requiredQuorum', [], u256)) as bigint | null;
  if (q !== null) {
    console.log(`  ${'  ^ sentinel?'.padEnd(38)} ${q === MAX_U256 ? 'YES = type(uint256).max (fail-closed)' : 'no, real quorum'}`);
  }
  const depth = (await rd('TREE_DEPTH()', CMT_VAL, 'TREE_DEPTH', [], u256)) as bigint | null;
  if (depth !== null) console.log(`  ${'  -> perSigner = 64 + depth*32'.padEnd(38)} ${64n + depth * 32n} bytes`);
  await rd('epochLength()', CMT_VAL, 'epochLength', [], u256);
  await rd('activeCount()', CMT_VAL, 'activeCount', [], u256);
  await rd('nextSlot()', CMT_VAL, 'nextSlot', [], u256);
  await rd('configVersion()', CMT_VAL, 'configVersion', [], u256);
  await rd('oversampleNum()', CMT_VAL, 'oversampleNum', [], u256);
  await rd('oversampleDen()', CMT_VAL, 'oversampleDen', [], u256);
  await rd('expectedCommittee(3)', CMT_VAL, 'expectedCommittee', u256, u256, [3n]);
  await rd('expectedCommittee(39)', CMT_VAL, 'expectedCommittee', u256, u256, [39n]);
  await rd('enrolledAccount(testAcct)', CMT_VAL, 'enrolledAccount', addr, bool, [ENROLLED]);
  await rd('owner()', CMT_VAL, 'owner', [], addr);

  console.log('\n== active set / Merkle (需要真实 nodeId) ==');
  // SlotAssigned events tell us which nodeIds are in the active set.
  try {
    const logs = await pc.getLogs({
      address: CMT_VAL,
      event: {
        type: 'event',
        name: 'SlotAssigned',
        inputs: [
          { name: 'nodeId', type: 'bytes32', indexed: true },
          { name: 'slot', type: 'uint256', indexed: false },
        ],
      },
      fromBlock: 'earliest',
      toBlock: 'latest',
    });
    console.log(`  SlotAssigned events: ${logs.length}`);
    for (const l of logs.slice(0, 5)) {
      const nid = (l as any).args?.nodeId as Hex;
      console.log(`    nodeId=${nid} slot=${(l as any).args?.slot}`);
      await rd(`  getMerkleProof(${nid.slice(0, 10)}…)`, CMT_VAL, 'getMerkleProof', b32, [{ type: 'uint256' }, { type: 'bytes32[]' }], [nid]);
    }
  } catch (e: any) {
    console.log(`  X SlotAssigned scan failed: ${(e?.shortMessage || e?.message || e).toString().slice(0, 80)}`);
  }

  console.log('\n== account stack versions ==');
  await rd('OLD factory FACTORY_VERSION', OLD_FACTORY, 'FACTORY_VERSION', [], str);
  await rd('NEW factory FACTORY_VERSION', NEW_FACTORY, 'FACTORY_VERSION', [], str);
  await rd('NEW factory implementation()', NEW_FACTORY, 'implementation', [], addr);
  await rd('NEW impl ACCOUNT_VERSION', NEW_IMPL, 'ACCOUNT_VERSION', [], str);
  await rd('enrolled acct ACCOUNT_VERSION', ENROLLED, 'ACCOUNT_VERSION', [], str);
  await rd('enrolled acct validator()', ENROLLED, 'validator', [], addr);

  console.log('\n== SuperPaymaster guardian-slash aggregator ==');
  const agg = (await rd('SP.BLS_AGGREGATOR()', SP, 'BLS_AGGREGATOR', [], addr)) as Address | null;
  if (agg) {
    await rd('agg.fraudProofVerifier()', agg, 'fraudProofVerifier', [], addr);
    // `version()`, lowercase. The deployed BLSAggregator has no `VERSION()` — measured: selector
    // 0xffa1ad74 is absent from its 23667 bytes while 0x54fd4d50 (`version()`) is present. The
    // probe used to ask for the upper-case one and print `X ... reverted`, which reads as a fact
    // about the CONTRACT when it was a fact about the question. It also cost us the one datum the
    // release verdict leans on: `version()` returns "BLSAggregator-4.11.0", straight from chain.
    await rd('agg.version()', agg, 'version', [], str);
  }
}

main().catch((e) => {
  console.error('PROBE FAIL:', e?.shortMessage || e?.message || e);
  process.exit(1);
});
