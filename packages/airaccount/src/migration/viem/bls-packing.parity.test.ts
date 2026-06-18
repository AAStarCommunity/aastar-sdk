// Differential parity test: ethers reference vs viem reimplementation of the
// BLS packing / EIP-2537 G2 serialization logic.
//
// For each input we compute the reference result with the ETHERS API inline
// (mirroring packages/airaccount/src/core/bls/bls.manager.ts exactly) and the
// candidate result with our viem module, then assert byte-for-byte equality.
// No randomness — fixed golden vectors plus hand-crafted edge inputs.

import { describe, it, expect } from "vitest";
import { ethers } from "ethers";
import { bls12_381 as bls } from "@noble/curves/bls12-381.js";

import {
  packSignature,
  packCumulativeT2Signature,
  packCumulativeT3Signature,
  encodeG2Point,
  generateMessagePoint,
} from "./bls-packing";

// ─────────────────────────────────────────────────────────────────────────
// ETHERS reference implementations — copied verbatim from BLSManager so the
// test is a true differential against the live ethers behavior.
// ─────────────────────────────────────────────────────────────────────────

const DST = "BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_";

function ethersPackSignature(data: any): string {
  if (!data.nodeIds || !data.aaSignature || !data.messagePointSignature) {
    throw new Error("Missing required signature components");
  }
  const nodeIdsLength = ethers.solidityPacked(["uint256"], [data.nodeIds.length]);
  const nodeIdsBytes = ethers.solidityPacked(
    Array(data.nodeIds.length).fill("bytes32"),
    data.nodeIds
  );
  return ethers.solidityPacked(
    ["bytes", "bytes", "bytes", "bytes", "bytes", "bytes"],
    [
      nodeIdsLength,
      nodeIdsBytes,
      data.signature,
      data.messagePoint,
      data.aaSignature,
      data.messagePointSignature,
    ]
  );
}

function ethersPackT2(data: any): string {
  const nodeIdsLength = ethers.solidityPacked(["uint256"], [data.nodeIds.length]);
  const nodeIdsBytes = ethers.solidityPacked(
    Array(data.nodeIds.length).fill("bytes32"),
    data.nodeIds
  );
  return ethers.solidityPacked(
    ["bytes1", "bytes", "bytes", "bytes", "bytes", "bytes", "bytes"],
    [
      "0x04",
      data.p256Signature,
      nodeIdsLength,
      nodeIdsBytes,
      data.blsSignature,
      data.messagePoint,
      data.messagePointSignature,
    ]
  );
}

function ethersPackT3(data: any): string {
  const nodeIdsLength = ethers.solidityPacked(["uint256"], [data.nodeIds.length]);
  const nodeIdsBytes = ethers.solidityPacked(
    Array(data.nodeIds.length).fill("bytes32"),
    data.nodeIds
  );
  return ethers.solidityPacked(
    ["bytes1", "bytes", "bytes", "bytes", "bytes", "bytes", "bytes", "bytes"],
    [
      "0x05",
      data.p256Signature,
      nodeIdsLength,
      nodeIdsBytes,
      data.blsSignature,
      data.messagePoint,
      data.messagePointSignature,
      data.guardianSignature,
    ]
  );
}

