// Committee framing (CC-98/CC-103, FU-18) for the cumulative Tier-2/3 packers.
//
// FU-18: packCumulativeT2Signature/packCumulativeT3Signature only ever emitted the LEGACY BLS block
// ([nodeIdsLength][nodeIds][blsSig]) — they never learned the COMMITTEE framing that dvtWire.ts's
// encodeDVTAccountSignature/encodeBLSAccountSignature already carry. Evidence: once committeeActive()
// flipped true on-chain, tier3-composite-e2e (0x05, legacy-only) started getting rejected — exactly
// the behavior CC-103's own "legacy framing rejected under committee mode" negative control predicts.
//
// These tests mirror packages/core/src/crypto/dvtWire.committee.test.ts's structure so the two
// framings stay provably in lockstep (same encodeCommitteeBLSBlock underneath).
import { describe, it, expect } from "vitest";
import { concat, numberToHex, size, toHex, type Hex } from "viem";
import type { CommitteeSigner } from "@aastar/core";
import { COMMITTEE_TREE_DEPTH_DEFAULT } from "@aastar/core";
import {
  packCumulativeT2Signature,
  packCumulativeT3Signature,
  packBlsPayload,
  packCommitteeBlsPayload,
  encodeCommitteeBLSBlock,
} from "./bls-packing";

const DEPTH = COMMITTEE_TREE_DEPTH_DEFAULT;
const id = (n: number): Hex => numberToHex(n, { size: 32 });
const proof = (seed: number): Hex[] => Array.from({ length: DEPTH }, (_, i) => id(1000 + seed * 100 + i));
const signer = (n: number): CommitteeSigner => ({ nodeId: id(n), slot: BigInt(n), merkleProof: proof(n) });

const BLS_SIG: Hex = toHex(new Uint8Array(256)); // valid EIP-2537 shape (all-zero pads included)
const P256_SIG: Hex = concat([id(7), id(8)]); // 64-byte r||s
const GUARDIAN_SIG: Hex = `0x${"22".repeat(65)}`;
const PER_SIGNER = 64 + DEPTH * 32; // 512 at the default depth

/**
 * Hand-built expected bytes for the committee BLS block, written from the CC-103 wire spec rather
 * than by calling the encoder under test:
 *   [nodeIdsLength(32)][ (nodeId(32) ‖ slot(32) ‖ proof(depth×32)) × k ][ blsSig(256) ]
 * Signers are emitted STRICTLY ASCENDING by nodeId, each carrying its own slot+proof.
 *
 * This is the independent oracle (Codex review M2): comparing the packers against
 * `encodeCommitteeBLSBlock` alone is tautological, since that is what they delegate to.
 */
const expectedCommitteeBlock = (signers: CommitteeSigner[], blsSig: Hex, depth = DEPTH): Hex => {
  const asc = [...signers].sort((a, b) => (BigInt(a.nodeId) < BigInt(b.nodeId) ? -1 : 1));
  return concat([
    numberToHex(asc.length, { size: 32 }),
    ...asc.flatMap((s) => [s.nodeId, numberToHex(BigInt(s.slot), { size: 32 }), ...s.merkleProof.slice(0, depth)]),
    blsSig,
  ]);
};

