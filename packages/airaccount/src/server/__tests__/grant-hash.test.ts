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

  // #137 regression: NON-EMPTY callTargets/selectorAllowlist. The empty-array case masked a
  // three-way packing divergence (contract/SDK pad address[]/bytes4[] to 32 bytes; the KMS TA
  // tight-packed to 20). These snapshots are the PAD-32 values, verified byte-exact against the
  // live contract buildGrantHash (E2E oracle). A regression to tight-pack would change them.
  const scoped = {
    ...base,
    verifyingContract: "0x6810CfB7c72D16e044a17694fAa8076e517264D0" as `0x${string}`,
    callTargets: [("0x" + "aa".repeat(20)) as `0x${string}`, ("0x" + "bb".repeat(20)) as `0x${string}`],
    selectorAllowlist: ["0xdeadbeef" as `0x${string}`, "0x12345678" as `0x${string}`],
  };

  it("non-empty arrays use pad-32 packing (matches contract; #137 regression lock)", () => {
    const k1 = grantSessionFinalHash({ ...scoped, sessionKey: ("0x" + "34".repeat(20)) as `0x${string}` });
    const p256 = grantSessionFinalHash({ ...scoped, keyX: ("0x" + "34".repeat(32)) as `0x${string}`, keyY: ("0x" + "56".repeat(32)) as `0x${string}` });
    expect(k1).toMatchInlineSnapshot(`"0x578ce6da8e25bb3423b2dcfe73771af540f5de8b62432a68b660b09fad76c17d"`);
    expect(p256).toMatchInlineSnapshot(`"0x6b9815da68d2a3b212592f5c76aa54215c6712f72fda153e55d870ce6df95bf9"`);
    // populated arrays must change the hash vs empty (proves they're actually folded in)
    const empty = grantSessionFinalHash({ ...scoped, callTargets: [], selectorAllowlist: [], sessionKey: ("0x" + "34".repeat(20)) as `0x${string}` });
    expect(k1).not.toBe(empty);
  });
});
