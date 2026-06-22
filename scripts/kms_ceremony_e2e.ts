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
import { createPublicClient, http, hashMessage } from "viem";
import { sepolia } from "viem/chains";
import {
  KmsManager,
  P256PasskeySigner,
  grantSessionFinalHash,
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

  // 2d. signTypedDataWithCeremony — proves the SDK's EIP-712 digest matches the KMS host-side
  // digest (else the commitment SHA256(nonce‖digest) wouldn't verify). A signature back = match.
  try {
    const td = {
      keyId,
      domain: { name: "Mail", version: "1", chainId: 11155111, verifyingContract: ("0x" + "11".repeat(20)) },
      primaryType: "Mail",
      types: [{ name: "Mail", fields: [{ name: "from", type: "address" }, { name: "amount", type: "uint256" }] }],
      message: [{ name: "from", value: ("0x" + "22".repeat(20)) }, { name: "amount", value: "1000" }],
    };
    const res = await kms.signTypedDataWithCeremony(td as any, signer);
    rec("signTypedDataWithCeremony (EIP-712 commitment)", !!res.signature, `sig=${(res.signature || "").slice(0, 16)}…`);
  } catch (e: any) {
    rec("signTypedDataWithCeremony (EIP-712 commitment)", false, e?.response?.data ? JSON.stringify(e.response.data) : e.message);
  }

  // 2e. Payment convenience signers with commitment — proves the SDK's per-schema EIP-712
  // digest matches the KMS host-side schema (else the commitment wouldn't verify).
  const { KmsPaymentSigner } = await import("../packages/airaccount/src/server/index.js");
  const pay = new KmsPaymentSigner((kms as any).httpClient);
  try {
    const r = await pay.signMicropaymentVoucherWithCeremony(
      { keyId, chainId: 11155111, verifyingContract: ("0x" + "33".repeat(20)), channelId: ("0x" + "44".repeat(32)), cumulativeAmount: "1000000" },
      signer
    );
    rec("signMicropaymentVoucherWithCeremony (commitment)", !!r.signature, `sig=${(r.signature || "").slice(0, 16)}…`);
  } catch (e: any) {
    rec("signMicropaymentVoucherWithCeremony (commitment)", false, e?.response?.data ? JSON.stringify(e.response.data) : e.message);
  }
  try {
    const r = await pay.signX402PaymentWithCeremony(
      { keyId, chainId: 11155111, verifyingContract: ("0x" + "55".repeat(20)), paymentId: ("0x" + "66".repeat(32)), amount: "2000000", recipient: ("0x" + "77".repeat(20)), deadline: "9999999999" },
      signer
    );
    rec("signX402PaymentWithCeremony (commitment)", !!r.signature, `sig=${(r.signature || "").slice(0, 16)}…`);
  } catch (e: any) {
    rec("signX402PaymentWithCeremony (commitment)", false, e?.response?.data ? JSON.stringify(e.response.data) : e.message);
  }

  // 2f. Grant-session final_hash ORACLE: the SDK's off-chain grantSessionFinalHash must equal
  // toEthSignedMessageHash(contract.buildGrantHash(...)) — proves the abi.encode (incl. the
  // tricky address[]/bytes4[] packed hashes + nonce/chainId/verifyingContract) is byte-exact
  // vs SessionKeyValidator.sol, which the KMS TA mirrors (AirAccount#112). No KMS call needed.
  try {
    const VALIDATOR = "0x6810CfB7c72D16e044a17694fAa8076e517264D0"; // core sepolia sessionKeyValidator
    const ACCT = ("0x" + "12".repeat(20)) as `0x${string}`;
    const SK = ("0x" + "34".repeat(20)) as `0x${string}`;
    // NON-EMPTY arrays — the empty-array case masked the three-way packing bug (#137 review).
    // Proves SDK grantSessionFinalHash == contract buildGrantHash even with populated
    // callTargets/selectorAllowlist (viem encodePacked pads address[]/bytes4[] to 32, = Solidity).
    const cfg = {
      expiry: 9999999999, contractScope: ("0x" + "00".repeat(20)) as `0x${string}`,
      selectorScope: "0x00000000" as `0x${string}`, revoked: false,
      velocityLimit: 0, velocityWindow: 0,
      callTargets: [("0x" + "aa".repeat(20)), ("0x" + "bb".repeat(20))] as `0x${string}`[],
      selectorAllowlist: ["0xdeadbeef", "0x12345678"] as `0x${string}`[],
    };
    const pc = createPublicClient({ chain: sepolia, transport: http("https://ethereum-sepolia-rpc.publicnode.com") });
    const buildGrantHashAbi = [{
      type: "function", name: "buildGrantHash", stateMutability: "view",
      inputs: [
        { name: "account", type: "address" }, { name: "sessionKey", type: "address" },
        { name: "cfg", type: "tuple", components: [
          { name: "expiry", type: "uint48" }, { name: "contractScope", type: "address" },
          { name: "selectorScope", type: "bytes4" }, { name: "revoked", type: "bool" },
          { name: "velocityLimit", type: "uint16" }, { name: "velocityWindow", type: "uint32" },
          { name: "callTargets", type: "address[]" }, { name: "selectorAllowlist", type: "bytes4[]" },
        ] },
      ],
      outputs: [{ type: "bytes32" }],
    }] as const;
    // SessionKeyValidator._buildGrantHash ALREADY returns inner.toEthSignedMessageHash(),
    // so buildGrantHash() output IS the final_hash — compare directly (no extra prefix).
    const expectedFinal = await pc.readContract({ address: VALIDATOR, abi: buildGrantHashAbi, functionName: "buildGrantHash", args: [ACCT, SK, cfg] }) as `0x${string}`;
    const myFinal = grantSessionFinalHash({
      chainId: 11155111, verifyingContract: VALIDATOR, account: ACCT, sessionKey: SK,
      expiry: cfg.expiry, contractScope: cfg.contractScope, selectorScope: cfg.selectorScope,
      velocityLimit: 0, velocityWindow: 0, callTargets: cfg.callTargets, selectorAllowlist: cfg.selectorAllowlist, nonce: 0,
    });
    rec("grant final_hash matches contract buildGrantHash (oracle)", myFinal === expectedFinal,
      myFinal === expectedFinal ? "byte-exact" : `MISMATCH mine=${myFinal} contract=${expectedFinal}`);
  } catch (e: any) {
    rec("grant final_hash matches contract buildGrantHash (oracle)", false, e?.shortMessage || e.message);
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
