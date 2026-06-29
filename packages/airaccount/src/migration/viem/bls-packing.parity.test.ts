// Golden-fixture test for the viem reimplementation of the BLS packing /
// EIP-2537 G2 serialization logic in ./bls-packing.ts.
//
// Each locked value is a GOLDEN value: proven byte-equal to the original
// ethers-based BLSManager (ethers.solidityPacked / manual G2 limb serialization)
// AND accepted on-chain. Captured from the original differential parity test
// against ethers before ethers was removed — see this file's git history.
// No randomness — fixed golden vectors plus hand-crafted edge inputs.

import { describe, it, expect } from "vitest";
import { hexToBytes } from "viem";
import { bls12_381 as bls } from "@noble/curves/bls12-381.js";

import {
  packSignature,
  packCumulativeT2Signature,
  packCumulativeT3Signature,
  encodeG2Point,
  generateMessagePoint,
} from "./bls-packing";

// Golden values: byte-equal to ethers v6 + accepted on-chain (captured from the
// former differential test against ethers; see this file's git history).
const GOLDEN = {
  "packSignature": {
    "golden 3 nodes": "0x000000000000000000000000000000000000000000000000000000000000000311111111111111111111111111111111111111111111111111111111111111112222222222222222222222222222222222222222222222222222222222222222ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1faaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "single node": "0x00000000000000000000000000000000000000000000000000000000000000011111111111111111111111111111111111111111111111111111111111111111eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1faaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "zero nodes (empty array)": "0x0000000000000000000000000000000000000000000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1faaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "leading-zero + zero nodeIds": "0x0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000001f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1faaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  },
  "packT2": {
    "golden 2 nodes": "0x04dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd000000000000000000000000000000000000000000000000000000000000000211111111111111111111111111111111111111111111111111111111111111112222222222222222222222222222222222222222222222222222222222222222eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1fbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "zero nodes": "0x04dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd0000000000000000000000000000000000000000000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1fbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "max + zero nodeIds": "0x04000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000000000000000000000000000000000000000000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1fbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  },
  "packT3": {
    "golden 3 nodes": "0x05dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd0000000000000000000000000000000000000000000000000000000000000003111111111111111111111111111111111111111111111111111111111111111122222222222222222222222222222222222222222222222222222222222222220000000000000000000000000000000000000000000000000000000000000001eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1fbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    "zero nodes": "0x05dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd0000000000000000000000000000000000000000000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1fbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
  },
  "encodeG2": {
    "hashToCurve(short)": "0000000000000000000000000000000015589114d95aa2df177e12b01d7b6a3658b2e7019ba18f7a05b368f407674b8f25cebef6f2c7a1062362a274bd34e0040000000000000000000000000000000011f64028221083815ff5c1ae2fca3f637e0a6677b8140ff77bd17384ff893de3ca1202901469dff72987be29ca1059b6000000000000000000000000000000001371757df4042603168bd79b3e5a9a46900620a09de40a5052a4a8e02089d80c13118b010d2fbc7845a15d7ea438ed6b000000000000000000000000000000001140fd69256fea8716aca7fe6ccaf828803139cf55b646b61588268f21c836fb5e33e3782800a0933455b32e98774466",
    "hashToCurve(leading-zero)": "0000000000000000000000000000000010cdbd4a3cf7ea4bb500a5518c16741f80cc38c42cb8c9941d6f5334afe7cd3e64456d914c889c3d42f96b853ced27a70000000000000000000000000000000014f5250898d3a6e4535e356cc4ea8a751c44cd17f7628edbea5ec60748d5cfec1df7b3ad6b1e536e4ef001060617856900000000000000000000000000000000049ebeb6128ad3f7e18a07b9720c3f68a6a6380afae8ae70e22e7360d5d5ae1f11040f531f41accf9de304d08f04da820000000000000000000000000000000001d7faded9d3d5400590f556f4638955112765e9f437517103318c32dc278766713c4500da5f7e0471581e5661702492",
    "hashToCurve(golden)": "0000000000000000000000000000000009fd61cddb7bc40748ac72353b70a812ffe60ee7ec1df58488654e7d51d0d39d50379349256f197fe47157b2a7b9f13b0000000000000000000000000000000018e5df3fc40147962df591f6f523173614280b85e4a41151cb88806113fc14602a727349abf135c5e3f82cadc962e7bf000000000000000000000000000000000ff6119f2a1b50d97a702a70d7441a0dca20f9cd04799558edb06c6c4a7748b41d2d0d2f88b2935c86c49ff59a3c3d6c0000000000000000000000000000000005b02a23f0d2dade2a1e255445324b590962c52127844bb21bd58de2fed0af3cf41ea7b8a1bbaa6a07f44c6210b3c2ad",
    "hashToCurve(zero)": "00000000000000000000000000000000076e5cd6cfb3c361fc767e5f40ce05486e1668825ffeecab89d7daa455a179736a387ae93b9b15d283d45ffa14cd4af70000000000000000000000000000000017502412bcfc3f1d88b71f1ad9b60fa37c332d19466fba1dc991d42bcd09bcd9f1c22a562646ffce0922793b6c69938b0000000000000000000000000000000006740fd1dd8669dd6938f89bb6f45fe88d98e2ddb5a3938af14b6384ca8f09ef57c612076236638f9ff93fc2f77824a0000000000000000000000000000000000b5870882f02ad57dac847d25b00412a74c4d16c004e9ae3801e85c3785d497dda79e2c68c6aaf77a165640cb4399237",
    "hashToCurve(max)": "0000000000000000000000000000000010fb7e37155c4c636b3ba08bbccf876fdc76865107396eb7c47e9b7379a5398e47b94ec4f354085295030b6e6d4735240000000000000000000000000000000000af3443ffbeac150d95be71508608b6825348d33698a016836d58b669cf3dfdf011e5493df23f42e286be35368553e100000000000000000000000000000000137043c0820ab6016ccaadc4d0c1d738dc01a50ee53560308d3fc6c600f045b5b28bda87d8dd69aceaee495b4758ef98000000000000000000000000000000000511559e72b4b4d22f3319ad70a193f1585f608a29e780d5d86a232150a5cf4d6612271ca5af011065b5cf5421ae9a22"
  },
  "genMP": {
    "golden userOpHash": "0x0000000000000000000000000000000009fd61cddb7bc40748ac72353b70a812ffe60ee7ec1df58488654e7d51d0d39d50379349256f197fe47157b2a7b9f13b0000000000000000000000000000000018e5df3fc40147962df591f6f523173614280b85e4a41151cb88806113fc14602a727349abf135c5e3f82cadc962e7bf000000000000000000000000000000000ff6119f2a1b50d97a702a70d7441a0dca20f9cd04799558edb06c6c4a7748b41d2d0d2f88b2935c86c49ff59a3c3d6c0000000000000000000000000000000005b02a23f0d2dade2a1e255445324b590962c52127844bb21bd58de2fed0af3cf41ea7b8a1bbaa6a07f44c6210b3c2ad",
    "zero hash": "0x00000000000000000000000000000000076e5cd6cfb3c361fc767e5f40ce05486e1668825ffeecab89d7daa455a179736a387ae93b9b15d283d45ffa14cd4af70000000000000000000000000000000017502412bcfc3f1d88b71f1ad9b60fa37c332d19466fba1dc991d42bcd09bcd9f1c22a562646ffce0922793b6c69938b0000000000000000000000000000000006740fd1dd8669dd6938f89bb6f45fe88d98e2ddb5a3938af14b6384ca8f09ef57c612076236638f9ff93fc2f77824a0000000000000000000000000000000000b5870882f02ad57dac847d25b00412a74c4d16c004e9ae3801e85c3785d497dda79e2c68c6aaf77a165640cb4399237",
    "max hash": "0x0000000000000000000000000000000010fb7e37155c4c636b3ba08bbccf876fdc76865107396eb7c47e9b7379a5398e47b94ec4f354085295030b6e6d4735240000000000000000000000000000000000af3443ffbeac150d95be71508608b6825348d33698a016836d58b669cf3dfdf011e5493df23f42e286be35368553e100000000000000000000000000000000137043c0820ab6016ccaadc4d0c1d738dc01a50ee53560308d3fc6c600f045b5b28bda87d8dd69aceaee495b4758ef98000000000000000000000000000000000511559e72b4b4d22f3319ad70a193f1585f608a29e780d5d86a232150a5cf4d6612271ca5af011065b5cf5421ae9a22",
    "leading-zero hash": "0x0000000000000000000000000000000010cdbd4a3cf7ea4bb500a5518c16741f80cc38c42cb8c9941d6f5334afe7cd3e64456d914c889c3d42f96b853ced27a70000000000000000000000000000000014f5250898d3a6e4535e356cc4ea8a751c44cd17f7628edbea5ec60748d5cfec1df7b3ad6b1e536e4ef001060617856900000000000000000000000000000000049ebeb6128ad3f7e18a07b9720c3f68a6a6380afae8ae70e22e7360d5d5ae1f11040f531f41accf9de304d08f04da820000000000000000000000000000000001d7faded9d3d5400590f556f4638955112765e9f437517103318c32dc278766713c4500da5f7e0471581e5661702492",
    "short message": "0x0000000000000000000000000000000015589114d95aa2df177e12b01d7b6a3658b2e7019ba18f7a05b368f407674b8f25cebef6f2c7a1062362a274bd34e0040000000000000000000000000000000011f64028221083815ff5c1ae2fca3f637e0a6677b8140ff77bd17384ff893de3ca1202901469dff72987be29ca1059b6000000000000000000000000000000001371757df4042603168bd79b3e5a9a46900620a09de40a5052a4a8e02089d80c13118b010d2fbc7845a15d7ea438ed6b000000000000000000000000000000001140fd69256fea8716aca7fe6ccaf828803139cf55b646b61588268f21c836fb5e33e3782800a0933455b32e98774466",
    "empty message": "0x00000000000000000000000000000000102504549e1cbd3e95173eefe75a36aafcc6427d7f16ddc36daba4fc0ea32b7183d052de00a929950bd9f78c290b36860000000000000000000000000000000003b633b06dd88b63ee6180a849fb16f7d4a5823ec8a27294bfe57656c0f319a821478ccf453bacdc94ad1b79d95a00e40000000000000000000000000000000019a23fd623cb1726ab630b9f46f41cc9887d6f53c83294c69cbbac43f14806fe64064f60e6b69a6f186b3333a1b882260000000000000000000000000000000006ef26c3e5382e82cce3600ce1735d12d237bf853d7042d5e3963c82019da81c0428279f9d1211551cc585ed5932ab1c",
    "Uint8Array input": "0x0000000000000000000000000000000008d60ebd8cc8c63721b23af1c98f63c7677582148b6e88af935097a3da68c72b7c9f81db18089ee996496a7fa5f0f2780000000000000000000000000000000000eb9ac4ca6f443fec3bf28a9eaad1f872bc6d0e8cfd36933c1fbec9d989c0c8a569d934246025d223c1e3e043d8a9bd0000000000000000000000000000000002bcea7484e5ce1f21071df6b0590b194197ff60194e3646404dc006c40282501d4d8aa0e043088c42025a4b51b6d8630000000000000000000000000000000000d23dd5f525635104f50ddd442d3774d197e911e92ace71a2a70ca85eb50c68ffec926f4b97c02da84396925ebb0266"
  }
} as const;

const DST = "BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_";

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

describe("BLS packing (golden vs locked ethers output)", () => {
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

    it.each(cases)("%s", (label, data) => {
      expect(packSignature(data)).toBe((GOLDEN.packSignature as Record<string, string>)[label]);
    });

    it("throws on missing components", () => {
      const bad = { nodeIds: [NODE_A], signature: BLS_SIG, messagePoint: MSG_POINT };
      expect(() => packSignature(bad as any)).toThrow();
    });
  });

  // Expected packed bytes built from the CANONICAL contract field order (independent of the packer
  // impl — not circular). Contract issue #45 Fix 1 removed the embedded messagePoint(256) +
  // messagePointSignature(65) from the cumulative format; these assertions pin the new layout that
  // `_validateCumulativeTier2/3` in AAStarAirAccountBase.sol expects.
  const strip = (h: string) => (h.startsWith("0x") ? h.slice(2) : h);
  const u256 = (n: number) => n.toString(16).padStart(64, "0");
  const nodeIdsBlock = (ids: string[]) => u256(ids.length) + ids.map(strip).join("");

  describe("packCumulativeT2Signature (contract #45: P256 + BLS, no messagePoint)", () => {
    const cases: Array<[string, string[]]> = [
      ["2 nodes", [NODE_A, NODE_B]],
      ["zero nodes", []],
      ["max + zero nodeIds", [NODE_MAX, NODE_ZERO]],
    ];

    it.each(cases)("%s", (_label, nodeIds) => {
      const out = packCumulativeT2Signature({ p256Signature: P256_SIG, nodeIds, blsSignature: BLS_SIG });
      const expected = "0x04" + strip(P256_SIG) + nodeIdsBlock(nodeIds) + strip(BLS_SIG);
      expect(out).toBe(expected);
      // Exact contract length: algId(1) + P256(64) + nodeIdsLength(32) + nodeIds(N×32) + blsSig(256).
      // No messagePoint(256)/mpSig(65) tail — that is what the strict-length validator rejects.
      expect(hexToBytes(out).length).toBe(1 + 64 + 32 + nodeIds.length * 32 + 256);
    });
  });

  describe("packCumulativeT3Signature (contract #45: P256 + BLS + guardian, no messagePoint)", () => {
    const cases: Array<[string, string[]]> = [
      ["3 nodes", [NODE_A, NODE_B, NODE_LEADING_ZERO]],
      ["zero nodes", []],
    ];

    it.each(cases)("%s", (_label, nodeIds) => {
      const out = packCumulativeT3Signature({
        p256Signature: P256_SIG,
        nodeIds,
        blsSignature: BLS_SIG,
        guardianSignature: GUARDIAN_SIG,
      });
      const expected =
        "0x05" + strip(P256_SIG) + nodeIdsBlock(nodeIds) + strip(BLS_SIG) + strip(GUARDIAN_SIG);
      expect(out).toBe(expected);
      // Guardian is the LAST 65 bytes (what the contract reads); nothing between blsSig and guardian.
      expect(hexToBytes(out).length).toBe(1 + 64 + 32 + nodeIds.length * 32 + 256 + 65);
    });
  });

  describe("encodeG2Point (EIP-2537 serialization)", () => {
    // Real curve points derived deterministically from hashToCurve, exercising
    // the limb serialization including leading-zero Fp coordinates. The expected
    // 256-byte serialization is a locked golden hex.
    const points: Array<[string, () => Promise<any>]> = [
      ["hashToCurve(short)", async () => bls.G2.hashToCurve(hexToBytes(HASH_SHORT as `0x${string}`), { DST })],
      ["hashToCurve(leading-zero)", async () => bls.G2.hashToCurve(hexToBytes(HASH_LEADING_ZERO as `0x${string}`), { DST })],
      ["hashToCurve(golden)", async () => bls.G2.hashToCurve(hexToBytes(GOLDEN_HASH as `0x${string}`), { DST })],
      ["hashToCurve(zero)", async () => bls.G2.hashToCurve(hexToBytes(HASH_ZERO as `0x${string}`), { DST })],
      ["hashToCurve(max)", async () => bls.G2.hashToCurve(hexToBytes(HASH_MAX as `0x${string}`), { DST })],
    ];

    it.each(points)("%s", async (label, makePoint) => {
      const point = await makePoint();
      const viemBytes = encodeG2Point(point);
      expect(viemBytes.length).toBe(256);
      expect(Buffer.from(viemBytes).toString("hex")).toBe(
        (GOLDEN.encodeG2 as Record<string, string>)[label]
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

    it.each(messages)("%s", async (label, msg) => {
      const viemHex = await generateMessagePoint(msg);
      expect(viemHex).toBe((GOLDEN.genMP as Record<string, string>)[label]);
      // sanity: 256 bytes => 512 hex chars + "0x"
      expect(viemHex.length).toBe(2 + 512);
    });
  });
});
