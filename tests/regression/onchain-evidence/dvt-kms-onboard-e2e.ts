/**
 * DVT KMS-TEE key-less node onboarding E2E (CC-37 cross-repo acceptance).
 *
 * Registers a node whose BLS secret key lives ONLY in the A-board TEE — the SDK cannot run buildDvtPop
 * locally, so the PoP comes from the KMS `/pop` endpoint (airaccount-kms v0.29.0, PR #172) via the SDK's
 * `kmsPopSigner`. This is the companion to `dvt-onboard-e2e.ts` (local-key path); together they cover both
 * node kinds against the LIVE Sepolia DVT validator `0x539B9681…`.
 *
 * Flow (all live): kmsPopSigner(KMS /pop) → onboardDvtNode({ popSigner }) → operator stakes ROLE_DVT (30
 * GToken, JASON 代付) → registerWithProof(publicKey, popPoint, popSig) → assert isRegistered && nodeOperator.
 * The register tx is the CC-37 acceptance evidence.
 *
 *   KMS_POP_URL=http://<board>:3100 KMS_NODE_ID=<node_id> KMS_SIGNER_TOKEN=<tok> \
 *   pnpm exec tsx tests/regression/onchain-evidence/dvt-kms-onboard-e2e.ts
 *
 * GATED: the KMS /pop endpoint is on the A-board loopback :3100 (Tailscale). Without KMS_POP_URL this
 * script SKIPS (exit 0) — it is ready to run the moment board access + the operator EOA are provided.
 * Requires .env.sepolia: SEPOLIA_RPC_URL, PRIVATE_KEY_JASON (funder), and an operator key (see below).
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createPublicClient, createWalletClient, http, formatEther, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { onboardDvtNode, kmsPopSigner } from '@aastar/operator';
import { CANONICAL_ADDRESSES, dvtOperatorActions } from '@aastar/core';
import { kmsKeeperAccount } from './kmsKeeperAccount.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

const norm = (pk: string): Hex => (pk.startsWith('0x') ? pk : `0x${pk}`) as Hex;

async function main() {
  const KMS_POP_URL = process.env.KMS_POP_URL;
  if (!KMS_POP_URL) {
    console.log('⏭️  SKIP dvt-kms-onboard-e2e: KMS_POP_URL unset (KMS /pop is on the A-board loopback :3100 via');
    console.log('    Tailscale). Set KMS_POP_URL + KMS_NODE_ID (+ KMS_SIGNER_TOKEN) and an operator key to run.');
    return;
  }
  const nodeRef = process.env.KMS_NODE_ID || process.env.KMS_PUBLIC_KEY;
  if (!nodeRef) throw new Error('set KMS_NODE_ID (or KMS_PUBLIC_KEY) — the A-board node the TEE signs for');

  const RPC = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL!;
  const transport = http(RPC);
  const publicClient = createPublicClient({ chain: sepolia, transport });
  const c = CANONICAL_ADDRESSES[11155111];

  // operator = the EOA that stakes + registers (msg.sender); its key is separate from the TEE BLS key.
  // Two operator signer modes:
  //  (A) TEE-hosted keeper (A-board, no exportable key): set KMS_OPERATOR_ADDRESS → sign via :3100/kms/sign.
  //      The keeper signer defaults to the same loopback + token as /pop (both live on the board).
  //  (B) raw key (local/dev): set KMS_OPERATOR_KEY (or PRIVATE_KEY_JACK).
  const opAddr = process.env.KMS_OPERATOR_ADDRESS as Address | undefined;
  const opKey = process.env.KMS_OPERATOR_KEY || process.env.PRIVATE_KEY_JACK;
  let operator: { address: Address };
  if (opAddr) {
    operator = kmsKeeperAccount({
      url: process.env.KMS_OPERATOR_URL || KMS_POP_URL, // keeper /kms/sign loopback (board), defaults to /pop host
      address: opAddr,
      token: process.env.KMS_OPERATOR_TOKEN || process.env.KMS_SIGNER_TOKEN,
      signPath: process.env.KMS_OPERATOR_SIGN_PATH, // default '/kms/sign'
    });
    console.log(`operator signer = KMS-TEE keeper (remote /kms/sign, no raw key)`);
  } else {
    if (!opKey) throw new Error('set KMS_OPERATOR_ADDRESS (TEE keeper) or KMS_OPERATOR_KEY (raw key) — the operator EOA');
    operator = privateKeyToAccount(norm(opKey));
    console.log(`operator signer = raw key`);
  }
  const operatorWallet = createWalletClient({ account: operator as any, chain: sepolia, transport });

  // optional funder (owner 代付) — tops up operator ETH + GToken for the stake.
  const funderKey = process.env.PRIVATE_KEY_JASON;
  const funderWallet = funderKey
    ? createWalletClient({ account: privateKeyToAccount(norm(funderKey)), chain: sepolia, transport })
    : undefined;

  console.log(`validator = ${c.aaStarBLSAlgorithm}`);
  console.log(`operator  = ${operator.address}   funder = ${funderWallet ? funderWallet.account.address : '(none — operator self-funds)'}`);
  console.log(`KMS /pop  = ${KMS_POP_URL}   nodeRef = ${nodeRef}\n`);

  const expectedPubkey = process.env.KMS_PUBLIC_KEY as Hex | undefined;
  if (!expectedPubkey) {
    console.log('⚠️  KMS_PUBLIC_KEY not set — running UNPINNED (trusting the KMS node_id→key mapping).');
    console.log('   For the real A-board node, set KMS_PUBLIC_KEY to the node\'s known pubkey to pin it.\n');
  }
  const popSigner = kmsPopSigner({
    url: KMS_POP_URL,
    nodeId: process.env.KMS_NODE_ID,
    publicKey: expectedPubkey,
    token: process.env.KMS_SIGNER_TOKEN,
    allowUnpinnedKmsKey: !expectedPubkey, // pin when we know the key; else deliberately trust (with warning)
  });

  // Fetch + verify the PoP ONCE (kmsPopSigner pins/validates), then pass the tuple to onboardDvtNode so
  // the logged PoP is exactly the one registered (no second /pop fetch).
  const pop = await popSigner();
  console.log(`KMS /pop OK → publicKey=${pop.publicKey.slice(0, 18)}…  nodeId=${pop.nodeId}`);
  console.log('  (pinned + popPoint==hashToCurve + pairing verified client-side)\n');

  const result = await onboardDvtNode({ publicClient, operatorWallet, funderWallet, pop });

  console.log('\n=== RESULT ===');
  console.log(`nodeId          = ${result.nodeId}`);
  console.log(`operator        = ${result.operator}`);
  console.log(`registered      = ${result.registered}   alreadyRegistered = ${result.alreadyRegistered}   staked = ${result.staked}`);
  console.log(`effectiveStake  = ${formatEther(result.effectiveStake)}  (minStake ${formatEther(result.minStake)})`);
  console.log(`hashes          = ${JSON.stringify(result.hashes, null, 2)}`);

  // independent on-chain re-read
  const dvt = dvtOperatorActions(c.aaStarBLSAlgorithm as Address)(publicClient as any);
  const isReg = await dvt.isRegistered({ nodeId: result.nodeId });
  const owner = await dvt.nodeOperator({ nodeId: result.nodeId });
  console.log(`\nre-read: isRegistered=${isReg}  nodeOperator=${owner}`);
  if (!isReg || owner.toLowerCase() !== operator.address.toLowerCase()) throw new Error('POST-CONDITION FAILED');

  const evidenceTx = result.hashes.register;
  console.log(`\n✅ CC-37 KMS-TEE E2E PASS — key-less node registered via KMS /pop. register tx ${evidenceTx ?? '(idempotent, already registered)'}`);
}

main().catch((e) => { console.error('KMS E2E FAIL:', e?.shortMessage || e?.message || e); process.exit(1); });
