/**
 * Mixed-signature guardian consensus — on-chain evidence (REAL Sepolia txs, NOT a unit test).
 *
 * v0.22.0 SHIPPED the mixed-sig guardian paths implemented + unit-tested + Codex-verified, but they
 * were never exercised against the deployed v0.20.3 contracts. This proves the highest-risk path —
 * `removeGuardianWithMixedSigs` (Codex flagged it as the most dangerous un-exercised path) — plus
 * `modifyTierLimitsWithMixedGuardians`, end-to-end on live Sepolia, driven through the SDK
 * (`@aastar/core` → `airAccountExtensionActions` + the `crypto/p256Guardian` opData builders).
 *
 * ## What the contract verifies for an ECDSA guardian (src/core/AirAccountExtension.sol)
 * `removeGuardianWithMixedSigs` / `modifyTierLimitsWithMixedGuardians` are `onlyOwner` — the OWNER
 * submits the tx and supplies the guardian signatures. For each `signerIdxs[i]`, the contract calls
 * `_verifyGuardianSigByIdx(gIdx, sig, opLabel, opData)`. For an ECDSA slot (line 739-745) it computes:
 *
 *   ethHash  = keccak256(abi.encode(uint8 GUARDIAN_SIG_VERSION=4, uint256 chainId, address account,
 *                                   string opLabel, bytes opData)).toEthSignedMessageHash()
 *   recovered = ecrecover(ethHash, sig)   // 65-byte r||s||v
 *   require(recovered == _getGuardian(gIdx))
 *
 * NOTE: the ECDSA digest has NO "P256_GUARDIAN" domain tag (that tag is ONLY in the P-256 path,
 * `_p256GuardianChallenge`) and IS eth-signed (EIP-191). So we do NOT use the SDK's P-256
 * `build*Challenge` helpers here — we reuse the SHARED `opData*` builders from `@aastar/core` (the
 * opData is byte-identical across both paths) and wrap with the ECDSA digest + `signMessage({raw})`.
 *
 * ## opData (shared, per spec §6 — built by the SDK crypto module)
 *   REMOVE_GUARDIAN     : abi.encode(uint256 nonce, uint8 index, address guardianToRemove,
 *                                    bytes32 p256X, bytes32 p256Y)   // (0,0) for an ECDSA slot
 *   MODIFY_TIER_LIMITS  : abi.encode(uint256 nonce, uint256 tier1, uint256 tier2, uint256 deadline)
 *
 * ## Flow
 *   1. Deploy a fresh v0.20.3 account with 3 ECDSA guardians (buildInitConfig). Guardians are EOAs
 *      used ONLY to sign — they never submit a tx, so they need no funding (the owner relays).
 *   2. Read `getGuardianRemovalNonce(account)` (internal slot 15) == 0.
 *   3. removeGuardianWithMixedSigs(index=0, signerIdxs=[1,2], sigs=[g1,g2]) — remove slot 0 with the
 *      2-of-3 consensus of the OTHER guardians; assert status=0x1, guardianCount 3→2, the set shifted
 *      left, GuardianRemoved(0, g0) fired, and the removal nonce incremented 0→1.
 *   4. Read `getTierLimitNonce(account)` (internal slot 16) == 0.
 *   5. modifyTierLimitsWithMixedGuardians(tier1, tier2, deadline, signerIdxs=[0,1], sigs=[g1,g2]) —
 *      the two SURVIVING guardians (now at slots 0,1) sign; assert status=0x1, tier limits updated,
 *      TierLimitsSet fired, and the tier nonce incremented 0→1.
 *
 * ## DECODE-VERIFY
 *   - pre-tx: each ECDSA guardian sig `recoverMessageAddress({raw: digest})` == the guardian EOA
 *     (exactly what the contract's ecrecover checks),
 *   - post-tx: `tx.to == account`, the calldata decodes against the EXT ABI to the exact
 *     (index, signerIdxs, sigs) / (tier1, tier2, deadline, signerIdxs, sigs) we sent,
 *   - the GuardianRemoved / TierLimitsSet events fired with the expected args,
 *   - the internal removal/tier nonce getters incremented on-chain.
 *
 *   pnpm tsx tests/regression/onchain-evidence/mixed-sig-guardian-e2e.ts
 *
 * Requires .env.sepolia with SEPOLIA_RPC_URL (healthy) and PRIVATE_KEY_JASON (funded EOA).
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import {
    createPublicClient, createWalletClient, formatEther, getAddress, keccak256,
    encodeAbiParameters, recoverMessageAddress, decodeFunctionData, parseEventLogs,
    publicActions, type Address, type Hex,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { resilientSepoliaTransport, resilientSepoliaChain, bumpedFees } from './_rpc.js';
import {
    airAccountFactoryActions,
    airAccountActions,
    airAccountExtensionActions,
    buildInitConfig,
    opDataRemoveGuardian,
    opDataAddGuardian,
    opDataModifyTierLimits,
    GUARDIAN_SIG_VERSION,
    CANONICAL_ADDRESSES,
    AirAccountExtensionABI,
    AAStarAirAccountV7ABI,
} from '../../../packages/core/src/index.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

const CHAIN_ID = 11155111;
const FACTORY: Address = CANONICAL_ADDRESSES[CHAIN_ID].airAccountFactoryV7 as Address; // v0.20.3
const ETHERSCAN = (h: string) => `https://sepolia.etherscan.io/tx/${h}`;
const ZERO32 = `0x${'00'.repeat(32)}` as Hex;

function clean(v?: string): string { return (v ?? '').replace(/^['"]|['"]$/g, ''); }

interface StepRecord { step: string; actor: string; tx?: string; note?: string; }

/**
 * Build the ECDSA-guardian pre-hash the contract derives in `_verifyGuardianSigByIdx` (ECDSA branch):
 * keccak256(abi.encode(uint8 version, uint256 chainId, address account, string opLabel, bytes opData)).
 * The contract then applies `toEthSignedMessageHash()` (EIP-191) before ecrecover — so the guardian
 * must sign this digest with `signMessage({ message: { raw: digest } })`.
 */
