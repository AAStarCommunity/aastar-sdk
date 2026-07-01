import { describe, it, expect, vi } from "vitest";
import {
  BLSSignatureService,
  DvtPendingConfirmationError,
  isPendingConfirmation,
} from "../services/bls-signature-service";

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));
vi.mock("axios", () => ({ default: { post: mockPost, get: vi.fn() } }));

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

describe("_coordinateBlsAggregate — DVT transport / aggregation (#257 format, #258 review L1)", () => {
  function makeService() {
    return new BLSSignatureService(
      { blsSeedNodes: [] } as any,
      {} as any,
      { getBlsConfig: vi.fn().mockResolvedValue(undefined) } as any,
      { signMessage: vi.fn() } as any
    );
  }
  const NODES = [{ apiEndpoint: "https://dvt1.example" }, { apiEndpoint: "https://dvt2.example" }];
  const DVT_REQ = { userOp: { sender: "0xacc", nonce: "0x0" }, ownerAuth: "0x" + "ab".repeat(65) };

  it("POSTs { userOp, ownerAuth } (NOT { message }) to every node, then aggregates the collected sigs", async () => {
    mockPost.mockReset();
    mockPost
      .mockResolvedValueOnce({ data: { nodeId: "0xn1", signature: "0xsig1" } }) // dvt1 /signature/sign
      .mockResolvedValueOnce({ data: { nodeId: "0xn2", signature: "0xsig2" } }) // dvt2 /signature/sign
      .mockResolvedValueOnce({ data: { signature: "0xAGG" } }); // /signature/aggregate

    const svc = makeService();
    const out = await (svc as any)._coordinateBlsAggregate(NODES, "0x" + "cd".repeat(32), DVT_REQ);

    // per-node sign body is the #257 { userOp, ownerAuth } — never the legacy { message }.
    for (const call of mockPost.mock.calls.slice(0, 2)) {
      expect(String(call[0])).toContain("/signature/sign");
      expect(call[1]).toEqual({ userOp: DVT_REQ.userOp, ownerAuth: DVT_REQ.ownerAuth });
      expect(call[1]).not.toHaveProperty("message");
    }
    // aggregate call receives both collected signatures.
    const aggCall = mockPost.mock.calls[2];
    expect(String(aggCall[0])).toContain("/signature/aggregate");
    expect(aggCall[1]).toEqual({ signatures: ["0xsig1", "0xsig2"] });
    // result: nodeIds come from the sign RESPONSES (authoritative), signature is the aggregate.
    expect(out.nodeIds).toEqual(["0xn1", "0xn2"]);
    expect(out.signature).toBe("0xAGG");
  });

  it("a single co-signer's signature IS the aggregate (no /signature/aggregate call)", async () => {
    mockPost.mockReset();
    mockPost
      .mockResolvedValueOnce({ data: { nodeId: "0xn1", signature: "0xsolo" } }) // dvt1 signs
      .mockRejectedValueOnce(new Error("dvt2 down")); // dvt2 unreachable

    const svc = makeService();
    const out = await (svc as any)._coordinateBlsAggregate(NODES, "0x" + "cd".repeat(32), DVT_REQ);

    expect(out.nodeIds).toEqual(["0xn1"]);
    expect(out.signature).toBe("0xsolo");
    expect(mockPost).toHaveBeenCalledTimes(2); // 2 sign attempts, NO aggregate call
  });

  it("throws when a dvtRequest is missing (DVT v1.7 requires owner authorization)", async () => {
    const svc = makeService();
    await expect((svc as any)._coordinateBlsAggregate(NODES, "0x" + "cd".repeat(32), undefined)).rejects.toThrow(
      /dvtRequest|owner authorization/
    );
  });

  it("throws when no node returns a signature", async () => {
    mockPost.mockReset();
    mockPost.mockRejectedValue(new Error("all down"));
    const svc = makeService();
    await expect((svc as any)._coordinateBlsAggregate(NODES, "0x" + "cd".repeat(32), DVT_REQ)).rejects.toThrow(
      /Failed to get signatures/
    );
  });
});
