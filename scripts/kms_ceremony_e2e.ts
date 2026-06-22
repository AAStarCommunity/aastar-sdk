/**
 * Live KMS E2E — proves the new WebAuthn-ceremony + payload-commitment signing path
 * (PR #131 + #133) works against the REAL KMS (kms.aastar.io), not just unit mocks.
 *
 * Flow: CreateKey(passkey=P256 pubkey) → ceremony with SHA256(nonce‖hash) commitment →
 * /SignHash (WebAuthn) → expect a signature. Also checks legacy signHash is rejected.
 *
 * Run: KMS_E2E=1 pnpm exec tsx scripts/kms_ceremony_e2e.ts
 * Needs: ~/Dev/.env KMS_E2E_API_KEY ; endpoint default https://kms.aastar.io
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { p256 } from "@noble/curves/nist.js";
import {
  KmsManager,
  P256PasskeySigner,
} from "../packages/airaccount/src/server/index.js";

function envFrom(path: string, key: string): string | undefined {
  try {
    const m = readFileSync(path, "utf8").match(new RegExp(`^${key}=(.*)$`, "m"));
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : undefined;
  } catch {
    return undefined;
  }
}

const ENDPOINT = process.env.KMS_E2E_ENDPOINT ?? "https://kms.aastar.io";
const API_KEY = process.env.KMS_E2E_API_KEY ?? envFrom(resolve(homedir(), "Dev/.env"), "KMS_E2E_API_KEY");
if (!API_KEY) throw new Error("KMS_E2E_API_KEY not found (env or ~/Dev/.env)");

const results: Array<{ step: string; ok: boolean; detail: string }> = [];
const rec = (step: string, ok: boolean, detail: string) => {
  results.push({ step, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${step} — ${detail}`);
};

async function main() {
  console.log("=== KMS ceremony+commitment E2E ===");
  console.log("endpoint:", ENDPOINT);

  const kms = new KmsManager({ kmsEndpoint: ENDPOINT, kmsApiKey: API_KEY, kmsEnabled: true });

  // Fresh P-256 passkey acting as the authenticator (server-held).
  const priv = p256.utils.randomSecretKey();
  const credentialId = "sdk-e2e-" + Buffer.from(priv.slice(0, 8)).toString("hex");
  const signer = new P256PasskeySigner(priv, credentialId);

  // 1. CreateKey bound to this passkey pubkey.
  let keyId: string;
  try {
    const res = await kms.createKey("sdk-ceremony-e2e", signer.publicKeyHex);
    keyId = res.KeyMetadata.KeyId;
    rec("createKey", !!keyId, `KeyId=${keyId}`);
  } catch (e: any) {
    rec("createKey", false, e?.response?.data ? JSON.stringify(e.response.data) : e.message);
    return finish();
  }

  // A 32-byte payload digest to sign.
  const hash = "0x" + "5c".repeat(32);

  // 2a. Ceremony with RAW NONCE (PR #131 path — what the current transition-mode KMS expects).
  try {
    const assertion = await kms.runAuthenticationCeremony(keyId, signer); // no payload → raw nonce
    const res = await kms.signHashWithWebAuthn(hash, assertion.ChallengeId, assertion.Credential, { KeyId: keyId });
    rec("ceremony RAW-NONCE SignHash (#131)", !!res.Signature, `sig=${(res.Signature || "").slice(0, 24)}…`);
  } catch (e: any) {
    rec("ceremony RAW-NONCE SignHash (#131)", false, e?.response?.data ? JSON.stringify(e.response.data) : e.message);
  }

  // 2b. Ceremony with COMMITMENT (PR #133 path — SHA256(nonce‖hash)). Expected to FAIL on the
  // current KMS because the HOST verify (api_server.rs:1697) still checks the raw nonce, not the
  // commitment — host/TA disagreement; strict is unreachable until the KMS host is fixed.
  try {
    // signCount defaults to a monotonic value (anti-clone) — don't hardcode it.
    const assertion = await kms.runAuthenticationCeremony(keyId, signer, { payload: hash as `0x${string}` });
    const res = await kms.signHashWithWebAuthn(hash, assertion.ChallengeId, assertion.Credential, { KeyId: keyId });
    rec("ceremony COMMITMENT SignHash (#133)", !!res.Signature, `sig=${(res.Signature || "").slice(0, 24)}…`);
  } catch (e: any) {
    rec("ceremony COMMITMENT SignHash (#133)", false, e?.response?.data ? JSON.stringify(e.response.data) : e.message);
  }

  // 2c. signHashWithCeremony TWICE on the same key (Phase 1: auto-commit + monotonic signCount).
  // Both must succeed — proves commitment is auto-bound and signCount strictly increases
  // (no "signCount not incremented" anti-clone reject between two server-held signatures).
  try {
    const h1 = ("0x" + "1a".repeat(32)) as `0x${string}`;
    const h2 = ("0x" + "2b".repeat(32)) as `0x${string}`;
    const r1 = await kms.signHashWithCeremony(h1, { KeyId: keyId }, signer);
    const r2 = await kms.signHashWithCeremony(h2, { KeyId: keyId }, signer);
    rec("signHashWithCeremony ×2 (auto-commit + monotonic signCount)", !!r1.Signature && !!r2.Signature,
      `sig1=${(r1.Signature || "").slice(0, 12)}… sig2=${(r2.Signature || "").slice(0, 12)}…`);
  } catch (e: any) {
    rec("signHashWithCeremony ×2 (auto-commit + monotonic signCount)", false, e?.response?.data ? JSON.stringify(e.response.data) : e.message);
  }

  // 3. Negative: legacy raw passkey assertion must be rejected (KMS strict-on-legacy).
  try {
    await kms.signHash(hash, { AuthenticatorData: "0x00", ClientDataHash: "0x00", Signature: "0x00" } as any, { KeyId: keyId });
    rec("legacy signHash rejected", false, "UNEXPECTED: legacy accepted (KMS_ALLOW_LEGACY_PASSKEY=1?)");
  } catch (e: any) {
    const msg = e?.response?.data ? JSON.stringify(e.response.data) : e.message;
    rec("legacy signHash rejected", /legacy|passkey|challenge|400|reject/i.test(msg), msg.slice(0, 80));
  }

  finish();
}

function finish() {
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n=== SUMMARY: ${pass}/${results.length} OK ===`);
  process.exit(pass === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL", e?.response?.data ?? e);
  process.exit(1);
});
