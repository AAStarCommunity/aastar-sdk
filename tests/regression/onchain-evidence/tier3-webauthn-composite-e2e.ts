/**
 * Tier-3 WebAuthn cumulative composite (algId 0x0a) — full on-chain E2E on Sepolia (v0.21.0).
 *
 * Proves the device-passkey path: the SDK-assembled Tier-3 composite — on-chain WebAuthn P256
 * (passkey) + DVT BLS aggregate + guardian ECDSA — is ACCEPTED by the deployed v0.21.0 AirAccount
 * (`_validateCumulativeTier3` WebAuthn variant, algId 0x0a). This is the device-passkey acceptance
 * for aastar-sdk#234 / airaccount-contract#147/#148.
 *
 * The "device passkey" is simulated with a software P-256 key (registered via setP256Key), and a
 * SYNTHETIC WebAuthn assertion is built exactly as `navigator.credentials.get()` produces it:
 *   - clientDataJSON = `{"type":"webauthn.get","challenge":"` + base64url(userOpHash) + suffix
 *   - the key signs sha256(authenticatorData ‖ sha256(clientDataJSON))  (ECDSA-SHA256)
 * so the on-chain WebAuthn reconstruction + P256VERIFY (0x100 precompile) passes — no browser needed.
 *
 * Flow (all live): deploy via the v0.21.0 factory (approvedAlgIds=[0x0a]) → setValidator + setP256Key
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
// SDK packers UNDER TEST (WebAuthn cumulative, algId 0x0a).
import {
    packWebAuthnBlob,
    packCumulativeT3WA,
    packBlsPayload,
} from '../../../packages/airaccount/src/migration/viem/bls-packing';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

const SEPOLIA = 11155111;
const FACTORY = getAddress(CANONICAL_ADDRESSES[SEPOLIA].airAccountFactoryV7); // v0.21.0
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

async function main() {
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log(' Tier-3 WebAuthn cumulative (0x0a) E2E — passkey + DVT BLS + guardian, Sepolia v0.21.0 (#234)');
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
    console.log(`\n[0a] factory(v0.21.0)=${FACTORY}  owner=${owner.address}  guardian=${guardian.address}`);

    // ── Deploy a fresh account approving algId 0x0a, with the guardian ──────────────────────────
    const config = buildInitConfig({ guardians: [{ ecdsa: guardian.address }], dailyLimit: 10n ** 18n, approvedAlgIds: [ALG_CUMULATIVE_T3_WA] });
    const account = (await withRpcFallback((c) =>
        airAccountFactoryActions(FACTORY)(c).getAddress({ owner: owner.address, salt: SALT, config })
    )) as Address;
    console.log(`[0b] account = ${account}`);
    const code = await withRpcFallback((c) => c.getCode({ address: account }));
    if (code && code !== '0x') {
        console.log('     already deployed ✓');
    } else {
        const tx = await airAccountFactoryActions(FACTORY)(walletClient).createAccount({ owner: owner.address, salt: SALT, config, account: owner });
        const r = await withRpcFallback((c) => c.waitForTransactionReceipt({ hash: tx }));
        console.log(`     deploy tx=${tx} status=${r.status}`);
        if (r.status !== 'success') throw new Error('deploy reverted');
    }

    // ── setValidator (set-once) + register the passkey via setP256Key ───────────────────────────
    const curValidator = (await withRpcFallback((c) => c.readContract({ address: account, abi: AAStarAirAccountV7ABI, functionName: 'validator' }))) as Address;
    if (curValidator === '0x0000000000000000000000000000000000000000') {
        const tx = await walletClient.writeContract({ address: account, abi: AAStarAirAccountV7ABI, functionName: 'setValidator', args: [VALIDATOR_ROUTER], chain: sepolia });
        await withRpcFallback((c) => c.waitForTransactionReceipt({ hash: tx }));
        console.log(`[0c] setValidator ✓`);
    } else console.log(`[0c] validator already set`);
    const curX = (await withRpcFallback((c) => c.readContract({ address: account, abi: AAStarAirAccountV7ABI, functionName: 'p256KeyX' }))) as Hex;
    if (curX === ZERO_BYTES32) {
        const tx = await walletClient.writeContract({ address: account, abi: AAStarAirAccountV7ABI, functionName: 'setP256Key', args: [p256X, p256Y], chain: sepolia });
        await withRpcFallback((c) => c.waitForTransactionReceipt({ hash: tx }));
        console.log(`     setP256Key ✓ (x=${p256X.slice(0, 14)}…)`);
    } else console.log(`     p256Key already set`);

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
    const ownerAuth = await walletClient.signMessage({ account: owner, message: { raw: userOpHash } });
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

    console.log('\n┌─────────────── EVIDENCE (Tier-3 WebAuthn composite, v0.21.0 #234) ───────────────');
    console.log(`│ factory        : ${FACTORY} (v0.21.0)`);
    console.log(`│ account        : ${account}`);
    console.log(`│ userOpHash     : ${userOpHash}`);
    console.log(`│ waBlob bytes   : ${(waBlob.length - 2) / 2}`);
    console.log(`│ composite bytes: ${(composite.length - 2) / 2} (algId 0x0a)`);
    console.log(`│ validate(WA)   : ${accepted} ${accepted === 0n ? '= 0 ✅ ACCEPTED' : '❌'}`);
    console.log(`│ negative       : ${negResult} ${negResult !== 0n ? '✅ rejected' : '❌'}`);
    console.log('└──────────────────────────────────────────────────────────────────────────');

    if (accepted !== 0n) throw new Error('FAIL: WebAuthn 0x0a composite was NOT accepted on-chain');
    if (negResult === 0n) throw new Error('FAIL: wrong-challenge negative was accepted');
    console.log('\n🎉 PASS — Tier-3 WebAuthn composite ACCEPTED on-chain; wrong-challenge rejected.');
}

main().catch((e) => { console.error(`\n❌ E2E FAILED: ${e.message}`); process.exit(1); });
