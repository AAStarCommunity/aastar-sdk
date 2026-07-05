import { describe, it, expect } from "vitest";
import { sortNodeIdsAscending, packBlsPayload } from "./bls-packing";

// #274: the BLS aggregation wire [nodeIds...][blsSig] must carry nodeIds STRICTLY ASCENDING (+ dedup),
// or the DVT-unification validator (algId 0x01, v0.27.0) rejects it — a single node could otherwise
// submit [nid, nid, …] + k·sig to fake an M-of-N quorum. BLS aggregation is commutative, so reordering
// does not change the aggregate signature.
describe("sortNodeIdsAscending (#274)", () => {
  const A = ("0x" + "11".repeat(32)) as `0x${string}`;
  const B = ("0x" + "22".repeat(32)) as `0x${string}`;
  const LEADING_ZERO = ("0x" + "00".repeat(31) + "01") as `0x${string}`;
  const MAX = ("0x" + "ff".repeat(32)) as `0x${string}`;

  it("sorts by 32-byte big-endian value ascending", () => {
    expect(sortNodeIdsAscending([MAX, A, LEADING_ZERO, B])).toEqual([LEADING_ZERO, A, B, MAX]);
  });

  it("is a no-op on an already-ascending list", () => {
    expect(sortNodeIdsAscending([LEADING_ZERO, A, B, MAX])).toEqual([LEADING_ZERO, A, B, MAX]);
  });

  it("handles empty and single-element lists", () => {
    expect(sortNodeIdsAscending([])).toEqual([]);
    expect(sortNodeIdsAscending([A])).toEqual([A]);
  });

  it("throws on a duplicate nodeId (strictly ascending ⇒ no equals)", () => {
    expect(() => sortNodeIdsAscending([A, B, A])).toThrow(/duplicate nodeId/);
  });

  it("packBlsPayload emits [length][ascending nodeIds][blsSig] regardless of input order", () => {
    const blsSig = ("0x" + "ee".repeat(256)) as `0x${string}`;
    const out = packBlsPayload([MAX, LEADING_ZERO, A], blsSig);
    // length(32) = 3, then nodeIds ascending: LEADING_ZERO, A, MAX
    const expected =
      "0x" +
      "00".repeat(31) + "03" +
      LEADING_ZERO.slice(2) + A.slice(2) + MAX.slice(2) +
      "ee".repeat(256);
    expect(out.toLowerCase()).toBe(expected.toLowerCase());
  });
});
