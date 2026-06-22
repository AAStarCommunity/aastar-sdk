import { describe, it, expect } from "vitest";
import { grantSessionFinalHash } from "../services/kms-signer";

// grantSessionFinalHash mirrors SessionKeyValidator.buildGrantHash byte-for-byte (the
// WYSIWYS commitment payload for the grant ceremony, AirAccount #112). Byte-exactness vs
// the live contract is proven by the E2E oracle (scripts/kms_ceremony_e2e.ts, 9/9). Here we
// just lock determinism + the secp256k1/P256 domain separation so a regression is caught.

const base = {
  chainId: 11155111,
  verifyingContract: ("0x" + "68".repeat(20)) as `0x${string}`,
  account: ("0x" + "12".repeat(20)) as `0x${string}`,
  expiry: 9999999999,
  contractScope: ("0x" + "00".repeat(20)) as `0x${string}`,
  selectorScope: "0x00000000" as `0x${string}`,
  velocityLimit: 0,
  velocityWindow: 0,
  callTargets: [] as `0x${string}`[],
  selectorAllowlist: [] as `0x${string}`[],
  nonce: 0,
};

describe("grantSessionFinalHash", () => {
  it("is a deterministic 32-byte hash (secp256k1)", () => {
    const a = grantSessionFinalHash({ ...base, sessionKey: ("0x" + "34".repeat(20)) as `0x${string}` });
    const b = grantSessionFinalHash({ ...base, sessionKey: ("0x" + "34".repeat(20)) as `0x${string}` });
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("binds the session key — different key ⇒ different hash", () => {
    const a = grantSessionFinalHash({ ...base, sessionKey: ("0x" + "34".repeat(20)) as `0x${string}` });
    const b = grantSessionFinalHash({ ...base, sessionKey: ("0x" + "56".repeat(20)) as `0x${string}` });
    expect(a).not.toBe(b);
  });

  it("secp256k1 and P256 domains produce different hashes (GRANT_SESSION_V2 vs GRANT_P256_SESSION_V2)", () => {
    const k1 = grantSessionFinalHash({ ...base, sessionKey: ("0x" + "34".repeat(20)) as `0x${string}` });
    const p256 = grantSessionFinalHash({ ...base, keyX: ("0x" + "34".repeat(32)) as `0x${string}`, keyY: ("0x" + "56".repeat(32)) as `0x${string}` });
    expect(k1).not.toBe(p256);
  });

  it("binds the nonce", () => {
    const n0 = grantSessionFinalHash({ ...base, sessionKey: ("0x" + "34".repeat(20)) as `0x${string}`, nonce: 0 });
    const n1 = grantSessionFinalHash({ ...base, sessionKey: ("0x" + "34".repeat(20)) as `0x${string}`, nonce: 1 });
    expect(n0).not.toBe(n1);
  });
});
