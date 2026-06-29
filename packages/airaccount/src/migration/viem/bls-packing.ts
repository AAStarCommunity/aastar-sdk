// viem reimplementation of the BLS packing / G2 serialization logic that
// currently lives (ethers-based) in
//   packages/airaccount/src/core/bls/bls.manager.ts
//
// This is a NEW, parallel implementation created for the ethers -> viem
// migration. The original ethers code is intentionally left untouched.
//
// Byte-exactness is mandatory here: these byte strings are fed to on-chain
// signature verification (ERC-4337 UserOp signature field + EIP-2537 G2
// serialization). Any drift in padding direction, limb size, or byte offset
// breaks verification. The mapping from the ethers primitives is:
//
//   ethers.solidityPacked(types, values)   -> viem.encodePacked(types, values)
//   ethers.solidityPacked(["uint256"],[n]) -> viem.encodePacked(["uint256"],[BigInt(n)])
//   ethers.getBytes(hex)                    -> viem.hexToBytes(hex)
//   bigint.toString(16).padStart(96,"0")    -> viem.numberToHex(v,{size:48}) (48 bytes = 96 hex, left-padded)
//   "0x"+Buffer.from(bytes).toString("hex") -> viem.bytesToHex(bytes)
//
// The hash-to-curve step itself is provided by @noble/curves and is identical
// in both code paths; the only thing that can differ is the surrounding byte
// manipulation, which is exactly what the parity test pins down.

import {
  encodePacked,
  numberToHex,
  hexToBytes,
  bytesToHex,
  type Hex,
} from "viem";
import { bls12_381 as bls } from "@noble/curves/bls12-381.js";

import type {
  BLSSignatureData,
  CumulativeT2SignatureData,
  CumulativeT3SignatureData,
} from "../../core/bls/types";

/** Domain separation tag for the BLS12-381 G2 hash-to-curve (POP scheme). */
export const BLS_DST = "BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_";

/**
 * Pack the full signature for ERC-4337 UserOp.
 * Format: [nodeIdsLength(32)][nodeIds(N*32)][blsSignature][messagePoint][aaSignature][messagePointSignature]
 *
 * viem equivalent of BLSManager.packSignature (ethers.solidityPacked).
 */
export function packSignature(data: BLSSignatureData): Hex {
  if (!data.nodeIds || !data.aaSignature || !data.messagePointSignature) {
    throw new Error("Missing required signature components");
  }

  const nodeIdsLength = encodePacked(["uint256"], [BigInt(data.nodeIds.length)]);
  const nodeIdsBytes = encodePacked(
    Array(data.nodeIds.length).fill("bytes32"),
    data.nodeIds
  );

  return encodePacked(
    ["bytes", "bytes", "bytes", "bytes", "bytes", "bytes"],
    [
      nodeIdsLength,
      nodeIdsBytes,
      data.signature as Hex,
      data.messagePoint as Hex,
      data.aaSignature as Hex,
      data.messagePointSignature as Hex,
    ]
  );
}

/**
 * Pack cumulative Tier 2 signature (algId 0x04): P256 + BLS.
 *
 * Format (MUST match `_validateCumulativeTier2` in AAStarAirAccountBase.sol — issue #45 Fix 1
 * removed the embedded messagePoint + messagePointSignature; the account now recomputes the
 * message point on-chain via hash_to_curve(userOpHash) and verifies the pairing against THAT,
 * so the owner messagePointSignature is redundant and the bytes must NOT be present, or the
 * account's strict-length BLS-payload parse rejects the signature):
 *   [algId=0x04 (1)] [P256 r (32)] [P256 s (32)]
 *   [nodeIdsLength (32)] [nodeIds (N×32)]
 *   [blsAggregateSig (256)]
 */
export function packCumulativeT2Signature(data: CumulativeT2SignatureData): Hex {
  const nodeIdsLength = encodePacked(["uint256"], [BigInt(data.nodeIds.length)]);
  const nodeIdsBytes = encodePacked(
    Array(data.nodeIds.length).fill("bytes32"),
    data.nodeIds
  );

  return encodePacked(
    ["bytes1", "bytes", "bytes", "bytes", "bytes"],
    [
      "0x04",
      data.p256Signature as Hex,
      nodeIdsLength,
      nodeIdsBytes,
      data.blsSignature as Hex,
    ]
  );
}

