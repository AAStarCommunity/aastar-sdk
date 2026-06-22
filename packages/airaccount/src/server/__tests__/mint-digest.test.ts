import { describe, it, expect } from "vitest";
import { mintDigest } from "../services/kms-signer";
import { commitChallenge, base64UrlEncode } from "../services/webauthn-ceremony";

// Locked test vectors from the KMS (aastar-sdk#135, KMS v0.26.0 — "v2 label" mint binding).
// mintDigest MUST stay byte-identical to the TA; authority is AirAccount
// kms/docs/test-vectors/compute_vectors.py:
//   create-agent : SHA256("AA-AGENT-MINT-v2"        ‖ walletId[16] ‖ SHA256(label))
//   create-p256  : SHA256("AA-P256-SESSION-MINT-v2" ‖ walletId[16] ‖ SHA256(label))
//   refresh-agent: SHA256("AA-AGENT-REFRESH-v2"     ‖ walletId[16] ‖ agentIndex[u32 BE])
//   challenge    = base64url_nopad( SHA256( nonce ‖ mint_digest ) )
const WALLET = "495c2e73-b688-46de-bab2-1af39ac0802c";
// nonce = 32 × 0x42
const NONCE_B64 = base64UrlEncode(new Uint8Array(32).fill(0x42));

describe("mintDigest v2 (KMS #135 locked vectors)", () => {
  it("create-agent (AA-AGENT-MINT-v2) digest + commitment match the locked vector", () => {
    const digest = mintDigest({ kind: "create-agent", walletId: WALLET, label: "my-agent" });
    expect(digest).toBe("0x96ef1919c2daf5f019d612a4ffd6c9afbe893994bd4069f5bfb7a84cbb9a59ad");
    expect(commitChallenge(NONCE_B64, digest)).toBe("vfFryvH9S58RQI-XmcBeocd1mhNWSYP3z5p6B3M7rgc");
  });

  it("create-p256 (AA-P256-SESSION-MINT-v2) digest + commitment match the locked vector", () => {
    const digest = mintDigest({ kind: "create-p256", walletId: WALLET, label: "my-session" });
    expect(digest).toBe("0x9a3d0109308632dc28c28a773bcfb2dd4f3a72372b7c5b6d5bc8595d1f1b623e");
    expect(commitChallenge(NONCE_B64, digest)).toBe("JDwM5V4rmHTPvvhdBt0GB0OwtuCoPemVbTkw04EmkJE");
  });

  it("refresh-agent (AA-AGENT-REFRESH-v2) digest + commitment match the locked vector", () => {
    const digest = mintDigest({ kind: "refresh-agent", walletId: WALLET, agentIndex: 0 });
    expect(digest).toBe("0xb691fbf5c2999e32b5f5c1f16038600e91d6e7db67dc3b069c257e957280217d");
    expect(commitChallenge(NONCE_B64, digest)).toBe("Kv6zy_gztqOYGD3NMI118EOavjjlWaMakD3uxoseiZU");
  });

  it("binds each field: agent≠p256, create≠refresh, label and agentIndex change the digest", () => {
    const agent = mintDigest({ kind: "create-agent", walletId: WALLET, label: "my-agent" });
    expect(mintDigest({ kind: "create-p256", walletId: WALLET, label: "my-agent" })).not.toBe(agent);
    // CREATE and REFRESH tags must not collide (refresh gesture can't be replayed as a mint)
    expect(mintDigest({ kind: "refresh-agent", walletId: WALLET, agentIndex: 0 })).not.toBe(agent);
    expect(mintDigest({ kind: "create-agent", walletId: WALLET, label: "other" })).not.toBe(agent);
    expect(mintDigest({ kind: "refresh-agent", walletId: WALLET, agentIndex: 1 })).not.toBe(
      mintDigest({ kind: "refresh-agent", walletId: WALLET, agentIndex: 0 })
    );
  });

  it("rejects a non-UUID walletId and out-of-range agentIndex", () => {
    expect(() => mintDigest({ kind: "create-agent", walletId: "nope", label: "x" })).toThrow(/UUID/);
    expect(() => mintDigest({ kind: "refresh-agent", walletId: WALLET, agentIndex: -1 })).toThrow(/uint32/);
  });
});
