/**
 * KMS account E2E — REAL create-account → sign business flow against the live AAStar TEE KMS,
 * driven ENTIRELY through the SDK's scenario-level API (KmsManager + P256PasskeySigner).
 *
 * This closes the gap the existing kms-e2e.live.test.ts left open: that suite covers only
 * monitoring + negative-auth and explicitly defers positive WebAuthn signing to the KMS repo's
 * hardware E2E. Here we drive the POSITIVE flow with a SOFTWARE passkey (P256PasskeySigner, the
 * #49 challenge-binding signer) — no hardware authenticator required — and prove the SDK wrapper,
 * not a hand-rolled HTTP call:
 *
 *   1. KmsManager.createKey(passkeyPubKey)        — TEE mints a secp256k1 wallet bound to the passkey.
 *   2. KmsManager.getPublicKey({KeyId})           — read the TEE-derived account address.
 *   3. KmsManager.signHashWithCeremony(hash,…)    — runs the WebAuthn challenge-binding ceremony with
 *                                                   the software passkey, TEE signs the digest.
 *   4. recoverAddress(hash, signature) == address — proves the TEE key signed (gated by the passkey).
 *   5. KmsManager.deleteKey(KeyId)                — cleanup.
 *
 * SKIPPED unless KMS_E2E=1 (it creates a real key on the live TEE). Run:
 *   KMS_E2E=1 pnpm exec tsx tests/regression/onchain-evidence/kms-account-e2e.ts
 *
 * Env: KMS_E2E (gate), KMS_E2E_ENDPOINT (default https://kms.aastar.io), KMS_E2E_API_KEY (optional).
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomBytes } from 'node:crypto';
import { keccak256, toBytes, recoverAddress, getAddress, type Hex, type Address } from 'viem';
import { secp256k1 } from '@noble/curves/secp256k1';
import { KmsManager, P256PasskeySigner } from '../../../packages/airaccount/src/server/index.js';
import { SilentLogger } from '../../../packages/airaccount/src/server/interfaces/logger.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

const ENABLED = process.env.KMS_E2E === '1';
const ENDPOINT = process.env.KMS_E2E_ENDPOINT ?? 'https://kms.aastar.io';
const API_KEY = process.env.KMS_E2E_API_KEY;

async function main() {
    if (!ENABLED) {
        console.log('⏭  KMS account E2E skipped (set KMS_E2E=1 to run against the live TEE).');
        return;
    }

    console.log(`🧪 KMS account E2E — create→sign business flow via the SDK (KmsManager) @ ${ENDPOINT}`);

    // The scenario-level API under test.
    const kms = new KmsManager({ kmsEndpoint: ENDPOINT, kmsEnabled: true, kmsApiKey: API_KEY, logger: new SilentLogger() });

    // Software passkey (P256) — the SDK's P256PasskeySigner stands in for a hardware authenticator.
    const passkeyPriv = randomBytes(32);
    const signer = new P256PasskeySigner(passkeyPriv);
    const passkeyPublicKey = signer.publicKeyHex;
    console.log(`   passkey pubkey (P256, uncompressed): ${passkeyPublicKey.slice(0, 26)}…`);

    let keyId: string | undefined;
    try {
        // ── 1. createKey — TEE mints a secp256k1 wallet bound to the passkey ──
        const created = await kms.createKey('aastar-sdk e2e create→sign', passkeyPublicKey);
        keyId = created.KeyMetadata.KeyId;
        console.log(`\n   1. createKey → KeyId=${keyId}`);
        console.log(`      enabled=${created.KeyMetadata.Enabled} usage=${created.KeyMetadata.KeyUsage}`);

        // ── 2. getPublicKey — read the TEE secp256k1 pubkey → derive the account address ──
        const pub = await kms.getPublicKey({ KeyId: keyId });
        const pubHex = (pub.PublicKey.startsWith('0x') ? pub.PublicKey : `0x${pub.PublicKey}`) as Hex;
        // The TEE returns a COMPRESSED secp256k1 pubkey (0x02/0x03…). Decompress to the 65-byte
        // uncompressed form, then EVM address = last 20 bytes of keccak256(pubkey without 0x04).
        const uncompressed = secp256k1.ProjectivePoint.fromHex(pubHex.slice(2)).toHex(false); // '04'+64 bytes
        const address = pub.Address
            ? getAddress(pub.Address as Address)
            : getAddress(`0x${keccak256(`0x${uncompressed.slice(2)}` as Hex).slice(-40)}` as Address);
        console.log(`\n   2. getPublicKey → pubkey=${pubHex.slice(0, 26)}… → account address=${address}`);

        // ── 3. signHashWithCeremony — challenge-binding ceremony (software passkey) + TEE sign ──
        const message = `aastar-sdk kms-e2e ${keyId}`;
        const hash = keccak256(toBytes(message)) as Hex;
        const signed = await kms.signHashWithCeremony(hash, { KeyId: keyId }, signer);
        const signature = (signed.Signature.startsWith('0x') ? signed.Signature : `0x${signed.Signature}`) as Hex;
        console.log(`\n   3. signHashWithCeremony → signature=${signature.slice(0, 26)}… (${(signature.length - 2) / 2} bytes)`);

        // ── 4. recover — the signature over `hash` must recover the TEE address ──
        const recovered = getAddress(await recoverAddress({ hash, signature }));
        console.log(`\n   4. recoverAddress(hash, signature) = ${recovered}`);
        const ok = recovered === address;
        console.log(`      ${ok ? '✅' : '❌'} recovered == TEE address (${ok ? 'MATCH' : 'MISMATCH'})`);
        if (!ok) throw new Error(`recovered ${recovered} != TEE address ${address}`);

        console.log('\n──────────────────────────── EVIDENCE (KMS create→sign) ────────────────────────────');
        console.log(`   endpoint  : ${ENDPOINT}`);
        console.log(`   KeyId     : ${keyId}`);
        console.log(`   address   : ${address}`);
        console.log(`   message   : "${message}"`);
        console.log(`   hash      : ${hash}`);
        console.log(`   signature : ${signature}`);
        console.log(`   recovered : ${recovered} ✅`);
        console.log('─────────────────────────────────────────────────────────────────────────────────────');
        console.log('\n🎉 PASS — SDK-driven KMS create-account + WebAuthn-gated TEE signature verified (recovers to the TEE address).');
    } finally {
        // ── 5. cleanup — WebAuthn-gated delete of the test key (via the same passkey ceremony) ──
        if (keyId) {
            try {
                const assertion = await kms.runAuthenticationCeremony(keyId, signer);
                await kms.deleteKey({ KeyId: keyId, WebAuthn: assertion });
                console.log(`\n   5. deleteKey(${keyId}) — scheduled deletion (WebAuthn-gated).`);
            } catch (e: any) {
                console.warn(`\n   ⚠️  deleteKey failed (test key ${keyId} may need manual cleanup): ${e?.message || e}`);
            }
        }
    }
}

main().catch((e) => {
    console.error('\n❌ KMS account E2E FAILED:', e?.shortMessage || e?.message || e);
    if (e?.response?.data) console.error('   server:', JSON.stringify(e.response.data).slice(0, 300));
    process.exit(1);
});