describe("packCumulativeT2Signature committee framing", () => {
  it("lays out [0x04][p256(64)][committeeBlock] with the exact expected byte length", () => {
    const sig = packCumulativeT2Signature({
      p256Signature: P256_SIG,
      committeeSigners: [signer(1), signer(2)],
      blsSignature: BLS_SIG,
    });
    expect(size(sig)).toBe(1 + 64 + (32 + 2 * PER_SIGNER + 256));
    expect(sig.slice(0, 4)).toBe("0x04");
    expect(sig.slice(4, 4 + 128)).toBe(P256_SIG.slice(2));
  });

  it("is byte-identical to the hand-built wire layout, field by field at exact offsets", () => {
    const signers = [signer(2), signer(1)]; // deliberately unsorted on input
    const sig = packCumulativeT2Signature({ p256Signature: P256_SIG, committeeSigners: signers, blsSignature: BLS_SIG });

    // Whole-payload equality against bytes derived from the spec, not from the encoder.
    expect(sig).toBe(concat(["0x04", P256_SIG, expectedCommitteeBlock(signers, BLS_SIG)]));

    // …and pin the individual fields so an offset/field-order regression can't hide inside a
    // same-length payload (Codex review M1).
    const at = (byteOffset: number, byteLen: number) =>
      `0x${sig.slice(2 + byteOffset * 2, 2 + (byteOffset + byteLen) * 2)}` as Hex;
    const blockStart = 1 + 64;
    expect(at(0, 1)).toBe("0x04");                                   // algId
    expect(at(1, 64)).toBe(P256_SIG);                                // P256 r‖s
    expect(BigInt(at(blockStart, 32))).toBe(2n);                     // nodeIdsLength = SIGNER COUNT
    // signer 0 == id(1) (ascending, despite being passed second), carrying ITS OWN slot + proof
    expect(at(blockStart + 32, 32)).toBe(id(1));
    expect(BigInt(at(blockStart + 64, 32))).toBe(1n);
    expect(at(blockStart + 96, DEPTH * 32)).toBe(concat(proof(1)));
    // signer 1 == id(2), one PER_SIGNER stride later
    expect(at(blockStart + 32 + PER_SIGNER, 32)).toBe(id(2));
    expect(BigInt(at(blockStart + 64 + PER_SIGNER, 32))).toBe(2n);
    expect(at(blockStart + 96 + PER_SIGNER, DEPTH * 32)).toBe(concat(proof(2)));
    // BLS aggregate trails the signer entries
    expect(at(blockStart + 32 + 2 * PER_SIGNER, 256)).toBe(BLS_SIG);
  });

  it("committee and legacy payloads differ ONLY in the BLS block, tier+p256 prefix identical", () => {
    const legacy = packCumulativeT2Signature({ p256Signature: P256_SIG, nodeIds: [id(1)], blsSignature: BLS_SIG });
    const committee = packCumulativeT2Signature({ p256Signature: P256_SIG, committeeSigners: [signer(1)], blsSignature: BLS_SIG });
    expect(committee.slice(0, 4 + 128)).toBe(legacy.slice(0, 4 + 128));
    expect(size(committee) - size(legacy)).toBe(PER_SIGNER - 32);
  });

  it("refuses an ambiguous call that supplies both framings", () => {
    expect(() =>
      packCumulativeT2Signature({
        p256Signature: P256_SIG,
        nodeIds: [id(1)],
        committeeSigners: [signer(1)],
        blsSignature: BLS_SIG,
      })
    ).toThrow(/not both/);
  });

  it("refuses a call that supplies neither framing", () => {
    expect(() => packCumulativeT2Signature({ p256Signature: P256_SIG, blsSignature: BLS_SIG })).toThrow(
      /must pass nodeIds .* or committeeSigners/
    );
  });

  it("honours a non-default treeDepth (read from the mounted validator, not hardcoded — CC-103 Q4)", () => {
    const d = 4;
    const shallow: CommitteeSigner = { nodeId: id(1), slot: 3n, merkleProof: proof(1).slice(0, d) };
    const sig = packCumulativeT2Signature({
      p256Signature: P256_SIG,
      committeeSigners: [shallow],
      blsSignature: BLS_SIG,
      treeDepth: d,
    });
    expect(size(sig)).toBe(1 + 64 + (32 + (64 + d * 32) + 256));
  });
});