function ethersHexToBytes(hex: string): Uint8Array {
  if (hex.startsWith("0x")) hex = hex.slice(2);
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function ethersEncodeG2Point(point: any): Uint8Array {
  const result = new Uint8Array(256);
  const affine = point.toAffine();
  const x0Bytes = ethersHexToBytes(affine.x.c0.toString(16).padStart(96, "0"));
  const x1Bytes = ethersHexToBytes(affine.x.c1.toString(16).padStart(96, "0"));
  const y0Bytes = ethersHexToBytes(affine.y.c0.toString(16).padStart(96, "0"));
  const y1Bytes = ethersHexToBytes(affine.y.c1.toString(16).padStart(96, "0"));
  result.set(x0Bytes, 16);
  result.set(x1Bytes, 80);
  result.set(y0Bytes, 144);
  result.set(y1Bytes, 208);
  return result;
}

async function ethersGenerateMessagePoint(
  message: string | Uint8Array
): Promise<string> {
  const messageBytes =
    typeof message === "string" ? ethers.getBytes(message) : message;
  const messagePointBLS = await bls.G2.hashToCurve(messageBytes, { DST });
  const messageG2EIP = ethersEncodeG2Point(messagePointBLS);
  return "0x" + Buffer.from(messageG2EIP).toString("hex");
}

// ─────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────

const hex = (n: number, fill = "ab") => "0x" + fill.repeat(n);

// 32-byte bytes32 nodeIds with golden + edge values.
const NODE_A = "0x" + "11".repeat(32);
const NODE_B = "0x" + "22".repeat(32);
const NODE_ZERO = "0x" + "00".repeat(32);
const NODE_LEADING_ZERO = "0x" + "00".repeat(31) + "01"; // leading-zero limb
const NODE_MAX = "0x" + "ff".repeat(32);

// 65-byte ECDSA sigs, 64-byte p256 sig, EIP-2537-sized blobs.
const AA_SIG = hex(65, "aa");
const MP_SIG = hex(65, "bb");
const GUARDIAN_SIG = hex(65, "cc");
const P256_SIG = hex(64, "dd");
const BLS_SIG = hex(256, "ee"); // EIP-2537 aggregate (256 bytes)
const MSG_POINT = hex(256, "1f"); // EIP-2537 G2 (256 bytes)

// Golden userOpHash vectors (32-byte) + edge values.
const GOLDEN_HASH = "0x9c22ff5f21f0b81b113e63f7db6da94fedef11b2119b4088b89664fb9a3cb658";
const HASH_ZERO = "0x" + "00".repeat(32);
const HASH_MAX = "0x" + "ff".repeat(32);
const HASH_LEADING_ZERO = "0x" + "00".repeat(30) + "0001";
const HASH_SHORT = "0xdeadbeef"; // non-32-byte message
const HASH_EMPTY = "0x"; // empty message

describe("BLS packing parity (ethers vs viem)", () => {
  describe("packSignature", () => {
    const cases: Array<[string, any]> = [
      [
        "golden 3 nodes",
        {
          nodeIds: [NODE_A, NODE_B, NODE_MAX],
          signature: BLS_SIG,
          messagePoint: MSG_POINT,
          aaSignature: AA_SIG,
          messagePointSignature: MP_SIG,
        },
      ],
      [
        "single node",
        {
          nodeIds: [NODE_A],
          signature: BLS_SIG,
          messagePoint: MSG_POINT,
          aaSignature: AA_SIG,
          messagePointSignature: MP_SIG,
        },
      ],
      [
        "zero nodes (empty array)",
        {
          nodeIds: [],
          signature: BLS_SIG,
          messagePoint: MSG_POINT,
          aaSignature: AA_SIG,
          messagePointSignature: MP_SIG,
        },
      ],
      [
        "leading-zero + zero nodeIds",
        {
          nodeIds: [NODE_LEADING_ZERO, NODE_ZERO],
          signature: "0x", // empty bls sig
          messagePoint: MSG_POINT,
          aaSignature: AA_SIG,
          messagePointSignature: MP_SIG,
        },
      ],
    ];

    it.each(cases)("%s", (_label, data) => {
      expect(packSignature(data)).toBe(ethersPackSignature(data));
    });

    it("throws on missing components (both paths)", () => {
      const bad = { nodeIds: [NODE_A], signature: BLS_SIG, messagePoint: MSG_POINT };
      expect(() => packSignature(bad as any)).toThrow();
      expect(() => ethersPackSignature(bad)).toThrow();
    });
  });

  describe("packCumulativeT2Signature", () => {
    const cases: Array<[string, any]> = [
      [
        "golden 2 nodes",
        {
          p256Signature: P256_SIG,
          nodeIds: [NODE_A, NODE_B],
          blsSignature: BLS_SIG,
          messagePoint: MSG_POINT,
          messagePointSignature: MP_SIG,
        },
      ],
      [
        "zero nodes",
        {
          p256Signature: P256_SIG,
          nodeIds: [],
          blsSignature: BLS_SIG,
          messagePoint: MSG_POINT,
          messagePointSignature: MP_SIG,
        },
      ],
      [
        "max + zero nodeIds",
        {
          p256Signature: hex(64, "00"),
          nodeIds: [NODE_MAX, NODE_ZERO],
          blsSignature: BLS_SIG,
          messagePoint: MSG_POINT,
          messagePointSignature: MP_SIG,
        },
      ],
    ];

    it.each(cases)("%s", (_label, data) => {
      expect(packCumulativeT2Signature(data)).toBe(ethersPackT2(data));
    });
  });

  describe("packCumulativeT3Signature", () => {
    const cases: Array<[string, any]> = [
      [
        "golden 3 nodes",
        {
          p256Signature: P256_SIG,
          nodeIds: [NODE_A, NODE_B, NODE_LEADING_ZERO],
          blsSignature: BLS_SIG,
          messagePoint: MSG_POINT,
          messagePointSignature: MP_SIG,
          guardianSignature: GUARDIAN_SIG,
        },
      ],
      [
        "zero nodes",
        {
          p256Signature: P256_SIG,
          nodeIds: [],
          blsSignature: BLS_SIG,
          messagePoint: MSG_POINT,
          messagePointSignature: MP_SIG,
          guardianSignature: GUARDIAN_SIG,
        },
      ],
    ];

    it.each(cases)("%s", (_label, data) => {
      expect(packCumulativeT3Signature(data)).toBe(ethersPackT3(data));
    });
  });

  describe("encodeG2Point (EIP-2537 serialization)", () => {
    // Use real curve points derived deterministically from hashToCurve, plus
    // the identity-ish / generator points, to exercise the limb serialization
    // including leading-zero Fp coordinates.
    const points: Array<[string, () => Promise<any>]> = [
      ["hashToCurve(short)", async () => bls.G2.hashToCurve(ethers.getBytes(HASH_SHORT), { DST })],
      ["hashToCurve(leading-zero)", async () => bls.G2.hashToCurve(ethers.getBytes(HASH_LEADING_ZERO), { DST })],
      ["hashToCurve(golden)", async () => bls.G2.hashToCurve(ethers.getBytes(GOLDEN_HASH), { DST })],
      ["hashToCurve(zero)", async () => bls.G2.hashToCurve(ethers.getBytes(HASH_ZERO), { DST })],
      ["hashToCurve(max)", async () => bls.G2.hashToCurve(ethers.getBytes(HASH_MAX), { DST })],
    ];

    it.each(points)("%s", async (_label, makePoint) => {
      const point = await makePoint();
      const viemBytes = encodeG2Point(point);
      const ethersBytes = ethersEncodeG2Point(point);
      expect(viemBytes.length).toBe(256);
      expect(ethersBytes.length).toBe(256);
      // byte-for-byte
      expect(Buffer.from(viemBytes).toString("hex")).toBe(
        Buffer.from(ethersBytes).toString("hex")
      );
    });
  });

  describe("generateMessagePoint (hashToCurve + EIP-2537)", () => {
    const messages: Array<[string, string | Uint8Array]> = [
      ["golden userOpHash", GOLDEN_HASH],
      ["zero hash", HASH_ZERO],
      ["max hash", HASH_MAX],
      ["leading-zero hash", HASH_LEADING_ZERO],
      ["short message", HASH_SHORT],
      ["empty message", HASH_EMPTY],
      ["Uint8Array input", new Uint8Array([1, 2, 3, 4, 5])],
    ];

    it.each(messages)("%s", async (_label, msg) => {
      const viemHex = await generateMessagePoint(msg);
      const ethersHex = await ethersGenerateMessagePoint(msg);
      expect(viemHex).toBe(ethersHex);
      // sanity: 256 bytes => 512 hex chars + "0x"
      expect(viemHex.length).toBe(2 + 512);
    });
  });
});
