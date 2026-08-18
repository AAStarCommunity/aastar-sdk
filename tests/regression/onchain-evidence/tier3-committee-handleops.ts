/**
 * FU-18/FU-19 — COMMITTEE-framed cumulative Tier-3 (algId 0x05) through a REAL EntryPoint.handleOps.
 *
 * The companion `tier3-composite-e2e.ts` asserts `validateUserOp == 0` via eth_call. That proves the
 * account ACCEPTS the signature, but it is a simulation: no transaction, no gas, no bundler path, and
 * nothing proves the op actually EXECUTES. This runner closes that gap by submitting the same
 * committee-framed composite through `EntryPoint.handleOps` and decoding `UserOperationEvent`.
 *
 * Reuses the account `tier3-composite-e2e` already deployed, enrolled, and keyed (same salt), so this
 * proves the exact same account/config the eth_call evidence covers — not a fresh lookalike.
 *
 * Flow:
 *   1. Real v0.7 PackedUserOperation with REAL gas limits and callData = execute(owner, 0, 0x)
 *      (a benign 0-ETH self-call — the point is the signature path, not the payload).
 *   2. userOpHash from EntryPoint.getUserOpHash.
 *   3. P256 passkey signs userOpHash; DVT nodes co-sign; guardian EIP-191 signs.
 *   4. Read committeeActive() -> fetch slot + Merkle proof per signer -> pack 0x05 COMMITTEE framing.
 *   5. eth_call validateUserOp first: abort before spending gas on a doomed tx.
 *   6. Ensure the account's EntryPoint deposit covers the prefund (depositTo).
 *   7. EntryPoint.handleOps([userOp], JASON) — REAL TX. Assert UserOperationEvent(success=true).
 *
 * Run: AASTAR_DVT_ENV=testnet-local pnpm exec tsx tests/regression/onchain-evidence/tier3-committee-handleops.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { bls12_381 as noble } from '@noble/curves/bls12-381.js';
import { p256 } from '@noble/curves/nist.js';
import {
    createPublicClient, createWalletClient, http, concat, numberToHex, keccak256, toBytes,
    getAddress, encodeFunctionData, formatEther, decodeEventLog, type Address, type Hex, type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import {
    CANONICAL_ADDRESSES, DVT_CONFIG, getDvtConfig, EntryPointABI, AAStarAirAccountV7ABI,
    AAStarBLSAlgorithmABI, buildInitConfig, encodeG2Point, airAccountFactoryActions, entryPointActions,
    getCommitteeState, isAccountEnrolled, fetchCommitteeSigners, type CommitteeSigner,
} from '@aastar/core';
import { packCumulativeT3Signature, packOwnerAuthEcdsa } from '../../../packages/airaccount/src/migration/viem/bls-packing';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

const SEPOLIA = 11155111;
const C = CANONICAL_ADDRESSES[SEPOLIA];
const FACTORY = getAddress(C.airAccountFactoryV7);
const ENTRY_POINT = getAddress(C.entryPoint);
const VALIDATOR_ROUTER = getAddress(C.aaStarValidator);
const BLS_VERIFIER = getAddress(C.aaStarBLSAlgorithm);
const ALG_CUMULATIVE_T3 = 0x05;

const RPCS = [process.env.SEPOLIA_RPC_URL, process.env.SEPOLIA_RPC_URL2, process.env.SEPOLIA_RPC_URL3].filter(Boolean) as string[];
// SAME salt/keys as tier3-composite-e2e — this must be the account that eth_call evidence covers.
const SALT = BigInt(keccak256(toBytes('tier3-composite-e2e/#234/2026-06')));
const P256_PRIV = keccak256(toBytes('tier3-composite-e2e/p256/#234')).slice(2);
const GUARDIAN_PK = keccak256(toBytes('tier3-composite-e2e/guardian/#234')) as Hex;

const norm = (h: string): Hex => ((h.startsWith('0x') ? h : `0x${h}`).toLowerCase() as Hex);
const pack = (hi: bigint, lo: bigint): Hex => concat([numberToHex(hi, { size: 16 }), numberToHex(lo, { size: 16 })]);

async function rpc<T>(fn: (c: PublicClient) => Promise<T>): Promise<T> {
    let last: unknown;
    for (const url of RPCS) {
        try { return await fn(createPublicClient({ chain: sepolia, transport: http(url) }) as PublicClient); }
        catch (e) { last = e; }
    }
    throw last;
}

function eip2537ToG2(sig256: Hex) {
    const raw = sig256.slice(2);
    const slot = (i: number) => raw.slice(i * 128, i * 128 + 128);
    const coord = (h: string) => BigInt('0x' + h.slice(32));
    const Fp2 = noble.fields.Fp2;
    const pt = noble.G2.ProjectivePoint.fromAffine({
        x: Fp2.fromBigTuple([coord(slot(0)), coord(slot(1))]),
        y: Fp2.fromBigTuple([coord(slot(2)), coord(slot(3))]),
    });
    pt.assertValidity();
    return pt;
}

async function main() {
    console.log('═══ FU-18/FU-19 — COMMITTEE-framed 0x05 through REAL EntryPoint.handleOps ═══\n');
    if (RPCS.length === 0) throw new Error('No SEPOLIA_RPC_URL[/2/3] in .env.sepolia');

    let pk = process.env.PRIVATE_KEY_JASON;
    if (!pk) throw new Error('PRIVATE_KEY_JASON missing from .env.sepolia');
    if (!pk.startsWith('0x')) pk = `0x${pk}`;
    const owner = privateKeyToAccount(pk as Hex);
    const wallet = createWalletClient({ account: owner, chain: sepolia, transport: http(RPCS[0]) });
    const guardian = privateKeyToAccount(GUARDIAN_PK);
    const guardianWallet = createWalletClient({ account: guardian, chain: sepolia, transport: http(RPCS[0]) });

    // ── (0) the SAME account tier3-composite-e2e proved via eth_call ─────────────────────────────
    const config = buildInitConfig({
        guardians: [{ ecdsa: guardian.address }],
        dailyLimit: 10n ** 18n,
        approvedAlgIds: [ALG_CUMULATIVE_T3],
    });
    const account = (await rpc((c) => airAccountFactoryActions(FACTORY)(c).getAddress({ owner: owner.address, salt: SALT, config }))) as Address;
    const code = await rpc((c) => c.getCode({ address: account }));
    if (!code || code === '0x') throw new Error(`account ${account} not deployed — run tier3-composite-e2e.ts first`);
    console.log(`[0] account = ${account} (deployed)  owner=${owner.address}  guardian=${guardian.address}`);

    const st = await rpc((c) => getCommitteeState(c, BLS_VERIFIER));
    console.log(`     committeeActive=${st.active}  requiredQuorum=${st.requiredQuorum}  TREE_DEPTH=${st.treeDepth}`);
    if (!st.active) throw new Error('committeeActive() is false — this runner exists to prove the COMMITTEE path');
    if (!(await rpc((c) => isAccountEnrolled(c, BLS_VERIFIER, account)))) {
        throw new Error(`account ${account} not enrolled — run tier3-composite-e2e.ts first`);
    }

    // ── (1) REAL UserOp (real gas, benign callData) ──────────────────────────────────────────────
    const callData = encodeFunctionData({ abi: AAStarAirAccountV7ABI, functionName: 'execute', args: [owner.address, 0n, '0x'] });
    const verificationGasLimit = 900_000n; // committee framing verifies k Merkle proofs + a BLS pairing
    const callGasLimit = 120_000n;
    const preVerificationGas = 200_000n;   // 1954-byte signature ⇒ large calldata cost
    const maxPriority = 2_000_000_000n;
    const maxFee = 40_000_000_000n;
    const nonce = (await rpc((c) => entryPointActions(ENTRY_POINT)(c).getNonce({ sender: account, key: 0n }))) as bigint;
    const userOp = {
        sender: account, nonce, initCode: '0x' as Hex, callData,
        accountGasLimits: pack(verificationGasLimit, callGasLimit),
        preVerificationGas, gasFees: pack(maxPriority, maxFee),
        paymasterAndData: '0x' as Hex, signature: '0x' as Hex,
    };
    const userOpHash = (await rpc((c) => c.readContract({ address: ENTRY_POINT, abi: EntryPointABI, functionName: 'getUserOpHash', args: [userOp] }))) as Hex;
    console.log(`\n[1] userOpHash = ${userOpHash}`);

    // ── (2) P256 passkey over userOpHash (low-S, 64B r||s) ───────────────────────────────────────
    const res = p256.sign(userOpHash.slice(2) as `0x${string}`, P256_PRIV, { lowS: true }) as unknown as { r?: bigint; s?: bigint };
    const rs = typeof res.r === 'bigint' ? res : (p256.Signature as any).fromBytes(res as unknown as Uint8Array, 'compact');
    const p256Signature = concat([numberToHex(rs.r, { size: 32 }), numberToHex(rs.s, { size: 32 })]);

    // ── (3) DVT co-signatures ────────────────────────────────────────────────────────────────────
    const ownerSig65 = await wallet.signMessage({ account: owner, message: { raw: userOpHash } });
    const ownerAuth = packOwnerAuthEcdsa(ownerSig65);
    const userOpRpc = { ...userOp, nonce: numberToHex(userOp.nonce), preVerificationGas: numberToHex(userOp.preVerificationGas) };
    const dvtNodes = getDvtConfig().dvtNodes;
    console.log(`\n[3] DVT env=${process.env.AASTAR_DVT_ENV ?? DVT_CONFIG.active} -> ${dvtNodes.map((n) => n.url).join('  ')}`);
    const signed: { nodeId: Hex; signature: Hex }[] = [];
    const seenSig = new Set<string>();
    for (const { url, nodeId: pinned } of dvtNodes) {
        try {
            const r = await fetch(`${url}/signature/sign`, {
                method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ userOp: userOpRpc, ownerAuth }),
            });
            const raw = await r.text();
            const b = (() => { try { return JSON.parse(raw); } catch { return {} as any; } })();
            if (!r.ok || !b.nodeId || !b.signature) { console.warn(`     ! ${url} -> ${r.status} ${raw.slice(0, 120)}`); continue; }
            const id = norm(b.nodeId), sig = norm(b.signature);
            if (id !== norm(pinned)) { console.warn(`     ! ${url} reported ${id}, config pins ${norm(pinned)}`); continue; }
            // BLS is deterministic over (key, message): identical partials ⇒ ONE key behind two ids.
            if (seenSig.has(sig)) { console.warn(`     ! ${url} byte-identical partial — one key, two ids`); continue; }
            const reg = (await rpc((c) => c.readContract({ address: BLS_VERIFIER, abi: AAStarBLSAlgorithmABI, functionName: 'isRegistered', args: [id] }))) as boolean;
            if (!reg) { console.warn(`     ! ${url} nodeId not registered on the committee validator`); continue; }
            seenSig.add(sig); signed.push({ nodeId: id, signature: sig });
            console.log(`     ${url}  ${id.slice(0, 18)}…  registered`);
        } catch (e) { console.warn(`     ! ${url} ${(e as Error).message.slice(0, 70)}`); }
    }
    if (BigInt(signed.length) < st.requiredQuorum) throw new Error(`under quorum: ${signed.length} < ${st.requiredQuorum}`);
    const agg = signed.slice(1).reduce((a, s) => a.add(eip2537ToG2(s.signature)), eip2537ToG2(signed[0].signature));
    const blsSignature = encodeG2Point(`0x${agg.toHex(false)}` as Hex);
    const nodeIds = signed.map((s) => s.nodeId);

    // ── (4) committee slot + Merkle proofs, then pack 0x05 COMMITTEE framing ─────────────────────
    const { signers, lastSetMutationBlock, atBlock } = await rpc((c) => fetchCommitteeSigners(c, BLS_VERIFIER, nodeIds));
    if (lastSetMutationBlock > atBlock) throw new Error(`committee set mutated at ${lastSetMutationBlock} after proofs read at ${atBlock}`);
    const committeeSigners: CommitteeSigner[] = signers;
    const guardianSignature = await guardianWallet.signMessage({ account: guardian, message: { raw: userOpHash } });
    const signature = packCumulativeT3Signature({
        p256Signature, committeeSigners, treeDepth: st.treeDepth, blsSignature, guardianSignature,
    }) as Hex;
    const expectedLen = 1 + 64 + (32 + committeeSigners.length * (64 + st.treeDepth * 32) + 256) + 65;
    console.log(`\n[4] 0x05 COMMITTEE composite = ${(signature.length - 2) / 2} bytes (expect ${expectedLen}), ${committeeSigners.length} signers`);
    if ((signature.length - 2) / 2 !== expectedLen) throw new Error('composite length != committee framing');

    // ── (5) pre-flight: never spend gas on a doomed tx ───────────────────────────────────────────
    const signedUserOp = { ...userOp, signature };
    const pre = await rpc(async (c) => {
        const { result } = await c.simulateContract({
            address: account, abi: AAStarAirAccountV7ABI, functionName: 'validateUserOp',
            args: [signedUserOp, userOpHash, 0n], account: ENTRY_POINT,
        });
        return result as bigint;
    });
    console.log(`[5] pre-flight validateUserOp = ${pre}`);
    if (pre !== 0n) throw new Error(`BLOCKER: validateUserOp = ${pre} — aborting before wasting a reverted handleOps`);

    // ── (6) EntryPoint deposit must cover the prefund ────────────────────────────────────────────
    const required = (verificationGasLimit + callGasLimit + preVerificationGas) * maxFee;
    const dep = (await rpc((c) => c.readContract({ address: ENTRY_POINT, abi: EntryPointABI, functionName: 'balanceOf', args: [account] }))) as bigint;
    console.log(`[6] deposit ${formatEther(dep)} ETH, prefund needs ${formatEther(required)} ETH`);
    if (dep < required) {
        const topUp = required - dep + 10n ** 15n;
        const dtx = await wallet.writeContract({ address: ENTRY_POINT, abi: EntryPointABI, functionName: 'depositTo', args: [account], value: topUp });
        const dr = await rpc((c) => c.waitForTransactionReceipt({ hash: dtx }));
        console.log(`     depositTo(+${formatEther(topUp)} ETH) tx=${dtx} status=${dr.status}`);
    }

    // ── (7) THE REAL TRANSACTION ─────────────────────────────────────────────────────────────────
    console.log('\n[7] submitting EntryPoint.handleOps([userOp], JASON) …');
    const tx = await wallet.writeContract({
        address: ENTRY_POINT, abi: EntryPointABI, functionName: 'handleOps',
        args: [[signedUserOp], owner.address], maxFeePerGas: maxFee, maxPriorityFeePerGas: maxPriority,
    });
    console.log(`     handleOps tx = ${tx}`);
    const rcpt = await rpc((c) => c.waitForTransactionReceipt({ hash: tx }));
    console.log(`     mined: status=${rcpt.status} block=${rcpt.blockNumber} gasUsed=${rcpt.gasUsed}`);

    // Decode UserOperationEvent — a mined tx is NOT enough, the op itself must report success.
    let uoe = 'not found';
    let opSucceeded = false;
    for (const log of rcpt.logs) {
        if (log.address.toLowerCase() !== ENTRY_POINT.toLowerCase()) continue;
        try {
            const d = decodeEventLog({ abi: EntryPointABI, data: log.data, topics: log.topics }) as any;
            if (d.eventName === 'UserOperationEvent') {
                opSucceeded = d.args.success === true;
                uoe = `success=${d.args.success} actualGasUsed=${d.args.actualGasUsed} actualGasCost=${formatEther(d.args.actualGasCost)} ETH`;
            }
        } catch { /* not this event */ }
    }
    console.log(`     UserOperationEvent: ${uoe}`);

    console.log('\n┌─────────── EVIDENCE (committee 0x05 via handleOps) ───────────');
    console.log(`│ account      : ${account}`);
    console.log(`│ userOpHash   : ${userOpHash}`);
    console.log(`│ framing      : COMMITTEE, ${committeeSigners.length} signers, TREE_DEPTH=${st.treeDepth}, quorum=${st.requiredQuorum}`);
    console.log(`│ signature    : ${(signature.length - 2) / 2} bytes (algId 0x05)`);
    console.log(`│ nodeIds      : ${nodeIds.join(', ')}`);
    console.log(`│ handleOps tx : ${tx}`);
    console.log(`│ receipt      : status=${rcpt.status} block=${rcpt.blockNumber} gasUsed=${rcpt.gasUsed}`);
    console.log(`│ UserOpEvent  : ${uoe}`);
    console.log(`│ explorer     : https://sepolia.etherscan.io/tx/${tx}`);
    console.log('└───────────────────────────────────────────────────────────────');

    if (rcpt.status !== 'success') throw new Error('handleOps tx reverted');
    if (!opSucceeded) throw new Error('UserOperationEvent.success == false — the op was included but did not execute');
    console.log('\n🎉 PASS — COMMITTEE-framed 0x05 EXECUTED on-chain via EntryPoint.handleOps.');
}

main().catch((e) => {
    console.error(`\n❌ FAILED: ${e?.shortMessage || e?.message || e}`);
    if (e?.stack) console.error(e.stack.split('\n').slice(0, 6).join('\n'));
    process.exit(1);
});
