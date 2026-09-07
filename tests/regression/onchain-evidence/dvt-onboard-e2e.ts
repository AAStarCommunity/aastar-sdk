/**
 * DVT one-click onboarding E2E (CC-36) — the on-chain acceptance gate for the `@aastar/operator`
 * {@link onboardDvtNode} L2 workflow. Nothing is mocked; both paths run against the LIVE Sepolia DVT
 * validator (`AAStarBLSAlgorithm` = CANONICAL_ADDRESSES[11155111].aaStarBLSAlgorithm). The address is
 * deliberately NOT written here: it moved (v0.31.0 `0x1A8Db639…` -> v0.33.0 `0x7ac7E9d4…`) while this
 * header still said `0x539B9681…`, and the PASS line below still printed `0x539B` — on runs that had
 * in fact registered on the canonical committee validator. A wrong DVT validator does not revert
 * (the superseded one still has code and still answers `isRegistered=true`), so a stale literal in a
 * header or a success message is not a cosmetic error: it is the only thing a reader has, and it lied.
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
 *   PATH B TEARDOWN — PATH B is NOT idempotent by construction (a fresh operator + a fresh key each
 *     run), so without a teardown **every run permanently enlarges the canonical committee**, and a
 *     larger committee raises `requiredQuorum` (measured stable-state: N=3→Q=2, N=4→Q=3, N=5→Q=4).
 *     Only three public DVT nodes can actually co-sign, so at N=5 the committee-framed runners
 *     fail-closed at `only 3 committee signer(s) collected, validator requires 4` — **the suite broke
 *     the environment it is testing** (FU-85). Measured on the canonical validator
 *     `0x7ac7E9d4…` @ block 11651477: five live non-bootstrap nodes, slots 0/1/2 registered at blocks
 *     11604055/56/58 (the real dvt1/2/3) and slots 3/4 at 11641206 / 11644624 left behind by earlier
 *     e2e runs.
 *
 *     The teardown is the operator's OWN exit, not a privileged eviction:
 *       1. the fresh operator calls `BLSAggregator.requestGuardianExit()` — files a ROLE_DVT exit
 *          notice. Its quorum guard `_requireCommitteeSurvivesExit` early-returns for this operator
 *          because it holds no ACTIVE BLS key on the AGGREGATOR (measured: `getBLSPublicKey(op).isActive
 *          == false` for all five nodes — the aggregator's slot set and the committee validator's
 *          active set are two different sets).
 *       2. anyone calls `AAStarCommitteeValidator.syncExitNotice(nodeId)` → `_deactivate` →
 *          `activeCount -= 1`, immediately. This exists precisely so an in-flight exit does not
 *          deadlock `snapshotEpoch`; it does NOT wait out the 2-day notice.
 *
 *     `unenroll()` is NOT this. It clears `enrolledAccount[msg.sender]` — an ACCOUNT-level flag — and
 *     never touches `activeCount`. Reaching for it by name is the trap this teardown was written after.
 *
 *     The teardown runs in a `finally`, because a run that registers and then fails an assertion is
 *     exactly how slots 3 and 4 got stranded. It asserts its own effect (`activeCount` fell by one and
 *     `isRegistered` went false): a cleanup that silently no-ops is how this defect is reintroduced.
 *
 *     ON-CHAIN ACCEPTANCE (Sepolia, 2026-09-07). This run planted node
 *     `0x70146b43cb8482576f0cc2fce83c93edb3d0899c6117bb80b82f3cd5dbbf4f58` (operator
 *     `0xF36C9317…`) and then returned its slot:
 *       requestGuardianExit  0xe4737f3924f5488e1d037532dbae71b1f0efc91fa6544f92799e112402c82d38
 *       syncExitNotice       0xaad53b17a7a3d59ab0d171c7126a7d2341c82d54741c0f1ea04420d130425524
 *       activeCount 5 -> 4, isRegistered false
 *     The two nodes already stranded before this fix were dealt with separately: slot 4's operator key
 *     is unrecoverable, so the validator owner revoked it —
 *     `revokePublicKey` 0xfa2bfb504f72916d0b240dd156e28fcad53a3e84e9e50c06837f3d5b5a07ff00 (block
 *     11651779, activeCount 5 -> 4). Slot 3 is JACK's node and PATH A's short-circuit depends on it,
 *     so it stays.
 *
 *     WHAT THAT BOUGHT, measured rather than predicted: with activeCount=4 the keeper pins
 *     `epochSetCount=4` and `requiredQuorum=3`, and exactly three public DVT nodes can co-sign, so the
 *     committee-framed runners went from fail-closed to green — `tier3-composite-e2e`
 *     (validateUserOp==0), `tier3-committee-handleops` (handleOps
 *     0x20675b82aa5a552a2d06c5d399beff9933ea2657520fba3150d37203a4dd43c5, UserOpEvent success=true) and
 *     `cc103-committee-positive-e2e`. Before this, the committee-framed ACCEPT path was asserted by
 *     nothing that could actually run.
 *
 *     One reading that will mislead a reader who samples it at the wrong moment: `requiredQuorum`
 *     returns `type(uint256).max` (the UNAVAILABLE sentinel) for the part of every epoch between the
 *     rollover and the keeper's `snapshotEpoch`. At epochLength=64 that window is short but real — it
 *     is NOT "the committee is broken", and a single sample cannot tell the two apart. Read
 *     `epochPinned(currentEpoch())` alongside it.
 *
 *   pnpm exec tsx tests/regression/onchain-evidence/dvt-onboard-e2e.ts
 *
 * Requires .env.sepolia: SEPOLIA_RPC_URL, PRIVATE_KEY_JASON (funder + GToken holder), PRIVATE_KEY_JACK.
 * PATH B locks ~33 GToken into a throwaway operator each run; the stake stays locked with the exited
 * operator — the teardown reclaims the COMMITTEE SLOT, not the GToken.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import {
  createPublicClient, createWalletClient, http, formatEther, keccak256, toHex, type Address, type Hex,
  type PublicClient, type WalletClient, type Transport, type Chain, type Account,
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

  const validator = c.aaStarBLSAlgorithm as Address;
  log(`validator = ${validator}`);
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

  // Captured the moment registration is known to have happened, so the `finally` below can tell
  // "nothing was planted" apart from "planted, then an assertion threw". Only the second case has
  // something to clean up, and it is the case that stranded slots 3 and 4.
  const plantedNodeId: Hex | undefined = b.registered ? (b.nodeId as Hex) : undefined;
  try {

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
  } finally {
    if (plantedNodeId) await teardownFreshNode(publicClient, freshOpWallet, funderWallet, plantedNodeId, validator, c);
  }
  // The validator is interpolated, never spelled out: the previous literal `0x539B` outlived two
  // canonical bumps and was still being printed on runs that used a different contract entirely.
  log(`\n✅✅ CC-36 E2E PASS — onboardDvtNode proven on live Sepolia ${validator} (idempotent + full 代付 flow).`);
}

/**
 * Return the committee slot this run took. See the PATH B TEARDOWN note in the header for why this
 * exists and why `unenroll()` is not it.
 *
 * Every failure here is LOUD. A teardown that swallows its own error leaves exactly the state this
 * function was written to prevent, and the next reader sees a green run over a committee that grew.
 */
