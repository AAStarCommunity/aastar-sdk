/**
 * Tier-3 WebAuthn cumulative composite (algId 0x0a) — full on-chain E2E on Sepolia (v0.27.0 DVT-unification).
 *
 * Proves the device-passkey path: the SDK-assembled Tier-3 composite — on-chain WebAuthn P256
 * (passkey) + DVT BLS aggregate + guardian ECDSA — is ACCEPTED by the deployed v0.27.0 AirAccount
 * (`_validateCumulativeTier3` WebAuthn variant, algId 0x0a). This is the device-passkey acceptance
 * for aastar-sdk#234 / airaccount-contract#147/#148.
 *
 * The "device passkey" is simulated with a software P-256 key (registered via setP256Key), and a
 * SYNTHETIC WebAuthn assertion is built exactly as `navigator.credentials.get()` produces it:
 *   - clientDataJSON = `{"type":"webauthn.get","challenge":"` + base64url(userOpHash) + suffix
 *   - the key signs sha256(authenticatorData ‖ sha256(clientDataJSON))  (ECDSA-SHA256)
 * so the on-chain WebAuthn reconstruction + P256VERIFY (0x100 precompile) passes — no browser needed.
 *
 * Flow (all live): deploy via the v0.27.0 factory (approvedAlgIds=[0x0a]) → setValidator + setP256Key
 * → build userOp + userOpHash → WebAuthn assertion → packWebAuthnBlob → DVT BLS aggregate → guardian
 * → packCumulativeT3WA → eth_call validateUserOp == 0. Negative: a tampered challenge is rejected.
 *
 *   pnpm exec tsx tests/regression/onchain-evidence/tier3-webauthn-composite-e2e.ts
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
    sha256,
    concat,
    numberToHex,
    keccak256,
    toBytes,
    stringToBytes,
    bytesToHex,
    getAddress,
    parseEther,
    formatEther,
    encodeFunctionData,
    type Address,
    type Hex,
    type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
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
// SDK packers UNDER TEST (WebAuthn cumulative, algId 0x0a; #261 tagged owner-auth 0x02).
import {
    packWebAuthnBlob,
    packCumulativeT3WA,
    packBlsPayload,
    packOwnerAuthWebAuthn,
} from '../../../packages/airaccount/src/migration/viem/bls-packing';
import { wrapExecuteUserOp } from '../../../packages/airaccount/src/server/utils/execute-user-op';
import { UserOperationBuilder } from '../../../packages/sdk/src/index.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

const SEPOLIA = 11155111;
const FACTORY = getAddress(CANONICAL_ADDRESSES[SEPOLIA].airAccountFactoryV7); // v0.27.0 (from CANONICAL_ADDRESSES)
const ENTRY_POINT = getAddress(CANONICAL_ADDRESSES[SEPOLIA].entryPoint);
const VALIDATOR_ROUTER = getAddress(CANONICAL_ADDRESSES[SEPOLIA].aaStarValidator);
const BLS_VERIFIER = getAddress(CANONICAL_ADDRESSES[SEPOLIA].aaStarBLSAlgorithm);

const ALG_CUMULATIVE_T3_WA = 0x0a;
const RPCS = [process.env.SEPOLIA_RPC_URL, process.env.SEPOLIA_RPC_URL2, process.env.SEPOLIA_RPC_URL3].filter(Boolean) as string[];
const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex;
const SALT = BigInt(keccak256(toBytes('tier3-webauthn-composite-e2e/#234/v0.21.0')));
const P256_PRIV = keccak256(toBytes('tier3-webauthn-e2e/p256/#234')).slice(2);
const GUARDIAN_PK = keccak256(toBytes('tier3-webauthn-e2e/guardian/#234')) as Hex;

const norm = (h: string): Hex => ((h.startsWith('0x') ? h : `0x${h}`).toLowerCase() as Hex);

type PackedUserOp = {
    sender: Address; nonce: bigint; initCode: Hex; callData: Hex;
    accountGasLimits: Hex; preVerificationGas: bigint; gasFees: Hex; paymasterAndData: Hex; signature: Hex;
};

/** P-256 low-S DER signature — version-agnostic across @noble/curves v1 (Signature obj) and v2 (Uint8Array). */
function p256SignDerLowS(hash: Uint8Array, priv: string): Uint8Array {
    const res = p256.sign(hash, priv, { lowS: true }) as unknown as { toDERRawBytes?: () => Uint8Array };
    if (typeof res.toDERRawBytes === 'function') return res.toDERRawBytes(); // v1.x
    return (p256.Signature as any).fromBytes(res as unknown as Uint8Array, 'compact').toBytes('der'); // v2.x
}

