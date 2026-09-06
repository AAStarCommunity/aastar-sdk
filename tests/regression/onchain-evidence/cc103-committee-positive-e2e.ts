/**
 * CC-103 / CC-104 — COMMITTEE POSITIVE path, end to end on live Sepolia.
 *
 * The counterpart to cc103-committee-e2e.ts (read-only conformance): that one proves the encoder
 * agrees with the contract's parser; this one proves the chain ACCEPTS a committee-framed signature.
 *
 * Prerequisites, all now true on-chain (verified before this runner was written, not assumed):
 *   committeeActive()  = true          (dvt flipped setEpochLength)
 *   requiredQuorum()   = 2             (NOT the sentinel -> snapshotEpoch was done too)
 *   epoch e-1 pinned   = true, setCount = 3
 *   the three local DVT nodes are isRegistered on the COMMITTEE validator
 *
 * Flow:
 *   0. Derive + deploy a v0.31.0 BLS-only account, then enrollInCommitteeValidator() (one-time).
 *   1. Build a v0.7 PackedUserOperation; userOpHash from EntryPoint.
 *   2. Each node co-signs bytes(userOpHash) (unchanged preimage — committee adds membership proof,
 *      not a new message). ownerAuth is the tagged 0x01 || 65-byte frame the node's gate requires.
 *   3. Fetch slot + Merkle proof per signer from the committee validator.
 *   4. Assemble with the SDK: [0x01][ nodeIdsLength ][ nodeId|slot|proof x k ][ blsSig ][ ownerSig ].
 *      accountId is NEVER included — the account injects address(this) itself (CC-103 B2).
 *   5. eth_call validateUserOp from the EntryPoint -> assert == 0.
 *   6. Negatives: LEGACY framing under committee mode, and an under-quorum aggregate.
 *
 * Run: AASTAR_DVT_ENV=testnet-local pnpm exec tsx tests/regression/onchain-evidence/cc103-committee-positive-e2e.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { bls12_381 as noble } from '@noble/curves/bls12-381.js';
import {
    createPublicClient, createWalletClient, http, concat, numberToHex, keccak256, toBytes,
    getAddress, type Address, type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import {
    CANONICAL_ADDRESSES, DVT_CONFIG, getDvtConfig, EntryPointABI, AAStarAirAccountV7ABI,
    AAStarCommitteeValidatorABI, buildInitConfig, encodeG2Point, encodeBLSAccountSignature,
    airAccountFactoryActions, entryPointActions, getCommitteeState, fetchCommitteeSigners, readFrozenRootAgreement,
    isAccountEnrolled, assertCommitteeSubmittable, type CommitteeSigner,
} from '@aastar/core';
import { packOwnerAuthEcdsa } from '../../../packages/airaccount/src/migration/viem/bls-packing';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

const SEPOLIA = 11155111;
const C = CANONICAL_ADDRESSES[SEPOLIA];
const FACTORY = getAddress(C.airAccountFactoryV7);
const ENTRY_POINT = getAddress(C.entryPoint);
const ROUTER = getAddress(C.aaStarValidator);
const COMMITTEE = getAddress(C.aaStarBLSAlgorithm);
const ALG_BLS = 0x01;
const RPC = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL!;
const SALT = BigInt(keccak256(toBytes('cc103-committee-positive/2026-08')));
const norm = (h: string): Hex => ((h.startsWith('0x') ? h : `0x${h}`).toLowerCase() as Hex);

let fails = 0;
const check = (ok: boolean, label: string, detail = '') => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
    if (!ok) fails++;
};

/** 256-byte EIP-2537 G2 -> noble point (same decoder as the legacy runners). */
function toG2(sig256: Hex) {
    const raw = sig256.slice(2);
    const slot = (i: number) => raw.slice(i * 128, i * 128 + 128);
    const coord = (h: string) => BigInt('0x' + h.slice(32));
    const Fp2 = noble.fields.Fp2;
    const p = noble.G2.ProjectivePoint.fromAffine({
        x: Fp2.fromBigTuple([coord(slot(0)), coord(slot(1))]),
        y: Fp2.fromBigTuple([coord(slot(2)), coord(slot(3))]),
    });
    p.assertValidity();
    return p;
}