/**
 * Pack cumulative Tier 3 signature (algId 0x05): P256 + BLS + Guardian.
 *
 * Format (MUST match `_validateCumulativeTier3` in AAStarAirAccountBase.sol — see the T2 note: the
 * embedded messagePoint + messagePointSignature were removed by issue #45 Fix 1. The account reads
 * the guardian signature from the LAST 65 bytes and the BLS payload from sigData[64 : len-65], so
 * any extra bytes between the BLS aggregate and the guardian signature break verification):
 *   [algId=0x05 (1)] [P256 r (32)] [P256 s (32)]
 *   [nodeIdsLength (32)] [nodeIds (N×32)]
 *   [blsAggregateSig (256)] [guardianECDSA (65)]
 */
export function packCumulativeT3Signature(data: CumulativeT3SignatureData): Hex {
  const nodeIdsLength = encodePacked(["uint256"], [BigInt(data.nodeIds.length)]);
  const nodeIdsBytes = encodePacked(
    Array(data.nodeIds.length).fill("bytes32"),
    data.nodeIds
  );

  return encodePacked(
    ["bytes1", "bytes", "bytes", "bytes", "bytes", "bytes"],
    [
      "0x05",
      data.p256Signature as Hex,
      nodeIdsLength,
      nodeIdsBytes,
      data.blsSignature as Hex,
      data.guardianSignature as Hex,
    ]
  );
}

/**
 * Encode a BLS12-381 G2 point to EIP-2537 serialization (256 bytes).
 *
 * Layout (each Fp limb is 48 bytes / 96 hex chars, big-endian, left-padded,
 * preceded by a 16-byte zero pad => 64 bytes per coordinate):
 *   bytes  0..16  : zero pad
 *   bytes 16..64  : x.c0   (offset 16)
 *   bytes 64..80  : zero pad
 *   bytes 80..128 : x.c1   (offset 80)
 *   bytes128..144 : zero pad
 *   bytes144..192 : y.c0   (offset 144)
 *   bytes192..208 : zero pad
 *   bytes208..256 : y.c1   (offset 208)
 *
 * viem equivalent of BLSManager.encodeG2Point. numberToHex(v,{size:48}) emits a
 * left-padded big-endian 48-byte hex, exactly matching
 * `bigint.toString(16).padStart(96, "0")` followed by hexToBytes.
 */
export function encodeG2Point(point: any): Uint8Array {
  const result = new Uint8Array(256);
  const affine = point.toAffine();

  const x0Bytes = hexToBytes(numberToHex(affine.x.c0 as bigint, { size: 48 }));
  const x1Bytes = hexToBytes(numberToHex(affine.x.c1 as bigint, { size: 48 }));
  const y0Bytes = hexToBytes(numberToHex(affine.y.c0 as bigint, { size: 48 }));
  const y1Bytes = hexToBytes(numberToHex(affine.y.c1 as bigint, { size: 48 }));

  result.set(x0Bytes, 16);
  result.set(x1Bytes, 80);
  result.set(y0Bytes, 144);
  result.set(y1Bytes, 208);
  return result;
}

/**
 * Hash an arbitrary message to a BLS12-381 G2 point using the POP DST.
 * The curve op is delegated to @noble/curves (identical in both code paths);
 * this wrapper exists so the migration has a single typed entry point.
 */
export async function hashToCurve(messageBytes: Uint8Array): Promise<any> {
  return bls.G2.hashToCurve(messageBytes, { DST: BLS_DST });
}

/**
 * Calculate the MessagePoint G2 point (EIP-2537 serialized hex) for a message
 * (typically a UserOpHash). viem equivalent of BLSManager.generateMessagePoint.
 */
export async function generateMessagePoint(
  message: string | Uint8Array
): Promise<Hex> {
  const messageBytes =
    typeof message === "string" ? hexToBytes(message as Hex) : message;

  const messagePointBLS = await hashToCurve(messageBytes);
  const messageG2EIP = encodeG2Point(messagePointBLS);

  return bytesToHex(messageG2EIP);
}
