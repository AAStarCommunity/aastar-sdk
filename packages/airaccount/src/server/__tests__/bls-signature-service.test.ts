import { describe, it, expect } from "vitest";
import { DvtPendingConfirmationError, isPendingConfirmation } from "../services/bls-signature-service";

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