async function teardownFreshNode(
  // Every client parameter is typed, deliberately: pr-daemon mutation-tested #408's gate against
  // this function and found it BLIND here — a nonexistent method on an `any` client stayed green
  // while a real bug (`before - 1` vs `before - 1n`) went red. Four `any` parameters hid the whole
  // interaction surface of the one path with no unit-test coverage.
  //
  // The first fix typed only `publicClient`, and the comment that shipped with it claimed the reads
  // "and writes" were back under the gate. **The writes were not** — pr-daemon measured it: a
  // nonexistent method on either `any` wallet stayed green, and those two calls
  // (`requestGuardianExit` / `syncExitNotice`) are the only places this runner leaves a permanent
  // on-chain effect. A claim about a check, introduced by the very commit that was about false
  // claims about checks, and verified by nobody.
  //
  // `WalletClient` bare costs 5 new diagnostics (`writeContract` needs the account/chain narrowing);
  // `WalletClient<Transport, Chain, Account>` costs zero. Measured, all three now red under mutation:
  //   publicClient.readContract    → wrong method   TS2551 🔴
  //   funderWallet.writeContract   → wrong method   TS2551 🔴
  //   operatorWallet.writeContract → wrong method   TS2551 🔴
  publicClient: PublicClient,
  operatorWallet: WalletClient<Transport, Chain, Account>,
  funderWallet: WalletClient<Transport, Chain, Account>,
  nodeId: Hex,
  validator: Address,
  c: any,
): Promise<void> {
  const { AAStarCommitteeValidatorABI, BLSAggregatorABI } = await import('@aastar/core');
  const aggregator = c.blsAggregator as Address;
  const operator = operatorWallet.account.address as Address;
  log(`\n=== PATH B TEARDOWN — returning the committee slot ===`);

  const readCount = () =>
    publicClient.readContract({ address: validator, abi: AAStarCommitteeValidatorABI, functionName: 'activeCount' }) as Promise<bigint>;
  const before = await readCount();

  // The aggregator this validator actually binds to. `syncExitNotice` requires
  // `blsAggregator() == registry's aggregator`, so a canonical drift must fail here with a readable
  // message rather than as a bare revert inside the exit call.
  const bound = (await publicClient.readContract({
    address: validator, abi: AAStarCommitteeValidatorABI, functionName: 'blsAggregator',
  })) as Address;
  if (bound.toLowerCase() !== aggregator.toLowerCase()) {
    throw new Error(
      `TEARDOWN FAIL: validator.blsAggregator()=${bound} != CANONICAL blsAggregator=${aggregator}. ` +
        `Fix the canonical address before running this suite — otherwise every run strands a node.`,
    );
  }

  // The operator pays for its own exit; top it up rather than assume the onboarding left change.
  const bal = (await publicClient.getBalance({ address: operator })) as bigint;
  if (bal < 2_000_000_000_000_000n) {
    const topUp = await funderWallet.sendTransaction({ to: operator, value: 3_000_000_000_000_000n });
    await publicClient.waitForTransactionReceipt({ hash: topUp });
    log(`  topped the exiting operator up for gas: ${topUp}`);
  }

  const exitTx = await operatorWallet.writeContract({
    address: aggregator, abi: BLSAggregatorABI, functionName: 'requestGuardianExit', args: [],
  });
  await publicClient.waitForTransactionReceipt({ hash: exitTx });
  log(`  requestGuardianExit  ${exitTx}`);

  // Read the notice back rather than trusting the receipt: `syncExitNotice` reverts "No exit notice
  // filed" on readyAt==0, and that revert would be the FIRST place anyone learns the exit did not take.
  const [readyAt] = (await publicClient.readContract({
    address: aggregator, abi: BLSAggregatorABI, functionName: 'guardianExitRequests', args: [operator],
  })) as [bigint, bigint];
  if (readyAt === 0n) throw new Error('TEARDOWN FAIL: requestGuardianExit mined but guardianExitRequests.readyAt is still 0');

  const syncTx = await funderWallet.writeContract({
    address: validator, abi: AAStarCommitteeValidatorABI, functionName: 'syncExitNotice', args: [nodeId],
  });
  await publicClient.waitForTransactionReceipt({ hash: syncTx });
  log(`  syncExitNotice       ${syncTx}`);

  // The whole point, asserted. `activeCount` is the quantity that broke the other runners, so it is
  // the quantity checked here — not "the tx did not revert", which is true of a no-op too.
  const after = await readCount();
  const stillRegistered = (await publicClient.readContract({
    address: validator, abi: AAStarCommitteeValidatorABI, functionName: 'isRegistered', args: [nodeId],
  })) as boolean;
  log(`  activeCount ${before} -> ${after}   isRegistered(${nodeId.slice(0, 10)}…)=${stillRegistered}`);
  if (stillRegistered) throw new Error(`TEARDOWN FAIL: node ${nodeId} is still registered after syncExitNotice`);
  if (after !== before - 1n) throw new Error(`TEARDOWN FAIL: activeCount ${before} -> ${after}, expected ${before - 1n}`);
  log(`  ✅ committee slot returned — activeCount back to ${after}`);
}

main().catch((e) => { console.error('E2E FAIL:', e?.shortMessage || e?.message || e); process.exit(1); });
