import { describe, it, expect } from "vitest";
import { size } from "viem";
import { packEcdsaAlgId } from "./bls-packing";

// airaccount-contract v0.25.0 removed the raw-65 fallback: a Tier-1 / compositeValidator single-ECDSA
// UserOp signature must be framed [algId 0x02][r][s][v] = 66 bytes (#273). packEcdsaAlgId is the shared
// framer used by both the tier-1 (bls-signature-service) and the compositeValidator (transfer-manager) paths.
describe("packEcdsaAlgId (#273 single-ECDSA algId framing)", () => {
  const bare65 = ("0x" + "ab".repeat(65)) as `0x${string}`; // bare r‖s‖v from an ISignerAdapter

  it("prepends 0x02 to a bare 65-byte sig → 66 bytes, sig preserved verbatim", () => {
    const out = packEcdsaAlgId(bare65);
    expect(out).toBe(("0x02" + "ab".repeat(65)) as `0x${string}`);
    expect(size(out)).toBe(66);
    expect(out.slice(0, 4)).toBe("0x02");
  });

  it("rejects an already-framed 66-byte sig (double-prefix guard)", () => {
    expect(() => packEcdsaAlgId(("0x02" + "ab".repeat(65)) as `0x${string}`)).toThrow(
      /bare 65-byte/
    );
  });

  it("rejects a 64-byte sig (wrong length)", () => {
    expect(() => packEcdsaAlgId(("0x" + "ab".repeat(64)) as `0x${string}`)).toThrow(/64 bytes/);
  });

  it("rejects a non-hex value of the right string length", () => {
    // 132 chars but not hex — a raw string-length check would wrongly accept this.
    const notHex = ("0x" + "zz".repeat(65)) as `0x${string}`;
    expect(() => packEcdsaAlgId(notHex)).toThrow(/non-hex value/);
  });
});
