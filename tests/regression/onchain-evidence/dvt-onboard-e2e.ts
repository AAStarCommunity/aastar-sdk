/**
 * DVT one-click onboarding E2E (CC-36) — the on-chain acceptance gate for the `@aastar/operator`
 * {@link onboardDvtNode} L2 workflow. Nothing is mocked; both paths run against the LIVE Sepolia DVT
 * validator (`AAStarBLSAlgorithm` = CANONICAL_ADDRESSES[11155111].aaStarBLSAlgorithm = 0x539B9681…):
 *
 *   PATH A — idempotency: onboardDvtNode(operator = JACK, JACK's deterministic BLS key). JACK is already
 *     onboarded, so the workflow must short-circuit with alreadyRegistered=true and send NO transaction.
 *
 *   PATH B — full "owner 代付" flow: a FRESH ephemeral operator EOA (owns no node) + a fresh BLS key,
 *     funded by JASON (funder). onboardDvtNode must: top up the operator's ETH + GToken, approve
 *     GToken→GTokenStaking, registerRole(ROLE_DVT) (lock >= minStake), then registerWithProof — binding
 *     nodeId = keccak256(publicKey) to the fresh operator. Asserts registered && staked && the tx hashes
 *     for every step && on-chain isRegistered && nodeOperator == the fresh operator.
 *
 *   pnpm exec tsx tests/regression/onchain-evidence/dvt-onboard-e2e.ts
 *
 * Requires .env.sepolia: SEPOLIA_RPC_URL, PRIVATE_KEY_JASON (funder + GToken holder), PRIVATE_KEY_JACK.
 * PATH B locks ~33 GToken into a throwaway operator each run — intentional; it is a one-shot acceptance.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import {
  createPublicClient, createWalletClient, http, formatEther, keccak256, toHex, type Address, type Hex,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { randomBytes } from 'node:crypto';
import { bls12_381 as bls } from '@noble/curves/bls12-381';
import { onboardDvtNode } from '@aastar/operator';
import { CANONICAL_ADDRESSES } from '@aastar/core';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

const norm = (pk: string): Hex => (pk.startsWith('0x') ? pk : `0x${pk}`) as Hex;
const log = (...a: any[]) => console.log(...a);
const j = (v: any) => JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? val.toString() : val));

/** A fresh BLS scalar in [1, r-1] as a 32-byte hex — a genuinely new node key per run. */
function freshBlsKey(): Hex {
  let sk = 0n;
  while (sk <= 0n) sk = BigInt(toHex(randomBytes(32))) % bls.params.r;
  return toHex(sk, { size: 32 });
}