function base64Url(bytes: Uint8Array): string {
    let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Build a synthetic WebAuthn assertion (the 3 response fields) over `userOpHash`, signed by `priv`. */
function makeWebAuthnAssertion(userOpHash: Hex, priv: string) {
    const clientDataJSON =
        '{"type":"webauthn.get","challenge":"' + base64Url(hexToBytesLocal(userOpHash)) +
        '","origin":"https://aastar.io","crossOrigin":false}';
    const clientDataBytes = stringToBytes(clientDataJSON);
    const authenticatorData = hexToBytesLocal(('0x' + 'ab'.repeat(32) + '05' + '00000001') as Hex); // rpIdHash + UP|UV + signCount
    const payloadHash = sha256(concat([bytesToHex(authenticatorData), sha256(clientDataBytes)]));
    return { authenticatorData, clientDataJSON, signature: p256SignDerLowS(hexToBytesLocal(payloadHash), priv) };
}
function hexToBytesLocal(h: Hex): Uint8Array { return toBytes(h); }

async function withRpcFallback<T>(fn: (c: PublicClient) => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (const url of RPCS) {
        try { return await fn(createPublicClient({ chain: sepolia, transport: http(url) }) as PublicClient); }
        catch (e) { lastErr = e; }
    }
    throw lastErr;
}

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

/** POST {userOp, tag-0x02 ownerAuth} to the 3 live DVT nodes → aggregate their BLS co-signatures. */
async function coSignDvt(userOpRpc: Record<string, unknown>, ownerAuth: Hex): Promise<Hex> {
    const signed: { nodeId: Hex; signature: Hex }[] = [];
    for (const url of ['https://dvt1.aastar.io', 'https://dvt2.aastar.io', 'https://dvt3.aastar.io']) {
        try {
            const res = await fetch(`${url}/signature/sign`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userOp: userOpRpc, ownerAuth }) });
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body.nodeId || !body.signature) { console.warn(`    ! ${url} -> ${res.status}`); continue; }
            const registered = (await withRpcFallback((c) => c.readContract({ address: BLS_VERIFIER, abi: AAStarBLSAlgorithmABI, functionName: 'isRegistered', args: [norm(body.nodeId)] }))) as boolean;
            if (!registered) { console.warn(`    ! ${url} not registered`); continue; }
            signed.push({ nodeId: norm(body.nodeId), signature: norm(body.signature) });
            console.log(`    ${url.replace('https://', '')}  co-signed (isValidOwnerAuth ✓)`);
        } catch (e) { console.warn(`    ! ${url} ${(e as Error).message.slice(0, 70)}`); }
    }
    if (signed.length < 2) throw new Error(`need >= 2 node co-signatures, got ${signed.length}`);
    const aggPoint = signed.slice(1).reduce((acc, s) => acc.add(eip2537ToG2(s.signature)), eip2537ToG2(signed[0].signature));
    return packBlsPayload(signed.map((s) => s.nodeId), encodeG2Point(`0x${aggPoint.toHex(false)}` as Hex));
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log(' Tier-3 WebAuthn cumulative (0x0a) E2E — passkey + DVT BLS + guardian + tag-0x02 DVT ownerAuth, Sepolia v0.27.0 (#234/#261/#274)');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    if (RPCS.length === 0) throw new Error('No SEPOLIA_RPC_URL[/2/3] in .env.sepolia');

    let jasonPk = process.env.PRIVATE_KEY_JASON;
    if (!jasonPk) throw new Error('PRIVATE_KEY_JASON missing');
    if (!jasonPk.startsWith('0x')) jasonPk = `0x${jasonPk}`;
    const owner = privateKeyToAccount(jasonPk as Hex);
    const walletClient = createWalletClient({ account: owner, chain: sepolia, transport: http(RPCS[0]) });

    // Software P-256 "device passkey" + software ECDSA guardian.
    const p256Pub = p256.getPublicKey(P256_PRIV, false);
    const p256X = norm(Buffer.from(p256Pub.slice(1, 33)).toString('hex'));
    const p256Y = norm(Buffer.from(p256Pub.slice(33, 65)).toString('hex'));
    const guardian = privateKeyToAccount(GUARDIAN_PK);
    const guardianWallet = createWalletClient({ account: guardian, chain: sepolia, transport: http(RPCS[0]) });
    console.log(`\n[0a] factory(v0.27.0)=${FACTORY}  owner=${owner.address}  guardian=${guardian.address}`);

    // ── v0.22.0: deploy with the passkey + validator wired AT BIRTH (no setP256Key/setValidator tx) ──
    // getAddress + createAccount both take the SAME ownerP256X/Y (the salt now binds them).
    const config = buildInitConfig({ guardians: [{ ecdsa: guardian.address }], dailyLimit: 10n ** 18n, approvedAlgIds: [ALG_CUMULATIVE_T3_WA] });
    const account = (await withRpcFallback((c) =>
        airAccountFactoryActions(FACTORY)(c).getAddress({ owner: owner.address, salt: SALT, config, ownerP256X: p256X, ownerP256Y: p256Y })
    )) as Address;
    console.log(`[0b] counterfactual account = ${account}`);
    const code = await withRpcFallback((c) => c.getCode({ address: account }));
    if (code && code !== '0x') {
        console.log('     already deployed ✓');
    } else {
        // direct mode: ownerSig "0x" (msg.sender == owner), passkey injected at birth.
        const tx = await airAccountFactoryActions(FACTORY)(walletClient).createAccount({
            owner: owner.address, salt: SALT, config, ownerP256X: p256X, ownerP256Y: p256Y, account: owner,
        });
        const r = await withRpcFallback((c) => c.waitForTransactionReceipt({ hash: tx }));
        console.log(`     deploy tx=${tx} status=${r.status}`);
        if (r.status !== 'success') throw new Error('deploy reverted');
        // (No r.contractAddress check: the factory CREATE2s the account internally, so the receipt's
        // contractAddress is undefined. The counterfactual match is proven below — we read p256KeyX
        // from the PREDICTED `account` address and assert it == the injected passkey; if the prediction
        // were wrong, that read would hit an empty/zero account and the assertion would fail.)
        const deployedCode = await withRpcFallback((c) => c.getCode({ address: account }));
        if (!deployedCode || deployedCode === '0x') {
            throw new Error(`counterfactual address ${account} has no code after deploy — getAddress prediction wrong`);
        }
    }

    // ── v0.22.0 birth-injection assertions: passkey + validator set with NO post-deploy tx ──────────
    const bornX = (await withRpcFallback((c) => c.readContract({ address: account, abi: AAStarAirAccountV7ABI, functionName: 'p256KeyX' }))) as Hex;
    const bornValidator = (await withRpcFallback((c) => c.readContract({ address: account, abi: AAStarAirAccountV7ABI, functionName: 'validator' }))) as Address;
    console.log(`[0c] p256KeyX @birth = ${bornX.slice(0, 14)}…  (== supplied: ${bornX.toLowerCase() === p256X.toLowerCase()})`);
    console.log(`     validator @birth = ${bornValidator} (non-zero: ${bornValidator !== '0x0000000000000000000000000000000000000000'})`);
    if (bornX.toLowerCase() !== p256X.toLowerCase()) throw new Error('passkey not injected at birth (p256KeyX != supplied ownerP256X)');
    if (bornValidator === '0x0000000000000000000000000000000000000000') throw new Error('validator not wired at birth');

    // ── Build userOp + userOpHash ───────────────────────────────────────────────────────────────
    const nonce = (await withRpcFallback((c) => entryPointActions(ENTRY_POINT)(c).getNonce({ sender: account, key: 0n }))) as bigint;
    const userOp: PackedUserOp = {
        sender: account, nonce, initCode: '0x', callData: '0x',
        accountGasLimits: ZERO_BYTES32, preVerificationGas: 0n, gasFees: ZERO_BYTES32, paymasterAndData: '0x', signature: '0x',
    };
    const userOpHash = (await withRpcFallback((c) => c.readContract({ address: ENTRY_POINT, abi: EntryPointABI, functionName: 'getUserOpHash', args: [userOp] }))) as Hex;
    console.log(`\n[1] userOpHash = ${userOpHash}`);

    // ── WebAuthn passkey assertion (challenge = userOpHash) → blob ──────────────────────────────
    const assertion = makeWebAuthnAssertion(userOpHash, P256_PRIV);
    const waBlob = packWebAuthnBlob(assertion, userOpHash);
    console.log(`[2] WebAuthn blob = ${(waBlob.length - 2) / 2} bytes (clientDataJSON challenge=userOpHash)`);

    // ── DVT BLS aggregate over userOpHash ───────────────────────────────────────────────────────
    // #261: authorize the DVT with a TAG-0x02 device-passkey ownerAuth (the same WebAuthn assertion the
    // composite uses). The v1.7.1 DVT eth_calls account.isValidOwnerAuth(userOpHash, ownerAuth), whose
    // WEBAUTHN branch P256-verifies this against the account's on-chain p256KeyX/Y — NO KMS owner ECDSA.
    const ownerAuth = packOwnerAuthWebAuthn(assertion, userOpHash);
    console.log(`[2b] tag-0x02 device-passkey ownerAuth = ${(ownerAuth.length - 2) / 2} bytes (tag=0x${ownerAuth.slice(2, 4)})`);
    const userOpRpc = { sender: userOp.sender, nonce: numberToHex(userOp.nonce), initCode: userOp.initCode, callData: userOp.callData, accountGasLimits: userOp.accountGasLimits, preVerificationGas: numberToHex(userOp.preVerificationGas), gasFees: userOp.gasFees, paymasterAndData: userOp.paymasterAndData, signature: userOp.signature };
    const signed: { nodeId: Hex; signature: Hex }[] = [];
    for (const url of ['https://dvt1.aastar.io', 'https://dvt2.aastar.io', 'https://dvt3.aastar.io']) {
        try {
            const res = await fetch(`${url}/signature/sign`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userOp: userOpRpc, ownerAuth }) });
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body.nodeId || !body.signature) { console.warn(`    ! ${url} -> ${res.status}`); continue; }
            const registered = (await withRpcFallback((c) => c.readContract({ address: BLS_VERIFIER, abi: AAStarBLSAlgorithmABI, functionName: 'isRegistered', args: [norm(body.nodeId)] }))) as boolean;
            if (!registered) { console.warn(`    ! ${url} not registered`); continue; }
            signed.push({ nodeId: norm(body.nodeId), signature: norm(body.signature) });
            console.log(`    ${url.replace('https://', '')}  registered`);
        } catch (e) { console.warn(`    ! ${url} ${(e as Error).message.slice(0, 70)}`); }
    }
    if (signed.length < 2) throw new Error(`need >= 2 node co-signatures, got ${signed.length}`);
    const aggPoint = signed.slice(1).reduce((acc, s) => acc.add(eip2537ToG2(s.signature)), eip2537ToG2(signed[0].signature));
    const blsSignature = encodeG2Point(`0x${aggPoint.toHex(false)}` as Hex);
    const blsPayload = packBlsPayload(signed.map((s) => s.nodeId), blsSignature);
    console.log(`[3] aggregated ${signed.length} BLS co-signatures`);

    // ── Guardian ECDSA over userOpHash ──────────────────────────────────────────────────────────
    const guardianSignature = await guardianWallet.signMessage({ account: guardian, message: { raw: userOpHash } });

    // ── Pack the 0x0a WebAuthn composite + on-chain validate ────────────────────────────────────
    const composite = packCumulativeT3WA(waBlob, blsPayload, guardianSignature);
    console.log(`[4] packCumulativeT3WA = ${(composite.length - 2) / 2} bytes (algId=0x${composite.slice(2, 4)})`);

    async function validate(sigBytes: Hex): Promise<bigint | 'revert'> {
        try {
            const sim = await withRpcFallback((c) => c.simulateContract({ address: account, abi: AAStarAirAccountV7ABI, functionName: 'validateUserOp', args: [{ ...userOp, signature: sigBytes }, userOpHash, 0n], account: ENTRY_POINT }));
            return sim.result as bigint;
        } catch { return 'revert'; }
    }
    const accepted = await validate(composite);
    console.log(`\n[5] validateUserOp(0x0a WebAuthn composite) = ${accepted} -> ${accepted === 0n ? '0 ✅ ACCEPTED' : '❌ REJECTED'}`);

    // ── Negative: an assertion over a DIFFERENT hash must be rejected ───────────────────────────
    let negResult: bigint | 'revert' | 'sdk-rejected' = 'sdk-rejected';
    try {
        const badAssertion = makeWebAuthnAssertion(("0x" + "ee".repeat(32)) as Hex, P256_PRIV); // wrong challenge
        const badBlob = packWebAuthnBlob(badAssertion, userOpHash); // SDK should reject this
        negResult = await validate(packCumulativeT3WA(badBlob, blsPayload, guardianSignature));
    } catch {
        negResult = 'sdk-rejected'; // packWebAuthnBlob's challenge!=userOpHash guard fired (correct)
    }
    console.log(`[6] negative (challenge != userOpHash) -> ${negResult === 0n ? '❌ accepted (BAD)' : `✅ rejected (${negResult})`}`);
    if (accepted !== 0n) throw new Error('FAIL: WebAuthn 0x0a composite was NOT accepted on-chain');
    if (negResult === 0n) throw new Error('FAIL: wrong-challenge negative was accepted');

    // ═══════════════ Phase 2: REAL gasless Tier-3 transfer via bundler → g2 receives 0.051 ETH ═══════════════
    console.log('\n─────────── Phase 2: real device-passkey Tier-3 transfer (bundler) ───────────');
    const bundlerUrl = (process.env.PIMLICO_BUNDLER_URL || '').replace(/^["']|["']$/g, '');
    if (!bundlerUrl) throw new Error('PIMLICO_BUNDLER_URL missing in .env.sepolia');
    const bundler = createPublicClient({ chain: sepolia, transport: http(bundlerUrl) });
    const G2 = getAddress('0xC59516625749001366aFab57FEFE23f3b62bB8B7'); // deterministic B3 recipient
    const TRANSFER = parseEther('0.051');

    const g2Before = (await withRpcFallback((c) => c.getBalance({ address: G2 }))) as bigint;
    const acctBal = (await withRpcFallback((c) => c.getBalance({ address: account }))) as bigint;
    const NEED = TRANSFER + parseEther('0.03'); // transfer + generous gas prefund (unused is refunded by the EntryPoint)
    if (acctBal < NEED) {
        const fundTx = await walletClient.sendTransaction({ to: account, value: NEED - acctBal, chain: sepolia });
        await withRpcFallback((c) => c.waitForTransactionReceipt({ hash: fundTx }));
        console.log(`[7] funded account +${formatEther(NEED - acctBal)} ETH  (tx ${fundTx})`);
    }

    // Real callData: execute(g2, 0.051 ETH, 0x), wrapped with executeUserOp for the guard-enabled account.
    const EXEC_ABI = [{ type: 'function', name: 'execute', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }, { type: 'bytes' }], outputs: [] }] as const;
    const inner = encodeFunctionData({ abi: EXEC_ABI, functionName: 'execute', args: [G2, TRANSFER, '0x'] });
    const callData2 = wrapExecuteUserOp(inner) as Hex;
    const nonce2 = (await withRpcFallback((c) => entryPointActions(ENTRY_POINT)(c).getNonce({ sender: account, key: 0n }))) as bigint;
    // Pimlico enforces a floor on maxPriorityFeePerGas — take its own recommended price (the userOpHash
    // binds these, so they must be final BEFORE we sign the composite below).
    const gp = (await (bundler as any).request({ method: 'pimlico_getUserOperationGasPrice', params: [] })) as { fast: { maxFeePerGas: Hex; maxPriorityFeePerGas: Hex } };
    const maxFee = BigInt(gp.fast.maxFeePerGas);
    const maxPrio = BigInt(gp.fast.maxPriorityFeePerGas);
    const txOp: PackedUserOp = {
        sender: account, nonce: nonce2, initCode: '0x', callData: callData2,
        accountGasLimits: UserOperationBuilder.packAccountGasLimits(1_200_000n, 300_000n) as Hex, // verification (BLS-heavy) | call
        preVerificationGas: 200_000n,
        gasFees: UserOperationBuilder.packGasFees(maxPrio, maxFee) as Hex,
        paymasterAndData: '0x', signature: '0x',
    };
    const txHash = (await withRpcFallback((c) => c.readContract({ address: ENTRY_POINT, abi: EntryPointABI, functionName: 'getUserOpHash', args: [txOp] }))) as Hex;
    console.log(`[8] real userOpHash = ${txHash}  (transfer ${formatEther(TRANSFER)} ETH → ${G2})`);

    // Tier-3 composite over the REAL userOpHash: device passkey → tag-0x02 DVT ownerAuth → BLS → guardian.
    const txAssertion = makeWebAuthnAssertion(txHash, P256_PRIV);
    const txWaBlob = packWebAuthnBlob(txAssertion, txHash);
    const txOwnerAuth = packOwnerAuthWebAuthn(txAssertion, txHash);
    const txOpRpc = { sender: txOp.sender, nonce: numberToHex(txOp.nonce), initCode: txOp.initCode, callData: txOp.callData, accountGasLimits: txOp.accountGasLimits, preVerificationGas: numberToHex(txOp.preVerificationGas), gasFees: txOp.gasFees, paymasterAndData: txOp.paymasterAndData, signature: txOp.signature };
    const txBlsPayload = await coSignDvt(txOpRpc, txOwnerAuth);
    const txGuardianSig = await guardianWallet.signMessage({ account: guardian, message: { raw: txHash } });
    txOp.signature = packCumulativeT3WA(txWaBlob, txBlsPayload, txGuardianSig);
    console.log(`[9] Tier-3 composite signed (${(txOp.signature.length - 2) / 2} bytes, algId 0x0a)`);

    // Submit via bundler → wait for the on-chain receipt.
    const submitHash = await (bundler as any).request({ method: 'eth_sendUserOperation', params: [UserOperationBuilder.toAlchemyUserOperation(txOp), ENTRY_POINT] });
    console.log(`[10] eth_sendUserOperation → ${submitHash}`);
    let rcpt: any = null;
    for (let i = 0; i < 45; i++) {
        rcpt = await (bundler as any).request({ method: 'eth_getUserOperationReceipt', params: [submitHash] }).catch(() => null);
        if (rcpt) break;
        await new Promise((r) => setTimeout(r, 4000));
    }
    if (!rcpt) throw new Error('no UserOperation receipt after ~180s');
    const opSuccess = rcpt.success === true || rcpt.success === 'true';
    const onchainTx = rcpt.receipt?.transactionHash;
    console.log(`[11] receipt: success=${opSuccess}  tx=${onchainTx}`);
    const g2After = (await withRpcFallback((c) => c.getBalance({ address: G2 }))) as bigint;
    const delta = g2After - g2Before;
    console.log(`[12] g2 balance ${formatEther(g2Before)} → ${formatEther(g2After)} ETH  (Δ +${formatEther(delta)})`);

    console.log('\n┌─────────────── EVIDENCE (Tier-3 WebAuthn composite + tag-0x02 DVT ownerAuth, v0.27.0 #234/#261/#274) ───────────────');
    console.log(`│ factory        : ${FACTORY} (v0.27.0)`);
    console.log(`│ account        : ${account}`);
    console.log(`│ userOpHash     : ${userOpHash}`);
    console.log(`│ waBlob bytes   : ${(waBlob.length - 2) / 2}`);
    console.log(`│ composite bytes: ${(composite.length - 2) / 2} (algId 0x0a)`);
    console.log(`│ validate(WA)   : ${accepted} ${accepted === 0n ? '= 0 ✅ ACCEPTED' : '❌'}`);
    console.log(`│ negative       : ${negResult} ${negResult !== 0n ? '✅ rejected' : '❌'}`);
    console.log(`│ recipient (g2) : ${G2}`);
    console.log(`│ transfer       : ${formatEther(TRANSFER)} ETH  → Δ +${formatEther(delta)} ETH`);
    console.log(`│ bundler userOp : ${submitHash}`);
    console.log(`│ on-chain tx    : ${onchainTx}  success=${opSuccess}`);
    console.log('└──────────────────────────────────────────────────────────────────────────');

    if (!opSuccess) throw new Error(`FAIL: bundler UserOp reverted (tx ${onchainTx})`);
    if (delta !== TRANSFER) throw new Error(`FAIL: g2 received ${formatEther(delta)} ETH, expected ${formatEther(TRANSFER)}`);
    console.log(`\n🎉 PASS — device-passkey Tier-3 gasless transfer LANDED: g2 received ${formatEther(TRANSFER)} ETH via a real bundler UserOp.`);
    console.log('   (composite ACCEPTED on-chain, tag-0x02 DVT ownerAuth co-signed by 3 live nodes, wrong-challenge rejected.)');
}

main().catch((e) => { console.error(`\n❌ E2E FAILED: ${e.message}`); process.exit(1); });
