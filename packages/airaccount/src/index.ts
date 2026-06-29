export * from "./client";
export * from "./auth/passkey/types";
export * from "./auth/passkey/passkey.manager";
export * from "./core/bls/types";
export * from "./core/bls/bls.manager";
// NOTE: CryptoUtil (node:crypto AES — scrypt/createCipheriv) is intentionally NOT re-exported here.
// It's an internal Node-only util with no SDK consumer, and re-exporting it dragged node:crypto into
// every browser bundle that touched the airaccount/kms surface (#189 follow-up — YAA found 3 AES
// chunks via @aastar/sdk/kms). Import it directly from "./core/crypto/crypto.util" in Node code if
// ever needed. Browser code uses the (axios) KmsHttpClient, not the Node CryptoUtil.
export * from "./core/types";
export * from "./core/erc4337";
export * from "./core/tier";
export * from "./core/dvt-confirmation.js";
export * from "./core/contact-binding.js";
// WebAuthn cumulative signature packers (device-passkey Tier-2/3 — algId 0x09/0x0a, #234).
// Build the on-chain WebAuthn passkey factor + the cumulative composite an integrator submits.
export {
  packWebAuthnBlob,
  packCumulativeT2WA,
  packCumulativeT3WA,
  packBlsPayload,
  ALG_CUMULATIVE_T2_WA,
  ALG_CUMULATIVE_T3_WA,
} from "./migration/viem/bls-packing";