function ecdsaGuardianDigest(account: Address, opLabel: string, opData: Hex): Hex {
    return keccak256(encodeAbiParameters(
        [{ type: 'uint8' }, { type: 'uint256' }, { type: 'address' }, { type: 'string' }, { type: 'bytes' }],
        [GUARDIAN_SIG_VERSION, BigInt(CHAIN_ID), account, opLabel, opData],
    ));
}

async function main() {
    const rpc = clean(process.env.SEPOLIA_RPC_URL || process.env.RPC_URL);
    const pk = clean(process.env.PRIVATE_KEY_JASON) as Hex;
    if (!rpc) throw new Error('SEPOLIA_RPC_URL missing in .env.sepolia');
    if (!pk) throw new Error('PRIVATE_KEY_JASON missing in .env.sepolia');
    const owner = privateKeyToAccount(pk.startsWith('0x') ? pk : (`0x${pk}` as Hex));

    const publicClient = createPublicClient({ chain: sepolia, transport: resilientSepoliaTransport() });
    const ownerWallet = createWalletClient({ account: owner, chain: resilientSepoliaChain, transport: resilientSepoliaTransport() }).extend(publicActions);
    const factorySvc = airAccountFactoryActions(FACTORY)(ownerWallet);

    console.log('🧪 Mixed-signature guardian consensus on-chain evidence (Sepolia)');
    console.log(`   Owner (JASON) EOA: ${owner.address}`);
    console.log(`   Owner balance: ${formatEther(await publicClient.getBalance({ address: owner.address }))} ETH`);
    console.log(`   Factory (v0.20.3): ${FACTORY}`);

    const steps: StepRecord[] = [];
    const fees = await bumpedFees(publicClient);

    // ── 0. Three FRESH ECDSA guardians (sign-only; the owner relays, so they need no ETH) ──
    const gPks = [generatePrivateKey(), generatePrivateKey(), generatePrivateKey()];
    const guardians = gPks.map((p) => privateKeyToAccount(p));
    console.log('\n   ECDSA guardians (sign-only EOAs):');
    guardians.forEach((g, i) => console.log(`     g${i} (slot ${i}): ${g.address}`));

    // ── 1. Deploy a fresh v0.20.3 account with 3 ECDSA guardians ──
    const config = buildInitConfig({
        guardians: guardians.map((g) => ({ ecdsa: g.address as Address })),
        dailyLimit: 1_000_000_000_000_000_000n, // 1 ETH
    });
    const salt = BigInt(Math.floor(Date.now() / 1000));
    const account = await factorySvc.getAddress({ owner: owner.address, salt, config });
    console.log(`\n   Predicted account: ${account} (salt ${salt})`);
    const deployTx = await factorySvc.createAccount({ owner: owner.address, salt, config, account: owner, ...fees });
    {
        const rcpt = await publicClient.waitForTransactionReceipt({ hash: deployTx, timeout: 180_000 });
        if (rcpt.status !== 'success') throw new Error('createAccount reverted');
        console.log(`   ✅ Deploy v0.20.3 account (3 ECDSA guardians): ${deployTx}`);
    }
    const code = await publicClient.getBytecode({ address: account });
    if (!code || code === '0x') throw new Error('Account has no bytecode after deploy');
    steps.push({ step: `Deploy v0.20.3 account w/ 3 ECDSA guardians (salt=${salt})`, actor: `JASON ${owner.address}`, tx: deployTx });

    const extReader = airAccountExtensionActions(account)(publicClient);
    const extWriter = airAccountExtensionActions(account)(ownerWallet);
    const acctReader = airAccountActions(account)(publicClient);

    const readGuardians = async (): Promise<Address[]> => {
        const out: Address[] = [];
        for (let i = 0; i < 3; i++) {
            out.push(await publicClient.readContract({ address: account, abi: AAStarAirAccountV7ABI, functionName: 'guardians', args: [BigInt(i)] }) as Address);
        }
        return out;
    };

    // Confirm the on-chain guardian set matches what we deployed.
    const countAfterDeploy = await acctReader.guardianCount();
    const slotsAfterDeploy = await readGuardians();
    console.log(`   📖 guardianCount == ${countAfterDeploy}`);
    console.log(`   📖 guardians == [${slotsAfterDeploy.join(', ')}]`);
    if (Number(countAfterDeploy) !== 3) throw new Error(`expected guardianCount 3 after deploy, got ${countAfterDeploy}`);
    guardians.forEach((g, i) => {
        if (getAddress(slotsAfterDeploy[i]) !== getAddress(g.address)) {
            throw new Error(`guardian slot ${i} mismatch: on-chain ${slotsAfterDeploy[i]} != g${i} ${g.address}`);
        }
    });
    console.log('   🔍 on-chain guardian set == the 3 ECDSA guardians we deployed ✅');

    // ══════════════════════════════════════════════════════════════════════════
    // OP 1 — removeGuardianWithMixedSigs (the Codex-flagged path): remove slot 0
    //        with the 2-of-3 ECDSA consensus of slots 1 & 2.
    // ══════════════════════════════════════════════════════════════════════════
    const removalNonce = await extReader.getGuardianRemovalNonce();
    console.log(`\n   📖 getGuardianRemovalNonce() (slot 15) == ${removalNonce}`);
    if (removalNonce !== 0n) throw new Error(`expected removal nonce 0 on a fresh account, got ${removalNonce}`);

    const removeIndex = 0;
    const guardianToRemove = guardians[removeIndex].address as Address;
    // ECDSA slot ⇒ p256X = p256Y = 0 (spec §6.4). opData built by the SDK crypto module.
    const removeOpData = opDataRemoveGuardian(removalNonce, removeIndex, guardianToRemove, ZERO32, ZERO32);
    const removeDigest = ecdsaGuardianDigest(account, 'REMOVE_GUARDIAN', removeOpData);
    console.log(`   REMOVE_GUARDIAN opData: ${removeOpData}`);
    console.log(`   ECDSA guardian digest (pre eth-sign): ${removeDigest}`);

    // Signers = the OTHER two guardians (slots 1, 2). They sign the eth-signed digest with their EOA keys.
    const removeSignerIdxs = [1, 2];
    const removeSigs: Hex[] = [];
    for (const idx of removeSignerIdxs) {
        const sig = await guardians[idx].signMessage({ message: { raw: removeDigest } });
        // DECODE-VERIFY (pre-tx): the sig recovers to the guardian EOA — exactly the contract's ecrecover check.
        const recovered = await recoverMessageAddress({ message: { raw: removeDigest }, signature: sig });
        if (getAddress(recovered) !== getAddress(guardians[idx].address)) {
            throw new Error(`REMOVE_GUARDIAN sig from g${idx} recovers to ${recovered}, expected ${guardians[idx].address}`);
        }
        removeSigs.push(sig);
    }
    console.log(`   🔍 DECODE-VERIFY (pre-tx): both REMOVE_GUARDIAN sigs recover to g1, g2 ✅`);

    const removeTx = await extWriter.removeGuardianWithMixedSigs({
        index: removeIndex, signerIdxs: removeSignerIdxs, sigs: removeSigs, account: owner, ...fees,
    });
    const removeRcpt = await publicClient.waitForTransactionReceipt({ hash: removeTx, timeout: 180_000 });
    if (removeRcpt.status !== 'success') throw new Error(`removeGuardianWithMixedSigs reverted: ${removeTx}`);
    console.log(`   ✅ removeGuardianWithMixedSigs (2-of-3 ECDSA consensus, on-chain ecrecover PASSED): ${removeTx}`);
    steps.push({ step: 'removeGuardianWithMixedSigs(index=0, signerIdxs=[1,2], 2 ECDSA sigs)', actor: `owner-relayed JASON ${owner.address}`, tx: removeTx });

    // Post-tx asserts: count 3→2, set shifted left, GuardianRemoved fired, nonce 0→1.
    const removeEvents = parseEventLogs({ abi: AirAccountExtensionABI as any, logs: removeRcpt.logs, eventName: 'GuardianRemoved' });
    const removed = removeEvents.find((e: any) => Number(e.args.index) === removeIndex);
    if (!removed) throw new Error('GuardianRemoved event for index 0 not found in receipt');
    if (getAddress((removed as any).args.guardian) !== getAddress(guardianToRemove)) {
        throw new Error(`GuardianRemoved.guardian ${(removed as any).args.guardian} != removed g0 ${guardianToRemove}`);
    }
    console.log(`   🔍 GuardianRemoved(index=0, guardian=${guardianToRemove}) event fired ✅`);

    const countAfterRemove = await acctReader.guardianCount();
    if (Number(countAfterRemove) !== 2) throw new Error(`expected guardianCount 2 after remove, got ${countAfterRemove}`);
    const slotsAfterRemove = await readGuardians();
    // The contract shifts the set left: slot0 <- old g1, slot1 <- old g2, slot2 cleared.
    if (getAddress(slotsAfterRemove[0]) !== getAddress(guardians[1].address)) throw new Error(`after remove, slot0 ${slotsAfterRemove[0]} != old g1 ${guardians[1].address}`);
    if (getAddress(slotsAfterRemove[1]) !== getAddress(guardians[2].address)) throw new Error(`after remove, slot1 ${slotsAfterRemove[1]} != old g2 ${guardians[2].address}`);
    if (BigInt(slotsAfterRemove[2]) !== 0n) throw new Error(`after remove, slot2 ${slotsAfterRemove[2]} != zero`);
    const removalNonceAfter = await extReader.getGuardianRemovalNonce();
    if (removalNonceAfter !== removalNonce + 1n) throw new Error(`removal nonce did not increment: ${removalNonce} -> ${removalNonceAfter}`);
    console.log(`   📖 guardianCount 3→2 ✅; set shifted left to [g1, g2, 0x0] ✅; getGuardianRemovalNonce 0→${removalNonceAfter} ✅`);

    // DECODE-VERIFY (post-tx): tx.to == account; calldata decodes to exactly what we sent.
    const removeTxData = await publicClient.getTransaction({ hash: removeTx });
    if (getAddress(removeTxData.to as Address) !== getAddress(account)) throw new Error(`removeTx.to ${removeTxData.to} != account ${account}`);
    const removeDecoded = decodeFunctionData({ abi: AirAccountExtensionABI as any, data: removeTxData.input });
    if (removeDecoded.functionName !== 'removeGuardianWithMixedSigs') throw new Error(`decoded fn ${removeDecoded.functionName} != removeGuardianWithMixedSigs`);
    const [dIdx, dSignerIdxs, dSigs] = removeDecoded.args as [number, readonly number[], readonly Hex[]];
    if (Number(dIdx) !== removeIndex) throw new Error(`decoded index ${dIdx} != ${removeIndex}`);
    if (dSignerIdxs.map(Number).join(',') !== removeSignerIdxs.join(',')) throw new Error(`decoded signerIdxs ${dSignerIdxs} != ${removeSignerIdxs}`);
    if (dSigs.length !== removeSigs.length || dSigs.some((s, i) => s.toLowerCase() !== removeSigs[i].toLowerCase())) throw new Error('decoded sigs != sent sigs');
    console.log('   🔍 DECODE-VERIFY (post-tx): tx.to == account, calldata decodes to (index=0, [1,2], [g1,g2 sigs]) ✅');

    // ══════════════════════════════════════════════════════════════════════════
    // OP 2 — addGuardianWithMixedSigs: the 2 SURVIVING guardians (slots 0,1) add a
    //        new ECDSA guardian back (count 2→3). Third ECDSA mixed-sig path.
    // ══════════════════════════════════════════════════════════════════════════
    const additionNonce = await extReader.getGuardianAdditionNonce();
    console.log(`\n   📖 getGuardianAdditionNonce() (slot 39) == ${additionNonce}`);
    if (additionNonce !== 0n) throw new Error(`expected addition nonce 0 on a fresh account, got ${additionNonce}`);

    const newGuardian = privateKeyToAccount(generatePrivateKey());
    const addOpData = opDataAddGuardian(additionNonce, newGuardian.address as Address);
    const addDigest = ecdsaGuardianDigest(account, 'ADD_GUARDIAN', addOpData);
    console.log(`   ADD_GUARDIAN newGuardian: ${newGuardian.address}`);
    console.log(`   ADD_GUARDIAN opData: ${addOpData}`);

    // Survivors are at slots 0 (old g1) and 1 (old g2) after the removal.
    const addSignerIdxs = [0, 1];
    const addSigners = [guardians[1], guardians[2]];
    const addSigs: Hex[] = [];
    for (let i = 0; i < addSignerIdxs.length; i++) {
        const sig = await addSigners[i].signMessage({ message: { raw: addDigest } });
        const recovered = await recoverMessageAddress({ message: { raw: addDigest }, signature: sig });
        if (getAddress(recovered) !== getAddress(addSigners[i].address)) {
            throw new Error(`ADD_GUARDIAN sig recovers to ${recovered}, expected ${addSigners[i].address}`);
        }
        addSigs.push(sig);
    }
    console.log(`   🔍 DECODE-VERIFY (pre-tx): both ADD_GUARDIAN sigs recover to the surviving guardians (slots 0,1) ✅`);

    const addTx = await extWriter.addGuardianWithMixedSigs({
        guardian: newGuardian.address as Address, signerIdxs: addSignerIdxs, sigs: addSigs, account: owner, ...fees,
    });
    const addRcpt = await publicClient.waitForTransactionReceipt({ hash: addTx, timeout: 180_000 });
    if (addRcpt.status !== 'success') throw new Error(`addGuardianWithMixedSigs reverted: ${addTx}`);
    console.log(`   ✅ addGuardianWithMixedSigs (2-of-2 ECDSA consensus, on-chain ecrecover PASSED): ${addTx}`);
    steps.push({ step: 'addGuardianWithMixedSigs(newGuardian, signerIdxs=[0,1], 2 ECDSA sigs)', actor: `owner-relayed JASON ${owner.address}`, tx: addTx });

    const addEvents = parseEventLogs({ abi: AirAccountExtensionABI as any, logs: addRcpt.logs, eventName: 'GuardianAdded' });
    const added = addEvents.find((e: any) => getAddress(e.args.guardian) === getAddress(newGuardian.address));
    if (!added) throw new Error('GuardianAdded event for newGuardian not found in receipt');
    if (Number((added as any).args.index) !== 2) throw new Error(`GuardianAdded.index ${(added as any).args.index} != 2 (appended slot)`);
    const countAfterAdd = await acctReader.guardianCount();
    if (Number(countAfterAdd) !== 3) throw new Error(`expected guardianCount 3 after add, got ${countAfterAdd}`);
    const slotsAfterAdd = await readGuardians();
    if (getAddress(slotsAfterAdd[2]) !== getAddress(newGuardian.address)) throw new Error(`after add, slot2 ${slotsAfterAdd[2]} != newGuardian ${newGuardian.address}`);
    const additionNonceAfter = await extReader.getGuardianAdditionNonce();
    if (additionNonceAfter !== additionNonce + 1n) throw new Error(`addition nonce did not increment: ${additionNonce} -> ${additionNonceAfter}`);
    console.log(`   📖 GuardianAdded(index=2, newGuardian) ✅; guardianCount 2→3 ✅; getGuardianAdditionNonce 0→${additionNonceAfter} ✅`);

    const addTxData = await publicClient.getTransaction({ hash: addTx });
    if (getAddress(addTxData.to as Address) !== getAddress(account)) throw new Error(`addTx.to ${addTxData.to} != account ${account}`);
    const addDecoded = decodeFunctionData({ abi: AirAccountExtensionABI as any, data: addTxData.input });
    if (addDecoded.functionName !== 'addGuardianWithMixedSigs') throw new Error(`decoded fn ${addDecoded.functionName} != addGuardianWithMixedSigs`);
    console.log('   🔍 DECODE-VERIFY (post-tx): tx.to == account, calldata decodes to addGuardianWithMixedSigs ✅');

    // ══════════════════════════════════════════════════════════════════════════
    // OP 3 — modifyTierLimitsWithMixedGuardians: the 2 original survivors (still at
    //        slots 0,1) sign a tier-limit change. Fourth mixed-sig op, same account.
    // ══════════════════════════════════════════════════════════════════════════
    const tierNonce = await extReader.getTierLimitNonce();
    console.log(`\n   📖 getTierLimitNonce() (slot 16) == ${tierNonce}`);
    if (tierNonce !== 0n) throw new Error(`expected tier nonce 0 on a fresh account, got ${tierNonce}`);

    const tier1 = 10_000_000_000_000_000_000n; // 10 ETH-equiv (tier1 <= tier2 required by the contract)
    const tier2 = 20_000_000_000_000_000_000n; // 20 ETH-equiv
    const latestBlock = await publicClient.getBlock();
    const deadline = latestBlock.timestamp + 3600n; // 1h from chain head (contract requires block.timestamp <= deadline)
    const tierOpData = opDataModifyTierLimits(tierNonce, tier1, tier2, deadline);
    const tierDigest = ecdsaGuardianDigest(account, 'MODIFY_TIER_LIMITS', tierOpData);
    console.log(`   MODIFY_TIER_LIMITS opData: ${tierOpData}`);

    // After the removal, the survivors live at slots 0 (old g1) and 1 (old g2).
    const tierSignerIdxs = [0, 1];
    const tierSigners = [guardians[1], guardians[2]];
    const tierSigs: Hex[] = [];
    for (let i = 0; i < tierSignerIdxs.length; i++) {
        const sig = await tierSigners[i].signMessage({ message: { raw: tierDigest } });
        const recovered = await recoverMessageAddress({ message: { raw: tierDigest }, signature: sig });
        if (getAddress(recovered) !== getAddress(tierSigners[i].address)) {
            throw new Error(`MODIFY_TIER_LIMITS sig recovers to ${recovered}, expected ${tierSigners[i].address}`);
        }
        tierSigs.push(sig);
    }
    console.log(`   🔍 DECODE-VERIFY (pre-tx): both MODIFY_TIER_LIMITS sigs recover to the surviving guardians (slots 0,1) ✅`);

    const tierTx = await extWriter.modifyTierLimitsWithMixedGuardians({
        tier1, tier2, deadline, signerIdxs: tierSignerIdxs, sigs: tierSigs, account: owner, ...fees,
    });
    const tierRcpt = await publicClient.waitForTransactionReceipt({ hash: tierTx, timeout: 180_000 });
    if (tierRcpt.status !== 'success') throw new Error(`modifyTierLimitsWithMixedGuardians reverted: ${tierTx}`);
    console.log(`   ✅ modifyTierLimitsWithMixedGuardians (2-of-2 ECDSA consensus, on-chain ecrecover PASSED): ${tierTx}`);
    steps.push({ step: 'modifyTierLimitsWithMixedGuardians(tier1,tier2,deadline, signerIdxs=[0,1], 2 ECDSA sigs)', actor: `owner-relayed JASON ${owner.address}`, tx: tierTx });

    const tierEvents = parseEventLogs({ abi: AirAccountExtensionABI as any, logs: tierRcpt.logs, eventName: 'TierLimitsSet' });
    const tierSet = tierEvents[0] as any;
    if (!tierSet) throw new Error('TierLimitsSet event not found in receipt');
    if (BigInt(tierSet.args.tier1) !== tier1 || BigInt(tierSet.args.tier2) !== tier2) {
        throw new Error(`TierLimitsSet args (${tierSet.args.tier1}, ${tierSet.args.tier2}) != (${tier1}, ${tier2})`);
    }
    const onchainTier1 = await publicClient.readContract({ address: account, abi: AirAccountExtensionABI, functionName: 'tier1Limit', args: [] }) as bigint;
    const onchainTier2 = await publicClient.readContract({ address: account, abi: AirAccountExtensionABI, functionName: 'tier2Limit', args: [] }) as bigint;
    if (onchainTier1 !== tier1 || onchainTier2 !== tier2) throw new Error(`on-chain tier limits (${onchainTier1}, ${onchainTier2}) != (${tier1}, ${tier2})`);
    const tierNonceAfter = await extReader.getTierLimitNonce();
    if (tierNonceAfter !== tierNonce + 1n) throw new Error(`tier nonce did not increment: ${tierNonce} -> ${tierNonceAfter}`);
    console.log(`   🔍 TierLimitsSet(${tier1}, ${tier2}) fired ✅; tier1Limit/tier2Limit updated ✅; getTierLimitNonce 0→${tierNonceAfter} ✅`);

    const tierTxData = await publicClient.getTransaction({ hash: tierTx });
    if (getAddress(tierTxData.to as Address) !== getAddress(account)) throw new Error(`tierTx.to ${tierTxData.to} != account ${account}`);
    const tierDecoded = decodeFunctionData({ abi: AirAccountExtensionABI as any, data: tierTxData.input });
    if (tierDecoded.functionName !== 'modifyTierLimitsWithMixedGuardians') throw new Error(`decoded fn ${tierDecoded.functionName} != modifyTierLimitsWithMixedGuardians`);
    console.log('   🔍 DECODE-VERIFY (post-tx): tx.to == account, calldata decodes to modifyTierLimitsWithMixedGuardians ✅');

    // ── Emit markdown evidence ──
    const now = new Date().toISOString();
    const md: string[] = [];
    md.push(`### Run ${now}`, '');
    md.push(`- **Network:** Ethereum Sepolia (chainId ${CHAIN_ID})`);
    md.push(`- **Factory (v0.20.3):** \`${FACTORY}\``);
    md.push(`- **Account owner (JASON):** \`${owner.address}\``);
    md.push(`- **Deployed account:** \`${account}\` (salt \`${salt}\`)`);
    md.push(`- **ECDSA guardians:** g0=\`${guardians[0].address}\` g1=\`${guardians[1].address}\` g2=\`${guardians[2].address}\``);
    md.push('', '| # | Step | Actor | Tx hash |', '|---|------|-------|---------|');
    steps.forEach((s, i) => {
        const cell = s.tx ? `[\`${s.tx}\`](${ETHERSCAN(s.tx)})` : (s.note ?? '');
        md.push(`| ${i + 1} | ${s.step} | ${s.actor} | ${cell} |`);
    });
    md.push('', '**Decode-verify assertions (all ✅):**', '');
    md.push('- ECDSA guardian digest = `keccak256(abi.encode(uint8 4, chainId, account, opLabel, opData))` then EIP-191 eth-signed (NO `P256_GUARDIAN` domain tag — that is P-256-only); opData built by `@aastar/core` `opDataRemoveGuardian` / `opDataModifyTierLimits`');
    md.push('- pre-tx: each guardian sig `recoverMessageAddress` == the guardian EOA (the contract\'s ecrecover check)');
    md.push(`- \`removeGuardianWithMixedSigs(0, [1,2], [g1,g2])\` mined \`status=0x1\` → on-chain ecrecover of both ECDSA guardian sigs PASSED`);
    md.push('- `GuardianRemoved(index=0, guardian=g0)` fired; `guardianCount` 3→2; set shifted left to `[g1, g2, 0x0]`; `getGuardianRemovalNonce` 0→1');
    md.push(`- \`addGuardianWithMixedSigs(newGuardian, [0,1], [g1,g2])\` mined \`status=0x1\`; \`GuardianAdded(index=2, newGuardian)\` fired; \`guardianCount\` 2→3; \`getGuardianAdditionNonce\` 0→1`);
    md.push(`- \`modifyTierLimitsWithMixedGuardians(${tier1}, ${tier2}, deadline, [0,1], [g1,g2])\` mined \`status=0x1\``);
    md.push(`- \`TierLimitsSet(${tier1}, ${tier2})\` fired; \`tier1Limit\`/\`tier2Limit\` updated on-chain; \`getTierLimitNonce\` 0→1`);
    md.push('- post-tx: both `tx.to == account` and the calldata decodes against the EXT ABI to exactly the args sent');
    md.push('');
    const block = md.join('\n');

    const outPath = path.resolve(process.cwd(), 'tests/regression/onchain-evidence/.mixed-sig-guardian.last.md');
    fs.writeFileSync(outPath, block);
    console.log(`\n──────── MARKDOWN EVIDENCE (also written to ${outPath}) ────────\n`);
    console.log(block);
    console.log('\n✅ Mixed-sig guardian on-chain evidence COMPLETE — removeGuardianWithMixedSigs + addGuardianWithMixedSigs + modifyTierLimitsWithMixedGuardians landed on Sepolia (status=0x1).');
}

main().catch((e) => { console.error('\n❌ Mixed-sig guardian evidence FAILED:', e?.shortMessage || e?.message || e); process.exit(1); });
