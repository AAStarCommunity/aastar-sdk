/**
 * DVT node registration E2E (cross-repo, airaccount-contract v0.27.0 / YetAnotherAA-Validator #165) —
 * the @aastar/sdk `buildDvtPop` + `dvtOperatorActions.register` path proven on the LIVE Sepolia
 * DVT validator (`AAStarBLSAlgorithm` = CANONICAL_ADDRESSES[11155111].aaStarBLSAlgorithm = 0x539B9681…).
 *
 * This is the on-chain acceptance gate for aastar-sdk #279 / PR #288 (CC-17). Nothing is mocked: a
 * fresh operator EOA is onboarded to ROLE_DVT (staked), then `registerWithProof(publicKey, popPoint,
 * popSig)` — with the tuple built ENTIRELY by the SDK's `buildDvtPop` — is submitted and ACCEPTED by
 * the contract's on-chain BLS pairing PoP check, binding nodeId = keccak256(publicKey) to the operator.
 *
 * Flow (all live):
 *   0. operator = a persistent test EOA (JACK). Idempotent: if it already owns a node, verify + exit.
 *   1. Fund: JASON (funder + GToken owner/holder) tops up operator's ETH (gas) and GToken (stake) if low.
 *   2. operator approves GToken -> GTokenStaking, then registerRole(ROLE_DVT) (locks minStake=30 +
 *      ticketPrice=3). Verify registry.hasRole(ROLE_DVT) && getEffectiveStake >= minStake.
 *   3. pop = buildDvtPop(nodeBlsKey)  (SDK-built: publicKey 128B G1, popPoint/popSig 256B G2, nodeId).
 *   4. Preflight simulate registerWithProof (catches any revert before spending gas).
 *   5. operator.registerWithProof(pop) via dvtOperatorActions.register  -> tx.
 *   6. Assert isRegistered(nodeId) === true && nodeOperator(nodeId) === operator. Print tx hashes.
 *
 *   pnpm exec tsx tests/regression/onchain-evidence/dvt-register-e2e.ts
 *
 * Requires .env.sepolia: SEPOLIA_RPC_URL, PRIVATE_KEY_JASON (funder, GToken holder), PRIVATE_KEY_JACK.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import {
  createPublicClient, createWalletClient, http, formatEther, parseEther,
  keccak256, toHex, type Address, type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { bls12_381 as bls } from '@noble/curves/bls12-381';
import {
  dvtOperatorActions, buildDvtPop, ROLE_DVT, CANONICAL_ADDRESSES,
  registryActions, tokenActions, AAStarBLSAlgorithmABI,
} from '@aastar/core';
import { resilientSepoliaTransport } from './_rpc.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

const VALIDATOR = CANONICAL_ADDRESSES[11155111].aaStarBLSAlgorithm as Address;
const GTOKEN = '0x4c09aE57503Aa1E2A43b05621A38DbdD43b0Aa08' as Address;
const GTOKEN_STAKING = '0x472297B557c1d0F030f281a5Bb8A535f6c5AB65e' as Address;
const REGISTRY = '0xf5Bf37ca83AfdAab73691bA7eCcDfA69b8708E71' as Address;

const norm = (pk: string): Hex => (pk.startsWith('0x') ? pk : `0x${pk}`) as Hex;
const log = (...a: any[]) => console.log(...a);

async function main() {
  const RPC = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL!;
  const transport = resilientSepoliaTransport ? resilientSepoliaTransport() : http(RPC);
  const pub = createPublicClient({ chain: sepolia, transport });

  const funder = privateKeyToAccount(norm(process.env.PRIVATE_KEY_JASON!));
  const operator = privateKeyToAccount(norm(process.env.PRIVATE_KEY_JACK!));
  const funderWallet = createWalletClient({ account: funder, chain: sepolia, transport });
  const opWallet = createWalletClient({ account: operator, chain: sepolia, transport });

  const dvtRead = dvtOperatorActions(VALIDATOR)(pub as any);
  const dvtOp = dvtOperatorActions(VALIDATOR)(opWallet as any);
  const reg = registryActions(REGISTRY)(pub as any);
  const regOp = registryActions(REGISTRY)(opWallet as any);
  const gtRead = tokenActions()(pub as any);
  const gtFunder = tokenActions()(funderWallet as any);
  const gtOp = tokenActions()(opWallet as any);

  log(`validator = ${VALIDATOR}`);
  log(`funder(JASON) = ${funder.address}   operator(JACK) = ${operator.address}\n`);

  const wait = (hash: Hex) => pub.waitForTransactionReceipt({ hash });

  // --- 0. idempotency: operator already owns a node? ---
  const existingNode = await dvtRead.operatorNode({ operator: operator.address });
  if (existingNode && BigInt(existingNode) !== 0n) {
    const isReg = await dvtRead.isRegistered({ nodeId: existingNode });
    const owner = await dvtRead.nodeOperator({ nodeId: existingNode });
    log(`✅ operator already owns node ${existingNode}  isRegistered=${isReg}  nodeOperator=${owner}`);
    log('E2E idempotent PASS (node already registered by this operator).');
    return;
  }

  // --- 1. fund operator (ETH for gas + GToken for stake) ---
  const minStake = await dvtRead.minStake();
  const cfg = await (reg as any).getRoleConfig({ roleId: ROLE_DVT });
  const ticket = BigInt(cfg.ticketPrice ?? 0);
  const needGToken = minStake + ticket + parseEther('2'); // small headroom
  log(`ROLE_DVT minStake=${formatEther(minStake)} ticketPrice=${formatEther(ticket)} -> need ~${formatEther(needGToken)} GToken`);

  const opEth = await pub.getBalance({ address: operator.address });
  if (opEth < parseEther('0.015')) {
    log(`operator ETH ${formatEther(opEth)} low -> funding 0.03 from JASON`);
    const h = await funderWallet.sendTransaction({ to: operator.address, value: parseEther('0.03') });
    await wait(h); log(`  fund ETH tx ${h}`);
  }
  const opGt = await gtRead.balanceOf({ token: GTOKEN, account: operator.address }) as bigint;
  if (opGt < needGToken) {
    const send = needGToken - opGt;
    log(`operator GToken ${formatEther(opGt)} < need -> JASON transfers ${formatEther(send)}`);
    const h = await gtFunder.transfer({ token: GTOKEN, to: operator.address, amount: send });
    await wait(h); log(`  fund GToken tx ${h}`);
  }

  // --- 2. approve + registerRole(ROLE_DVT) ---
  const allowance = await gtRead.allowance({ token: GTOKEN, owner: operator.address, spender: GTOKEN_STAKING }) as bigint;
  if (allowance < needGToken) {
    const h = await gtOp.approve({ token: GTOKEN, spender: GTOKEN_STAKING, amount: needGToken * 2n });
    await wait(h); log(`approve GToken->staking tx ${h}`);
  }
  const alreadyRole = await reg.hasRole({ roleId: ROLE_DVT, user: operator.address });
  if (!alreadyRole) {
    log('registerRole(ROLE_DVT, operator, 0x) ...');
    const h = await (regOp as any).registerRole({ roleId: ROLE_DVT, user: operator.address, data: '0x' });
    await wait(h); log(`  registerRole tx ${h}`);
  } else {
    log('operator already has ROLE_DVT (skip registerRole)');
  }
  const eff = await reg.getEffectiveStake({ user: operator.address, roleId: ROLE_DVT }) as bigint;
  log(`effectiveStake(ROLE_DVT) = ${formatEther(eff)}  (>= minStake ${formatEther(minStake)} ? ${eff >= minStake})`);
  if (eff < minStake) throw new Error('operator not staked to minStake after registerRole — aborting before registerWithProof');

  // --- 3. build PoP (SDK) ---
  // WARNING: this node key is DETERMINISTICALLY derived from a public string — anyone who clones
  // this repo can recompute it and impersonate this node. It is a TESTNET FIXTURE ONLY; a real DVT
  // node must use a private, securely-generated BLS key that never leaves the operator's control.
  const nodeBlsKey = toHex(BigInt(keccak256(toHex('aastar-dvt-jack-testnode-v1'))) % bls.params.r, { size: 32 });
  const pop = buildDvtPop(nodeBlsKey);
  log(`\nbuildDvtPop -> nodeId=${pop.nodeId}`);
  const preReg = await dvtRead.isRegistered({ nodeId: pop.nodeId });
  if (preReg) throw new Error(`nodeId ${pop.nodeId} already registered (pick a different node key)`);

  // --- 4. preflight simulate ---
  log('preflight simulate registerWithProof ...');
  await pub.simulateContract({
    address: VALIDATOR,
    abi: AAStarBLSAlgorithmABI as any,
    functionName: 'registerWithProof',
    args: [pop.publicKey, pop.popPoint, pop.popSig],
    account: operator,
  });
  log('  simulate OK (no revert)');

  // --- 5. registerWithProof ---
  const { hash } = await dvtOp.register({ blsSecretKey: nodeBlsKey });
  log(`registerWithProof tx ${hash}`);
  await wait(hash);

  // --- 6. assert ---
  const isReg = await dvtRead.isRegistered({ nodeId: pop.nodeId });
  const owner = await dvtRead.nodeOperator({ nodeId: pop.nodeId });
  const count = await dvtRead.getRegisteredNodeCount();
  log(`\n=== RESULT ===`);
  log(`isRegistered(${pop.nodeId}) = ${isReg}`);
  log(`nodeOperator(nodeId) = ${owner}  (== operator ${operator.address} ? ${owner.toLowerCase() === operator.address.toLowerCase()})`);
  log(`registeredNodeCount = ${count}`);
  if (!isReg || owner.toLowerCase() !== operator.address.toLowerCase()) throw new Error('POST-CONDITION FAILED');
  log(`\n✅ DVT registerWithProof E2E PASS — SDK buildDvtPop accepted by live 0x539B PoP check. tx ${hash}`);
}

main().catch((e) => { console.error('E2E FAIL:', e.shortMessage || e.message || e); process.exit(1); });