async function main() {
  const RPC = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL!;
  const transport = http(RPC);
  const publicClient = createPublicClient({ chain: sepolia, transport });
  const c = CANONICAL_ADDRESSES[11155111];

  const funder = privateKeyToAccount(norm(process.env.PRIVATE_KEY_JASON!));
  const jack = privateKeyToAccount(norm(process.env.PRIVATE_KEY_JACK!));
  const funderWallet = createWalletClient({ account: funder, chain: sepolia, transport });
  const jackWallet = createWalletClient({ account: jack, chain: sepolia, transport });

  log(`validator = ${c.aaStarBLSAlgorithm}`);
  log(`funder(JASON) = ${funder.address}   operator(JACK) = ${jack.address}\n`);

  // ---------- PATH A: idempotency ----------
  log('=== PATH A — idempotency (JACK, deterministic node key) ===');
  const jackBls = toHex(BigInt(keccak256(toHex('aastar-dvt-jack-testnode-v1'))) % bls.params.r, { size: 32 });
  const a = await onboardDvtNode({ publicClient, operatorWallet: jackWallet, blsSecretKey: jackBls });
  log(`nodeId=${a.nodeId} alreadyRegistered=${a.alreadyRegistered} registered=${a.registered} hashes=${JSON.stringify(a.hashes)}`);
  if (!a.alreadyRegistered || a.registered || Object.keys(a.hashes).length !== 0) {
    throw new Error('PATH A FAIL: expected idempotent short-circuit with no tx');
  }
  log('✅ PATH A PASS — idempotent no-op\n');

  // ---------- PATH C: dryRun must perform NO writes (Codex High-1 regression guard) ----------
  log('=== PATH C — dryRun on a fresh operator (must send ZERO tx) ===');
  const dryOp = privateKeyToAccount(generatePrivateKey());
  const dryOpWallet = createWalletClient({ account: dryOp, chain: sepolia, transport });
  const dryEthBefore = await publicClient.getBalance({ address: dryOp.address });
  const cc = await onboardDvtNode({ publicClient, operatorWallet: dryOpWallet, blsSecretKey: freshBlsKey(), dryRun: true });
  const dryEthAfter = await publicClient.getBalance({ address: dryOp.address });
  log(`plan=${j(cc.plan)} hashes=${j(cc.hashes)}`);
  if (Object.keys(cc.hashes).length !== 0) throw new Error('PATH C FAIL: dryRun sent a transaction');
  if (!cc.plan || !cc.plan.wouldRegisterRole || cc.plan.requireStake !== true) throw new Error('PATH C FAIL: plan not computed');
  if (dryEthAfter !== dryEthBefore) throw new Error('PATH C FAIL: dryRun changed operator balance');
  log('✅ PATH C PASS — dryRun computed a plan and sent no tx\n');

  // ---------- PATH B: full owner-代付 flow with a fresh operator ----------
  log('=== PATH B — full stake+register (fresh operator, JASON 代付) ===');
  const freshOp = privateKeyToAccount(generatePrivateKey());
  const freshOpWallet = createWalletClient({ account: freshOp, chain: sepolia, transport });
  const blsKey = freshBlsKey();
  log(`fresh operator = ${freshOp.address}  (owns no node, zero balance)`);

  const b = await onboardDvtNode({
    publicClient,
    operatorWallet: freshOpWallet,
    funderWallet,
    blsSecretKey: blsKey,
  });

  log(`\n=== PATH B RESULT ===`);
  log(`nodeId          = ${b.nodeId}`);
  log(`operator        = ${b.operator}`);
  log(`registered      = ${b.registered}   staked = ${b.staked}`);
  log(`effectiveStake  = ${formatEther(b.effectiveStake)}  (minStake ${formatEther(b.minStake)})`);
  log(`hashes          = ${JSON.stringify(b.hashes, null, 2)}`);

  if (!b.registered || !b.staked) throw new Error('PATH B FAIL: expected registered && staked');
  for (const step of ['fundEth', 'fundGToken', 'approve', 'registerRole', 'register'] as const) {
    if (!b.hashes[step]) throw new Error(`PATH B FAIL: missing ${step} tx (funder 代付 step did not run)`);
  }
  if (b.effectiveStake < b.minStake) throw new Error('PATH B FAIL: effectiveStake < minStake');

  // independent on-chain re-read
  const { dvtOperatorActions } = await import('@aastar/core');
  const dvt = dvtOperatorActions(c.aaStarBLSAlgorithm as Address)(publicClient as any);
  const isReg = await dvt.isRegistered({ nodeId: b.nodeId });
  const owner = await dvt.nodeOperator({ nodeId: b.nodeId });
  log(`\nre-read: isRegistered=${isReg}  nodeOperator=${owner}`);
  if (!isReg || owner.toLowerCase() !== freshOp.address.toLowerCase()) throw new Error('PATH B FAIL: on-chain post-condition');

  log(`\n✅ PATH B PASS — onboardDvtNode staked + registered a fresh node via JASON 代付. register tx ${b.hashes.register}`);
  log('\n✅✅ CC-36 E2E PASS — onboardDvtNode proven on live Sepolia 0x539B (idempotent + full 代付 flow).');
}

main().catch((e) => { console.error('E2E FAIL:', e?.shortMessage || e?.message || e); process.exit(1); });