describe("packCumulativeT3Signature committee framing", () => {
  it("lays out [0x05][p256(64)][committeeBlock][guardian(65)], guardian trails the committee block", () => {
    const sig = packCumulativeT3Signature({
      p256Signature: P256_SIG,
      committeeSigners: [signer(1), signer(2)],
      blsSignature: BLS_SIG,
      guardianSignature: GUARDIAN_SIG,
    });
    expect(size(sig)).toBe(1 + 64 + (32 + 2 * PER_SIGNER + 256) + 65);
    expect(`0x${sig.slice(sig.length - 130)}`).toBe(GUARDIAN_SIG);
  });

  it("is byte-identical to the hand-built wire layout, with the BLS aggregate immediately before the guardian tail", () => {
    const signers = [signer(3), signer(1), signer(2)]; // unsorted on input
    const sig = packCumulativeT3Signature({
      p256Signature: P256_SIG, committeeSigners: signers, blsSignature: BLS_SIG, guardianSignature: GUARDIAN_SIG,
    });
    expect(sig).toBe(concat(["0x05", P256_SIG, expectedCommitteeBlock(signers, BLS_SIG), GUARDIAN_SIG]));

    // The contract reads the guardian sig from the LAST 65 bytes and the BLS payload from
    // sigData[64 : len-65] — so pin that the 256-byte aggregate ends exactly where the guardian starts.
    const at = (byteOffset: number, byteLen: number) =>
      `0x${sig.slice(2 + byteOffset * 2, 2 + (byteOffset + byteLen) * 2)}` as Hex;
    const total = size(sig);
    expect(at(total - 65, 65)).toBe(GUARDIAN_SIG);
    expect(at(total - 65 - 256, 256)).toBe(BLS_SIG);
    // last signer entry (id(3)) sits immediately before the aggregate
    expect(at(total - 65 - 256 - PER_SIGNER, 32)).toBe(id(3));
  });

  it("committee and legacy payloads differ ONLY in the BLS block, guardian tail identical", () => {
    const legacy = packCumulativeT3Signature({
      p256Signature: P256_SIG, nodeIds: [id(1)], blsSignature: BLS_SIG, guardianSignature: GUARDIAN_SIG,
    });
    const committee = packCumulativeT3Signature({
      p256Signature: P256_SIG, committeeSigners: [signer(1)], blsSignature: BLS_SIG, guardianSignature: GUARDIAN_SIG,
    });
    expect(committee.slice(0, 4 + 128)).toBe(legacy.slice(0, 4 + 128));
    expect(`0x${committee.slice(committee.length - 130)}`).toBe(`0x${legacy.slice(legacy.length - 130)}`);
    expect(size(committee) - size(legacy)).toBe(PER_SIGNER - 32);
  });

  it("refuses an ambiguous call that supplies both framings", () => {
    expect(() =>
      packCumulativeT3Signature({
        p256Signature: P256_SIG,
        nodeIds: [id(1)],
        committeeSigners: [signer(1)],
        blsSignature: BLS_SIG,
        guardianSignature: GUARDIAN_SIG,
      })
    ).toThrow(/not both/);
  });

  it("refuses a call that supplies neither framing", () => {
    expect(() =>
      packCumulativeT3Signature({ p256Signature: P256_SIG, blsSignature: BLS_SIG, guardianSignature: GUARDIAN_SIG })
    ).toThrow(/must pass nodeIds .* or committeeSigners/);
  });
});

