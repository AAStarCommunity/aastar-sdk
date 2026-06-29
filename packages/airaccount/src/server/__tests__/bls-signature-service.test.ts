import { describe, it, expect, vi } from "vitest";
import {
  BLSSignatureService,
  DvtPendingConfirmationError,
  isPendingConfirmation,
} from "../services/bls-signature-service";

describe("DvtPendingConfirmationError (DVT v1.3.0 pending_confirmation)", () => {
  it("carries the userOpHash + node endpoint and a descriptive message", () => {
    const err = new DvtPendingConfirmationError("0xabc123", "https://node1.example:3001");

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("DvtPendingConfirmationError");
    expect(err.userOpHash).toBe("0xabc123");
    expect(err.nodeEndpoint).toBe("https://node1.example:3001");
    expect(err.message).toContain("0xabc123");
    expect(err.message).toContain("https://node1.example:3001");
    expect(err.message).toContain("/signature/confirm");
  });

  it("is distinguishable from a generic Error via instanceof (so callers can branch on it)", () => {
    const pending: unknown = new DvtPendingConfirmationError("0x1", "n");
    const generic: unknown = new Error("network down");

    expect(pending instanceof DvtPendingConfirmationError).toBe(true);
    expect(generic instanceof DvtPendingConfirmationError).toBe(false);
  });
});

describe("generateTieredSignature — Tier 1 is a no-op vs inline ECDSA (#235 review F1)", () => {
  // The precedence fix sets `useECDSA=false` for ALL non-null tiers, including tier=1, on the claim
  // that generateTieredSignature(tier=1) emits the SAME bytes as the inline-ECDSA path (raw 65-byte
  // ECDSA, no algId prefix — the account accepts it as algId 0x02 implied). This pins that claim so a
  // future change that prefixed an algId for tier-1 (which would break tier-1 tiered calls) is caught.
  it("returns the raw owner ECDSA (no algId prefix, not 0x04/0x05) for tier 1", async () => {
    const RAW_ECDSA = ("0x" + "ab".repeat(65)) as `0x${string}`; // 65-byte owner sig
    const signMessage = vi.fn().mockResolvedValue(RAW_ECDSA);
    const storage = {
      getBlsConfig: vi.fn().mockResolvedValue(undefined),
      findAccountByUserId: vi.fn().mockResolvedValue({ signerAddress: "0x" + "11".repeat(20) }),
    };
    const svc = new BLSSignatureService(
      { blsSeedNodes: [] } as any,
      {} as any, // ethereum (unused on the tier-1 path)
      storage as any,
      { signMessage } as any
    );

    const out = await svc.generateTieredSignature({
      tier: 1 as any,
      userId: "u1",
      userOpHash: "0x" + "cd".repeat(32),
    });

    expect(out).toBe(RAW_ECDSA); // identical to inline ECDSA — no algId prefix
    expect(out.slice(0, 4)).not.toBe("0x04"); // not a cumulative T2
    expect(out.slice(0, 4)).not.toBe("0x05"); // not a cumulative T3
    expect((out.length - 2) / 2).toBe(65); // exactly the 65-byte ECDSA, no extra bytes
  });
});

describe("isPendingConfirmation (the detection used at every /signature/sign call site)", () => {
  it("detects a v1.3.0 withhold response and narrows userOpHash", () => {
    const resp = { status: "pending_confirmation", userOpHash: "0xdead" };
    expect(isPendingConfirmation(resp)).toBe(true);
    if (isPendingConfirmation(resp)) {
      expect(resp.userOpHash).toBe("0xdead"); // type-narrowed access
    }
  });

  it("treats a normal signature response as NOT pending (so it is consumed, not surfaced)", () => {
    expect(isPendingConfirmation({ signature: "0xabc", nodeId: "n1" })).toBe(false);
    expect(isPendingConfirmation({ signatureCompact: "0xabc" })).toBe(false);
  });

  it("is safe on null / undefined / non-object / unrelated status", () => {
    expect(isPendingConfirmation(null)).toBe(false);
    expect(isPendingConfirmation(undefined)).toBe(false);
    expect(isPendingConfirmation("pending_confirmation")).toBe(false);
    expect(isPendingConfirmation({ status: "ok" })).toBe(false);
    expect(isPendingConfirmation({})).toBe(false);
  });
});
