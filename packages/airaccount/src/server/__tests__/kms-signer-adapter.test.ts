import { describe, it, expect, vi } from "vitest";
import { KmsSignerAdapter } from "../adapters/kms-signer-adapter";

const ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;
const SIG = "deadbeef";

function makeKms() {
  return {
    signHashWithWebAuthn: vi.fn(async () => ({ Signature: SIG })),
    signHash: vi.fn(async () => ({ Signature: SIG })),
  } as any;
}
const resolver = async () => ({ keyId: "key-1", address: ADDRESS });

describe("KmsSignerAdapter", () => {
  it("getAddress / ensureSigner resolve via the key resolver", async () => {
    const a = new KmsSignerAdapter(makeKms(), resolver);
    expect(await a.getAddress("u1")).toBe(ADDRESS);
    expect(await a.ensureSigner("u1")).toEqual({ address: ADDRESS });
  });

  it("routes a WebAuthn ceremony ctx to signHashWithWebAuthn (replay-safe path)", async () => {
    const kms = makeKms();
    const a = new KmsSignerAdapter(kms, resolver);
    const ctx = { webAuthnAssertion: { ChallengeId: "chal-1", Credential: { id: "c" } } };

    const sig = await a.signMessage("u1", new Uint8Array([1, 2, 3]), ctx);

    expect(sig).toBe("0x" + SIG);
    expect(kms.signHash).not.toHaveBeenCalled();
    expect(kms.signHashWithWebAuthn).toHaveBeenCalledWith(
      expect.stringMatching(/^0x[0-9a-f]{64}$/i),
      "chal-1",
      { id: "c" },
      { Address: ADDRESS }
    );
  });

  it("routes a legacy assertion ctx to signHash", async () => {
    const kms = makeKms();
    const a = new KmsSignerAdapter(kms, resolver);
    const assertion = { AuthenticatorData: "0xaa", ClientDataHash: "0xbb", Signature: "0xcc" };

    await a.signMessage("u1", "hello", { assertion } as any);

    expect(kms.signHashWithWebAuthn).not.toHaveBeenCalled();
    expect(kms.signHash).toHaveBeenCalledWith(
      expect.stringMatching(/^0x[0-9a-f]{64}$/i),
      assertion,
      { Address: ADDRESS }
    );
  });

  it("throws when no auth context is supplied", async () => {
    const a = new KmsSignerAdapter(makeKms(), resolver);
    await expect(a.signMessage("u1", "hello")).rejects.toThrow("requires an auth context");
  });
});
