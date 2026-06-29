/**
 * Tier-3 cumulative composite signature (algId 0x05) — full on-chain E2E on Sepolia.
 *
 * Proves the SDK-assembled Tier-3 composite — P256 passkey + DVT BLS aggregate + guardian ECDSA —
 * is ACCEPTED by the deployed v0.20.3 AirAccount (`_validateCumulativeTier3`), and that the OLD
 * pre-#234 packing (with the embedded messagePoint + messagePointSignature) is REJECTED. This is the
 * acceptance test for aastar-sdk#234 (tiering precedence + cumulative format drift).
 *
 * Everything is software-reproducible — NO browser / device passkey / KMS needed:
 *   - the P256 passkey is a software secp256r1 keypair (the account stores its pubkey via setP256Key);
 *     the contract verifies P256VERIFY(userOpHash, r, s, x, y) at the 0x100 precompile (ACTIVE on Sepolia).
 *   - the BLS aggregate comes from the three LIVE DVT nodes (same as dvt-realnode-e2e.ts).
 *   - the guardian is a software EOA.
 *
 * Flow (all live):
 *   0. Deploy a fresh account (owner=JASON, 1 ECDSA guardian, approvedAlgIds=[0x05]); set the
 *      validator router (set-once) and register the software P256 passkey (setP256Key).
 *   1. Build a v0.7 PackedUserOperation; userOpHash via EntryPoint.getUserOpHash.
 *   2. P256-sign userOpHash (low-S, 64B r||s).
 *   3. DVT nodes co-sign userOpHash; aggregate the G2 signatures (256B EIP-2537) + nodeIds.
 *   4. Guardian EIP-191 personal_sign over userOpHash (65B).
 *   5. Pack the 0x05 composite with the SDK's (fixed) packCumulativeT3Signature.
 *   6. eth_call validateUserOp(userOp{sig}, userOpHash, 0) from the EntryPoint → assert == 0 (ACCEPTED).
 *   7. Negative: the OLD format (messagePoint + mpSig re-inserted) → assert != 0 (REJECTED).
 *
 *   pnpm exec tsx tests/regression/onchain-evidence/tier3-composite-e2e.ts
 *
 * Requires: .env.sepolia (SEPOLIA_RPC_URL[/2/3], PRIVATE_KEY_JASON funded) + the three DVT nodes live.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { bls12_381 as noble } from '@noble/curves/bls12-381.js';
// @noble/curves v2 moved p256 to /nist (no /p256.js export); /nist.js exists in both v1 and v2.
import { p256 } from '@noble/curves/nist.js';
import {
    createPublicClient,
    createWalletClient,
    http,
    concat,
    encodePacked,
    numberToHex,
    keccak256,
    toBytes,
    getAddress,
    type Address,
    type Hex,
    type PublicClient,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import {
    CANONICAL_ADDRESSES,
    EntryPointABI,
    AAStarAirAccountV7ABI,
    AAStarBLSAlgorithmABI,
    buildInitConfig,
    encodeG2Point,
    airAccountActions,
    airAccountFactoryActions,
    entryPointActions,
} from '@aastar/core';
// SDK packer UNDER TEST (the #234-fixed cumulative format) + the message-point helper used to build a
// REALISTIC negative control (so the old-format rejection isolates the length/format, not bad inputs).
import { packCumulativeT3Signature, generateMessagePoint } from '../../../packages/airaccount/src/migration/viem/bls-packing';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

const SEPOLIA = 11155111;
const FACTORY = getAddress(CANONICAL_ADDRESSES[SEPOLIA].airAccountFactoryV7);
const ENTRY_POINT = getAddress(CANONICAL_ADDRESSES[SEPOLIA].entryPoint);
const VALIDATOR_ROUTER = getAddress(CANONICAL_ADDRESSES[SEPOLIA].aaStarValidator);
const BLS_VERIFIER = getAddress(CANONICAL_ADDRESSES[SEPOLIA].aaStarBLSAlgorithm);

const ALG_CUMULATIVE_T3 = 0x05;
const RPCS = [process.env.SEPOLIA_RPC_URL, process.env.SEPOLIA_RPC_URL2, process.env.SEPOLIA_RPC_URL3].filter(Boolean) as string[];
const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex;
// Deterministic salt — idempotent reruns reuse the same account.
const SALT = BigInt(keccak256(toBytes('tier3-composite-e2e/#234/2026-06')));
// Deterministic software keys so reruns reuse the same deployed account/passkey.
const P256_PRIV = keccak256(toBytes('tier3-composite-e2e/p256/#234')).slice(2);
const GUARDIAN_PK = keccak256(toBytes('tier3-composite-e2e/guardian/#234')) as Hex;

const norm = (h: string): Hex => ((h.startsWith('0x') ? h : `0x${h}`).toLowerCase() as Hex);

type PackedUserOp = {
    sender: Address; nonce: bigint; initCode: Hex; callData: Hex;
    accountGasLimits: Hex; preVerificationGas: bigint; gasFees: Hex; paymasterAndData: Hex; signature: Hex;
};

async function withRpcFallback<T>(fn: (c: PublicClient) => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (const url of RPCS) {
        try { return await fn(createPublicClient({ chain: sepolia, transport: http(url) }) as PublicClient); }
        catch (e) { lastErr = e; }
    }
    throw lastErr;
}

/** Decode a node's 256-byte EIP-2537 G2 signature into a @noble G2 point (from dvt-realnode-e2e). */
function eip2537ToG2(sig256: Hex) {
    const raw = sig256.slice(2);
    const slot = (i: number) => raw.slice(i * 128, i * 128 + 128);
    const coord = (h: string) => BigInt('0x' + h.slice(32));
    const Fp2 = noble.fields.Fp2;
    const point = noble.G2.ProjectivePoint.fromAffine({
        x: Fp2.fromBigTuple([coord(slot(0)), coord(slot(1))]),
        y: Fp2.fromBigTuple([coord(slot(2)), coord(slot(3))]),
    });
    point.assertValidity();
    return point;
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log(' Tier-3 cumulative composite (0x05) E2E — P256 + DVT BLS + guardian, on Sepolia (#234)');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    if (RPCS.length === 0) throw new Error('No SEPOLIA_RPC_URL[/2/3] in .env.sepolia');

    let jasonPk = process.env.PRIVATE_KEY_JASON;
    if (!jasonPk) throw new Error('PRIVATE_KEY_JASON missing from .env.sepolia');
    if (!jasonPk.startsWith('0x')) jasonPk = `0x${jasonPk}`;
    const owner = privateKeyToAccount(jasonPk as Hex);
    const walletClient = createWalletClient({ account: owner, chain: sepolia, transport: http(RPCS[0]) });

    // Software P256 passkey + software ECDSA guardian.
    const p256Pub = p256.getPublicKey(P256_PRIV, false); // 65B uncompressed: 04|x|y
    const p256X = norm(Buffer.from(p256Pub.slice(1, 33)).toString('hex'));
    const p256Y = norm(Buffer.from(p256Pub.slice(33, 65)).toString('hex'));
    const guardian = privateKeyToAccount(GUARDIAN_PK);
    const guardianWallet = createWalletClient({ account: guardian, chain: sepolia, transport: http(RPCS[0]) });
    console.log(`\n[0a] owner(JASON)=${owner.address}  guardian=${guardian.address}`);
    console.log(`     validatorRouter=${VALIDATOR_ROUTER}  blsVerifier=${BLS_VERIFIER}`);

    // ── (0b) Deploy a fresh account approving algId 0x05, with the guardian ─────────────────────
    const config = buildInitConfig({
        guardians: [{ ecdsa: guardian.address }],
        dailyLimit: 10n ** 18n, // 1 ETH — guard enabled ⇒ algId whitelist applies
        approvedAlgIds: [ALG_CUMULATIVE_T3],
    });
    const account = (await withRpcFallback((c) =>
        airAccountFactoryActions(FACTORY)(c).getAddress({ owner: owner.address, salt: SALT, config })
    )) as Address;
    console.log(`\n[0b] account = ${account} (salt=${numberToHex(SALT)})`);
    const code = await withRpcFallback((c) => c.getCode({ address: account }));
    if (code && code !== '0x') {
        console.log('     already deployed ✓ (idempotent rerun)');
    } else {
        const tx = await airAccountFactoryActions(FACTORY)(walletClient).createAccount({ owner: owner.address, salt: SALT, config, account: owner });
        const r = await withRpcFallback((c) => c.waitForTransactionReceipt({ hash: tx }));
        console.log(`     deploy tx=${tx} status=${r.status}`);
        if (r.status !== 'success') throw new Error('deploy reverted');
    }

    // ── (0c) Set validator router (set-once) + register the P256 passkey ────────────────────────
    const curValidator = (await withRpcFallback((c) =>
        c.readContract({ address: account, abi: AAStarAirAccountV7ABI, functionName: 'validator' })
    )) as Address;
    if (curValidator === '0x0000000000000000000000000000000000000000') {
        const tx = await walletClient.writeContract({ address: account, abi: AAStarAirAccountV7ABI, functionName: 'setValidator', args: [VALIDATOR_ROUTER], chain: sepolia });
        const r = await withRpcFallback((c) => c.waitForTransactionReceipt({ hash: tx }));
        console.log(`\n[0c] setValidator tx=${tx} status=${r.status}`);
    } else {
        console.log(`\n[0c] validator already set = ${curValidator}`);
    }
    const curX = (await withRpcFallback((c) => c.readContract({ address: account, abi: AAStarAirAccountV7ABI, functionName: 'p256KeyX' }))) as Hex;
    if (curX === ZERO_BYTES32) {
        const tx = await walletClient.writeContract({ address: account, abi: AAStarAirAccountV7ABI, functionName: 'setP256Key', args: [p256X, p256Y], chain: sepolia });
        const r = await withRpcFallback((c) => c.waitForTransactionReceipt({ hash: tx }));
        console.log(`     setP256Key tx=${tx} status=${r.status}`);
    } else {
        console.log(`     p256Key already set (x=${curX.slice(0, 14)}…)`);
    }

    // ── (1) Build a v0.7 PackedUserOperation + authoritative userOpHash ─────────────────────────
    const nonce = (await withRpcFallback((c) => entryPointActions(ENTRY_POINT)(c).getNonce({ sender: account, key: 0n }))) as bigint;
    const userOp: PackedUserOp = {
        sender: account, nonce, initCode: '0x', callData: '0x',
        accountGasLimits: ZERO_BYTES32, preVerificationGas: 0n, gasFees: ZERO_BYTES32, paymasterAndData: '0x', signature: '0x',
    };
    const userOpHash = (await withRpcFallback((c) =>
        c.readContract({ address: ENTRY_POINT, abi: EntryPointABI, functionName: 'getUserOpHash', args: [userOp] })
    )) as Hex;
    console.log(`\n[1] userOpHash = ${userOpHash}`);

    // ── (2) P256 passkey signature over userOpHash (low-S, 64B r||s) ────────────────────────────
    // version-agnostic: @noble/curves v1 sign→Signature(.r/.s); v2 sign→Uint8Array (parse via Signature.fromBytes).
    const p256Res = p256.sign(userOpHash.slice(2) as `0x${string}`, P256_PRIV, { lowS: true }) as unknown as { r?: bigint; s?: bigint };
    const rs = typeof p256Res.r === 'bigint' ? p256Res : (p256.Signature as any).fromBytes(p256Res as unknown as Uint8Array, 'compact');
    const p256Signature = concat([numberToHex(rs.r, { size: 32 }), numberToHex(rs.s, { size: 32 })]);
    console.log(`[2] P256 sig (r||s) = ${p256Signature.slice(0, 26)}… (${(p256Signature.length - 2) / 2}B)`);

    // ── (3) DVT node co-signatures over userOpHash → aggregate ──────────────────────────────────
    const ownerAuth = await walletClient.signMessage({ account: owner, message: { raw: userOpHash } });
    const userOpRpc = {
        sender: userOp.sender, nonce: numberToHex(userOp.nonce), initCode: userOp.initCode, callData: userOp.callData,
        accountGasLimits: userOp.accountGasLimits, preVerificationGas: numberToHex(userOp.preVerificationGas),
        gasFees: userOp.gasFees, paymasterAndData: userOp.paymasterAndData, signature: userOp.signature,
    };
    const tunnels = ['https://dvt1.aastar.io', 'https://dvt2.aastar.io', 'https://dvt3.aastar.io'];
    const signed: { nodeId: Hex; signature: Hex }[] = [];
    for (const url of tunnels) {
        try {
            const res = await fetch(`${url}/signature/sign`, {
                method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ userOp: userOpRpc, ownerAuth }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body.nodeId || !body.signature) { console.warn(`    ! ${url} -> ${res.status}`); continue; }
            const registered = (await withRpcFallback((c) =>
                c.readContract({ address: BLS_VERIFIER, abi: AAStarBLSAlgorithmABI, functionName: 'isRegistered', args: [norm(body.nodeId)] })
            )) as boolean;
            if (!registered) { console.warn(`    ! ${url} nodeId not registered`); continue; }
            signed.push({ nodeId: norm(body.nodeId), signature: norm(body.signature) });
            console.log(`    ${url.replace('https://', '')}  nodeId=${norm(body.nodeId).slice(0, 16)}…  registered`);
        } catch (e) { console.warn(`    ! ${url} ${(e as Error).message.slice(0, 80)}`); }
    }
    if (signed.length < 2) throw new Error(`need >= 2 registered node co-signatures, got ${signed.length}`);
    const aggPoint = signed.slice(1).reduce((acc, s) => acc.add(eip2537ToG2(s.signature)), eip2537ToG2(signed[0].signature));
    const blsSignature = encodeG2Point(`0x${aggPoint.toHex(false)}` as Hex);
    const nodeIds = signed.map((s) => s.nodeId);
    console.log(`[3] aggregated ${signed.length} BLS co-signatures (256B), nodeIds=${nodeIds.length}`);

    // ── (4) Guardian EIP-191 personal_sign over userOpHash (65B) ────────────────────────────────
    const guardianSignature = await guardianWallet.signMessage({ account: guardian, message: { raw: userOpHash } });
    console.log(`[4] guardian sig = ${guardianSignature.slice(0, 22)}… (${(guardianSignature.length - 2) / 2}B)`);

    // ── (5) Pack the 0x05 composite with the SDK's (#234-fixed) packer ──────────────────────────
    const composite = packCumulativeT3Signature({ p256Signature, nodeIds, blsSignature, guardianSignature }) as Hex;
    console.log(`\n[5] SDK packCumulativeT3Signature = ${(composite.length - 2) / 2} bytes (algId=0x${composite.slice(2, 4)})`);

    // ── (6) On-chain oracle: validateUserOp from the EntryPoint (eth_call) ───────────────────────
    async function validate(sigBytes: Hex): Promise<bigint | 'revert'> {
        try {
            const sim = await withRpcFallback((c) =>
                c.simulateContract({
                    address: account, abi: AAStarAirAccountV7ABI, functionName: 'validateUserOp',
                    args: [{ ...userOp, signature: sigBytes }, userOpHash, 0n], account: ENTRY_POINT,
                })
            );
            return sim.result as bigint;
        } catch { return 'revert'; }
    }
    const accepted = await validate(composite);
    console.log(`\n[6] validateUserOp(0x05 composite) = ${accepted}  -> ${accepted === 0n ? '0 ✅ ACCEPTED' : '❌ REJECTED'}`);

    // ── (7) Negative: the OLD pre-#234 format MUST be rejected ──────────────────────────────────
    // Use a REAL messagePoint (the on-chain-recomputable G2 of userOpHash) + a REAL owner ECDSA over
    // keccak256(messagePoint) — exactly the two fields #45 removed. Every component is individually
    // VALID, so the ONLY difference from the accepted composite is the extra 321 bytes. The rejection
    // therefore isolates the length/format drift (not bad inputs) — addresses #235 review F2.
    const nodeIdsLen = numberToHex(BigInt(nodeIds.length), { size: 32 });
    const nodeIdsBytes = nodeIds.length ? (concat(nodeIds) as Hex) : ('0x' as Hex);
    const realMessagePoint = (await generateMessagePoint(userOpHash)) as Hex; // 256B EIP-2537 G2
    const realMpSig = await walletClient.signMessage({ account: owner, message: { raw: keccak256(realMessagePoint) } }); // 65B owner ECDSA
    const oldFormat = encodePacked(
        ['bytes1', 'bytes', 'bytes', 'bytes', 'bytes', 'bytes', 'bytes', 'bytes'],
        ['0x05', p256Signature, nodeIdsLen, nodeIdsBytes, blsSignature, realMessagePoint, realMpSig, guardianSignature]
    ) as Hex;
    const oldResult = await validate(oldFormat);
    console.log(`[7] validateUserOp(OLD format, real messagePoint+mpSig, +321B) = ${oldResult}  -> ${oldResult !== 0n ? '✅ rejected (isolates the length/format drift)' : '❌ accepted (UNEXPECTED)'}`);

    console.log('\n┌─────────────────── EVIDENCE (Tier-3 composite, #234) ───────────────────');
    console.log(`│ account        : ${account}`);
    console.log(`│ owner / guardian: ${owner.address} / ${guardian.address}`);
    console.log(`│ p256 passkey x : ${p256X}`);
    console.log(`│ userOpHash     : ${userOpHash}`);
    console.log(`│ nodeIds        : ${nodeIds.join(', ')}`);
    console.log(`│ composite bytes: ${(composite.length - 2) / 2} (algId 0x05)`);
    console.log(`│ validate(new)  : ${accepted}  ${accepted === 0n ? '= 0 ✅ ACCEPTED' : '❌'}`);
    console.log(`│ validate(old)  : ${oldResult}  ${oldResult !== 0n ? '✅ rejected' : '❌ accepted'}`);
    console.log('└──────────────────────────────────────────────────────────────────────────');

    if (accepted !== 0n) throw new Error('FAIL: SDK-packed 0x05 composite was NOT accepted on-chain');
    if (oldResult === 0n) throw new Error('FAIL: old (messagePoint) format was accepted — fix is not load-bearing');
    console.log('\n🎉 PASS — Tier-3 composite ACCEPTED on-chain; old pre-#234 format rejected.');
}

main().catch((e) => { console.error(`\n❌ E2E FAILED: ${e.message}`); process.exit(1); });
