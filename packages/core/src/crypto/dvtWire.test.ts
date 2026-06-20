import { describe, it, expect } from "vitest";
import { size, slice } from "viem";
import {
  ALG_BLS,
  encodeBLSAccountSignature,
  encodeDVTVerifierProof,
} from "./dvtWire.js";

// A valid 256-byte EIP-2537 G2 blob: each of the 4 slots is 16 zero bytes + 48 payload bytes.
const slot = (b: string) => "00".repeat(16) + b.repeat(48);
const BLS_SIG = `0x${slot("aa")}${slot("bb")}${slot("cc")}${slot("dd")}` as const;
const NODE_IDS = [
  `0x${"11".repeat(32)}`,
  `0x${"22".repeat(32)}`,
  `0x${"33".repeat(32)}`,
] as const;
const OWNER_SIG = `0x${"ee".repeat(65)}` as const;

describe("encodeBLSAccountSignature — account-level ALG_BLS (0x01) for EntryPoint.handleOps", () => {
  it("lays out [0x01][nodeIdsLength(32)][nodeIds(N×32)][blsSig(256)][ownerECDSA(65)]", () => {
    const sig = encodeBLSAccountSignature({ nodeIds: [...NODE_IDS], blsSig: BLS_SIG, ownerSig: OWNER_SIG });
    // 1 (algId) + 32 (length) + 3×32 (nodeIds) + 256 (blsSig) + 65 (ownerSig) = 450
    expect(size(sig)).toBe(450);
    expect(slice(sig, 0, 1)).toBe(`0x${ALG_BLS.toString(16).padStart(2, "0")}`);
    expect(BigInt(slice(sig, 1, 33))).toBe(3n); // nodeIdsLength
    // nodeIds in order
    expect(slice(sig, 33, 33 + 96)).toBe(`0x${"11".repeat(32)}${"22".repeat(32)}${"33".repeat(32)}`);
    // the BLS payload [nodeIds][blsSig] (no length prefix) equals the verifier-level proof
    const verifierProof = encodeDVTVerifierProof([...NODE_IDS], BLS_SIG);
    expect(slice(sig, 33, 33 + 96 + 256)).toBe(verifierProof);
    // trailing 65 bytes are the owner ECDSA
    expect(slice(sig, 450 - 65)).toBe(OWNER_SIG);
  });

  it("rejects an ownerSig that is not 65 bytes", () => {
    expect(() =>
      encodeBLSAccountSignature({ nodeIds: [...NODE_IDS], blsSig: BLS_SIG, ownerSig: `0x${"ee".repeat(64)}` }),
    ).toThrow(/65-byte/);
  });

  it("rejects an empty nodeIds list", () => {
    expect(() =>
      encodeBLSAccountSignature({ nodeIds: [], blsSig: BLS_SIG, ownerSig: OWNER_SIG }),
    ).toThrow(/non-empty/);
  });

  it("rejects a malformed (non-bytes32) nodeId", () => {
    expect(() =>
      encodeBLSAccountSignature({ nodeIds: ["0x1234"], blsSig: BLS_SIG, ownerSig: OWNER_SIG }),
    ).toThrow(/32-byte/);
  });
});