async function main() {
    console.log('═══ CC-103 COMMITTEE POSITIVE — live Sepolia ═══\n');
    const pc = createPublicClient({ chain: sepolia, transport: http(RPC) });
    const pk = process.env.PRIVATE_KEY_JASON!;
    const owner = privateKeyToAccount((pk.startsWith('0x') ? pk : `0x${pk}`) as Hex);
    const wc = createWalletClient({ account: owner, chain: sepolia, transport: http(RPC) });

    // ── 0. preconditions ────────────────────────────────────────────────────────────────────
    console.log('[0] committee preconditions');
    const st = await getCommitteeState(pc as any, COMMITTEE);
    console.log(`     router=${ROUTER}  committeeValidator=${COMMITTEE}`);
    check(st.active, 'committeeActive()', `${st.active}`);
    check(st.quorumUsable, 'requiredQuorum() is a real value, not the sentinel', `${st.requiredQuorum}`);
    check(st.treeDepth === 14 && st.perSignerBytes === 512, 'TREE_DEPTH / perSigner read from chain', `${st.treeDepth} / ${st.perSignerBytes}`);
    if (!st.active || !st.quorumUsable) throw new Error('committee not usable — aborting before spending gas');

    // ── 0b. account: deploy + enroll (idempotent) ───────────────────────────────────────────
    const config = buildInitConfig({ guardians: [], dailyLimit: 10n ** 18n, approvedAlgIds: [ALG_BLS] });
    const account = (await airAccountFactoryActions(FACTORY)(pc as any).getAddress({ owner: owner.address, salt: SALT, config })) as Address;
    console.log(`\n[0b] account = ${account}`);
    if (!(await pc.getCode({ address: account }))?.replace('0x', '')) {
        const tx = await airAccountFactoryActions(FACTORY)(wc as any).createAccount({ owner: owner.address, salt: SALT, config, account: owner });
        const r = await pc.waitForTransactionReceipt({ hash: tx });
        check(r.status === 'success', 'createAccount (v0.31.0 factory)', tx);
    } else console.log('     already deployed (idempotent rerun)');

    if (!(await isAccountEnrolled(pc as any, COMMITTEE, account))) {
        const tx = await wc.writeContract({ address: account, abi: AAStarAirAccountV7ABI as any, functionName: 'enrollInCommitteeValidator' });
        const r = await pc.waitForTransactionReceipt({ hash: tx });
        check(r.status === 'success', 'enrollInCommitteeValidator() (one-time, owner tx)', tx);
    } else console.log('     already enrolled');
    check(await isAccountEnrolled(pc as any, COMMITTEE, account), 'enrolledAccount(account) == true');

    // ── 1. UserOp + hash ────────────────────────────────────────────────────────────────────
    const nonce = (await entryPointActions(ENTRY_POINT)(pc as any).getNonce({ sender: account, key: 0n })) as bigint;
    const userOp = {
        sender: account, nonce, initCode: '0x' as Hex, callData: '0x' as Hex,
        accountGasLimits: concat([numberToHex(300_000n, { size: 16 }), numberToHex(300_000n, { size: 16 })]) as Hex,
        preVerificationGas: 100_000n,
        gasFees: concat([numberToHex(2_000_000_000n, { size: 16 }), numberToHex(3_000_000_000n, { size: 16 })]) as Hex,
        paymasterAndData: '0x' as Hex, signature: '0x' as Hex,
    };
    const userOpHash = (await pc.readContract({ address: ENTRY_POINT, abi: EntryPointABI as any, functionName: 'getUserOpHash', args: [userOp] })) as Hex;
    console.log(`\n[1] userOpHash = ${userOpHash}`);

    // ── 2. node co-signatures ───────────────────────────────────────────────────────────────
    const ownerSig65 = await wc.signMessage({ account: owner, message: { raw: userOpHash } });
    const ownerAuth = packOwnerAuthEcdsa(ownerSig65);
    const urls = getDvtConfig().dvtNodes.map((n) => n.url);
    console.log(`\n[2] DVT env=${process.env.AASTAR_DVT_ENV ?? DVT_CONFIG.active} -> ${urls.join('  ')}`);
    const rpcOp = { ...userOp, nonce: numberToHex(userOp.nonce), preVerificationGas: numberToHex(userOp.preVerificationGas) };
    const partials: { nodeId: Hex; signature: Hex }[] = [];
    const seenSig = new Set<string>();
    for (const { url, nodeId: pinned } of getDvtConfig().dvtNodes) {
        try {
            const res = await fetch(`${url}/signature/sign`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userOp: rpcOp, ownerAuth }) });
            const raw = await res.text();
            const b = (() => { try { return JSON.parse(raw); } catch { return {} as any; } })();
            if (!res.ok || !b.nodeId || !b.signature) { console.warn(`     ! ${url} -> ${res.status} ${raw.slice(0, 120)}`); continue; }
            const id = norm(b.nodeId), sig = norm(b.signature);
            if (id !== norm(pinned)) { console.warn(`     ! ${url} reported ${id}, config pins ${norm(pinned)}`); continue; }
            if (seenSig.has(sig)) { console.warn(`     ! ${url} byte-identical partial — one key behind two ids`); continue; }
            const reg = (await pc.readContract({ address: COMMITTEE, abi: AAStarCommitteeValidatorABI as any, functionName: 'isRegistered', args: [id] })) as boolean;
            if (!reg) { console.warn(`     ! ${url} nodeId not registered on the COMMITTEE validator`); continue; }
            seenSig.add(sig); partials.push({ nodeId: id, signature: sig });
            console.log(`     ${url}  ${id.slice(0, 18)}…  registered`);
        } catch (e) { console.warn(`     ! ${url} ${(e as Error).message.slice(0, 70)}`); }
    }
    check(BigInt(partials.length) >= st.requiredQuorum, `collected >= requiredQuorum (${st.requiredQuorum})`, `${partials.length} partial(s)`);
    if (BigInt(partials.length) < st.requiredQuorum) throw new Error('under quorum — aborting');

    // ── 3. slot + Merkle proofs ─────────────────────────────────────────────────────────────
    const { signers, atBlock } = await fetchCommitteeSigners(pc as any, COMMITTEE, partials.map((p) => p.nodeId));
    // Was `(last set mutation ${lastSetMutationBlock})` — printing a field this function no longer
    // returns, i.e. the literal string "undefined" in the evidence output. Reporting the roots says
    // something checkable instead.
    const fresh = await readFrozenRootAgreement(pc as any, COMMITTEE);
    console.log(`\n[3] proofs fetched at block ${atBlock}; epoch ${fresh.epoch}, running root ` +
        `${fresh.runningRoot.slice(0, 12)}… vs frozen(e-1) ${fresh.frozenRoot.slice(0, 12)}… → ` +
        `${fresh.agrees ? 'proofs would verify' : 'STALE, proofs would NOT verify'}`);
    check(signers.every((s) => s.merkleProof.length === st.treeDepth), 'every proof has TREE_DEPTH siblings');

    await assertCommitteeSubmittable(pc as any, COMMITTEE, account, signers.length);
    check(true, 'assertCommitteeSubmittable passed (active + enrolled + quorum)');

    // ── 4. assemble ─────────────────────────────────────────────────────────────────────────
    const aggPoint = partials.slice(1).reduce((a, p) => a.add(toG2(p.signature)), toG2(partials[0].signature));
    const blsSig = encodeG2Point(`0x${aggPoint.toHex(false)}` as Hex);
    const byId = new Map(signers.map((s) => [BigInt(s.nodeId), s] as const));
    const committeeSigners: CommitteeSigner[] = partials.map((p) => byId.get(BigInt(p.nodeId))!);
    const sig = encodeBLSAccountSignature({ committeeSigners, blsSig, ownerSig: ownerSig65, treeDepth: st.treeDepth });
    const expectedLen = 1 + 32 + committeeSigners.length * st.perSignerBytes + 256 + 65;
    console.log(`\n[4] committee signature = ${(sig.length - 2) / 2} bytes (expect ${expectedLen})`);
    check((sig.length - 2) / 2 === expectedLen, 'length matches the committee framing');
    check(!sig.toLowerCase().includes(account.slice(2).toLowerCase()), 'accountId ABSENT from the payload (CC-103 B2)');

    // ── 5. THE POSITIVE ASSERTION ───────────────────────────────────────────────────────────
    const validate = async (s: Hex) => {
        try {
            const { result } = await pc.simulateContract({
                address: account, abi: AAStarAirAccountV7ABI as any, functionName: 'validateUserOp',
                args: [{ ...userOp, signature: s }, userOpHash, 0n], account: ENTRY_POINT,
            });
            return result as bigint;
        } catch (e: any) { return `revert: ${(e?.shortMessage || e?.message || '').slice(0, 60)}` as any; }
    };
    const res = await validate(sig);
    console.log(`\n[5] validateUserOp(committee) = ${res}`);
    check(res === 0n, '*** COMMITTEE SIGNATURE ACCEPTED ON-CHAIN (validateUserOp == 0) ***');

    // ── 6. negatives ────────────────────────────────────────────────────────────────────────
    console.log('\n[6] negative controls');
    const legacy = encodeBLSAccountSignature({ nodeIds: partials.map((p) => p.nodeId), blsSig, ownerSig: ownerSig65 });
    const legacyRes = await validate(legacy);
    check(legacyRes !== 0n, 'LEGACY framing REJECTED while committee mode is on', `${legacyRes}`);

    if (committeeSigners.length > Number(st.requiredQuorum)) {
        const short = encodeBLSAccountSignature({
            committeeSigners: committeeSigners.slice(0, Number(st.requiredQuorum) - 1),
            blsSig, ownerSig: ownerSig65, treeDepth: st.treeDepth,
        });
        const shortRes = await validate(short);
        check(shortRes !== 0n, 'UNDER-QUORUM aggregate REJECTED', `${shortRes}`);
    }

    console.log('\n─────────────────────────────────────────────');
    console.log(`account   : ${account}`);
    console.log(`userOpHash: ${userOpHash}`);
    console.log(`signers   : ${committeeSigners.map((s) => s.nodeId.slice(0, 12) + '…').join(', ')}  (quorum ${st.requiredQuorum})`);
    console.log(`committee : ${(sig.length - 2) / 2} bytes, perSigner ${st.perSignerBytes}`);
    if (fails > 0) { console.error(`\nRESULT: ${fails} check(s) FAILED`); process.exit(1); }
    console.log('\n🎉 COMMITTEE POSITIVE PATH PROVEN ON-CHAIN — validateUserOp == 0');
}

main().catch((e) => {
    console.error('CC103-POSITIVE FAIL:', e?.shortMessage || e?.message || e);
    if (e?.stack) console.error(e.stack.split('\n').slice(0, 5).join('\n'));
    process.exit(1);
});