describe("packCommitteeBlsPayload (WebAuthn 0x09/0x0a committee counterpart to packBlsPayload)", () => {
  it("matches the hand-built wire layout byte-for-byte (independent of the encoder it wraps)", () => {
    // NOT compared against encodeCommitteeBLSBlock — packCommitteeBlsPayload delegates to it, so
    // that assertion would be tautological (Codex review M2). Compared against spec-derived bytes.
    const signers = [signer(2), signer(1)];
    expect(packCommitteeBlsPayload(signers, BLS_SIG)).toBe(expectedCommitteeBlock(signers, BLS_SIG));
  });

  it("still agrees with @aastar/core's encoder — pins that the two stay one implementation", () => {
    // Complements (does not replace) the golden-byte test above: this one would catch the two
    // drifting apart if someone re-implemented the block locally instead of delegating.
    const signers = [signer(1), signer(2)];
    expect(packCommitteeBlsPayload(signers, BLS_SIG)).toBe(encodeCommitteeBLSBlock(signers, BLS_SIG));
  });

  it("differs from the legacy packBlsPayload for the same nodeIds — a mutation the account MUST reject under one framing or the other", () => {
    const legacy = packBlsPayload([id(1), id(2)], BLS_SIG);
    const committee = packCommitteeBlsPayload([signer(1), signer(2)], BLS_SIG);
    expect(committee).not.toBe(legacy);
    expect(size(committee)).toBeGreaterThan(size(legacy));
  });

  it("changing one signer's slot changes the encoded bytes (proof is position-bound)", () => {
    const a = packCommitteeBlsPayload([{ nodeId: id(1), slot: 0n, merkleProof: proof(1) }], BLS_SIG);
    const b = packCommitteeBlsPayload([{ nodeId: id(1), slot: 1n, merkleProof: proof(1) }], BLS_SIG);
    expect(a).not.toBe(b);
  });
});

describe("committee framing rejects malformed signer sets (fail in the SDK, not as an on-chain revert)", () => {
  // These all reach @aastar/core's encodeCommitteeBLSBlock through the cumulative packers — the point
  // is that the packers do NOT swallow or bypass its validation (Codex review M2).
  const pack = (signers: CommitteeSigner[], treeDepth?: number) =>
    packCumulativeT3Signature({
      p256Signature: P256_SIG, committeeSigners: signers, blsSignature: BLS_SIG,
      guardianSignature: GUARDIAN_SIG, treeDepth,
    });

  it("rejects an empty signer set", () => {
    expect(() => pack([])).toThrow(/non-empty/);
  });

  it("rejects duplicate signers — a real M-of-N aggregate has distinct signers (#274)", () => {
    // Two partials from ONE signer still pair as 2·sig vs 2·pk, so this is a quorum-inflation vector.
    expect(() => pack([signer(1), signer(1)])).toThrow(/duplicate nodeId/);
  });

  it("rejects a proof whose length is not TREE_DEPTH — on-chain _verifyMerkle would reject it", () => {
    const short: CommitteeSigner = { nodeId: id(1), slot: 0n, merkleProof: proof(1).slice(0, DEPTH - 1) };
    expect(() => pack([short])).toThrow(/TREE_DEPTH is 14/);
  });

  it("rejects a slot outside [0, 2^depth) — _verifyMerkle folds only the low depth bits, so slots alias", () => {
    expect(() => pack([{ nodeId: id(1), slot: 1n << 14n, merkleProof: proof(1) }])).toThrow(/outside \[0, 2\^14\)/);
    expect(() => pack([{ nodeId: id(1), slot: (1n << 14n) - 1n, merkleProof: proof(1) }])).not.toThrow();
  });

  it("rejects a truncated (non-32-byte) nodeId", () => {
    const bad = { nodeId: "0xdeadbeef" as Hex, slot: 0n, merkleProof: proof(1) };
    expect(() => pack([bad])).toThrow(/32-byte/);
  });

  it("rejects a truncated (non-32-byte) proof element", () => {
    const bad: CommitteeSigner = { nodeId: id(1), slot: 0n, merkleProof: [...proof(1).slice(0, DEPTH - 1), "0xabcd" as Hex] };
    expect(() => pack([bad])).toThrow(/merkleProof\[13\] must be a 32-byte/);
  });

  it("rejects a proof sized for the DEFAULT depth when a smaller treeDepth was read from the validator", () => {
    // The depth must come from the mounted validator (CC-103 Q4); passing depth-14 proofs under a
    // depth-4 validator must fail here rather than produce a mis-strided payload.
    expect(() => pack([signer(1)], 4)).toThrow(/TREE_DEPTH is 4/);
  });
});
