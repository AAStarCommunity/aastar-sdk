import { describe, it, expect } from "vitest";
import { mintDigest } from "../services/kms-signer";
import { commitChallenge, base64UrlEncode } from "../services/webauthn-ceremony";

// Locked test vectors from the KMS (aastar-sdk#135) — mintDigest MUST stay byte-identical
// to the TA's agent_mint_digest / p256_session_mint_digest (ta/src/main.rs):
//   mint_digest = SHA256( tag ‖ walletId[16B UUID] ‖ index[u32 BE] ‖ ttlSecs[i64 BE] ‖ SHA256(subject) )
//   challenge   = base64url_nopad( SHA256( nonce ‖ mint_digest ) )
const VEC = {
  walletId: "495c2e73-b688-46de-bab2-1af39ac0802c",
  index: 0,
  ttlSecs: 259200,
  subject: "test-wallet-id",
} as const;
// nonce = 32 × 0x42
const NONCE_B64 = base64UrlEncode(new Uint8Array(32).fill(0x42));

describe("mintDigest (KMS #115 locked vectors)", () => {
  it("agent (AA-AGENT-MINT-v1) digest + commitment match the locked vector", () => {
    const digest = mintDigest({ kind: "agent", ...VEC });
    expect(digest).toBe("0x94ce635e81b92c07c323c9b6d2c1a0d739aa1d75d9f03f4be9d251aa9136e895");
    // commitment(hex) = 50abfb4f...
    const commitB64 = commitChallenge(NONCE_B64, digest);
    expect(Buffer.from(commitB64, "base64url").toString("hex")).toBe(
      "50abfb4fcedcd299b1822f31fbb9162ecf42e3d0b6ebdd52f5347c3b30bf79a6"
    );
  });

  it("p256 (AA-P256-SESSION-MINT-v1) digest + commitment match the locked vector", () => {
    const digest = mintDigest({ kind: "p256", ...VEC });
    expect(digest).toBe("0xc7e22dd175107e93dce31db68e64a56823f5c895d93647e9ce1a9af0ae8a063b");
    const commitB64 = commitChallenge(NONCE_B64, digest);
    expect(Buffer.from(commitB64, "base64url").toString("hex")).toBe(
      "e3c80677c5c7554e4c64c85fc574c13f95b1a6377374cd37850b097ca0246ad6"
    );
  });

  it("binds each field (agent≠p256, index, ttl, subject all change the digest)", () => {
    const base = mintDigest({ kind: "agent", ...VEC });
    expect(mintDigest({ kind: "p256", ...VEC })).not.toBe(base);
    expect(mintDigest({ kind: "agent", ...VEC, index: 1 })).not.toBe(base);
    expect(mintDigest({ kind: "agent", ...VEC, ttlSecs: 1 })).not.toBe(base);
    expect(mintDigest({ kind: "agent", ...VEC, subject: "other" })).not.toBe(base);
  });

  it("rejects a non-UUID walletId and out-of-range index", () => {
    expect(() => mintDigest({ kind: "agent", ...VEC, walletId: "nope" })).toThrow(/UUID/);
    expect(() => mintDigest({ kind: "agent", ...VEC, index: -1 })).toThrow(/uint32/);
  });
});
