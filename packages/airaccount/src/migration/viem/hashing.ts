// Viem reimplementation of the ethers "Hashing & selectors" surface used by
// @aastar/airaccount. This is a NEW, parallel module — the original ethers code
// is left untouched. Faithful, byte-for-byte equivalents are proven by the
// companion `hashing.parity.test.ts`.
//
// SEMANTIC MAP (ethers -> viem):
//   ethers.id(str)            === keccak256(stringToBytes(str))   [UTF-8, NOT hex]
//   ethers.keccak256(hex)     === keccak256(hex)                  [hex bytes in/out]
//   ethers.toUtf8Bytes(str)   === stringToBytes(str)              [UTF-8 encode]
//   4-byte function selector  === toFunctionSelector(signature)   == id(sig).slice(0,10)
//
// CRITICAL TRAP: ethers.id / ethers.toUtf8Bytes ALWAYS treat their argument as a
// UTF-8 string. The viem equivalent is `stringToBytes`, NOT `toBytes`: `toBytes`
// interprets a "0x..."-looking string as hex (so toBytes("0xdeadbeef") -> 4 bytes,
// while toUtf8Bytes("0xdeadbeef") -> the 10 UTF-8 bytes of the literal text).
// Likewise the selector is keccak256 of the UTF-8 signature bytes — never
// keccak256("0x" + signature).

import {
  keccak256 as viemKeccak256,
  stringToBytes,
  toFunctionSelector,
  type Hex,
} from "viem";

/**
 * Equivalent of `ethers.id(value)`: keccak256 of the UTF-8 bytes of `value`.
 * Returns a 0x-prefixed 32-byte hash. Commonly sliced to 10 chars for a 4-byte
 * function selector or used for event topic hashing.
 */
export function id(value: string): Hex {
  return viemKeccak256(stringToBytes(value));
}

/**
 * Equivalent of `ethers.keccak256(data)` for hex-string input: keccak256 of the
 * raw bytes encoded by the 0x-prefixed hex string. Accepts a viem `Hex` or a
 * `Uint8Array` (matching ethers' `BytesLike`). Returns a 0x-prefixed 32-byte hash.
 */
export function keccak256(data: Hex | Uint8Array): Hex {
  return viemKeccak256(data);
}

/**
 * Equivalent of `ethers.toUtf8Bytes(str)`: UTF-8 encode a string to a Uint8Array.
 * Uses viem `stringToBytes` (UTF-8), NOT `toBytes` (which would hex-decode a
 * "0x..."-looking string).
 */
export function toUtf8Bytes(str: string): Uint8Array {
  return stringToBytes(str);
}

/**
 * 4-byte function selector for a Solidity function signature, equivalent to
 * `ethers.id(signature).slice(0, 10)`. Returns the 0x-prefixed 4-byte (10-char) hex.
 *
 * Implemented via viem `toFunctionSelector`, which produces identical output to the
 * id-and-slice form for canonical signatures (verified in the parity test for both
 * simple and tuple-argument signatures).
 */
export function functionSelector(signature: string): Hex {
  return toFunctionSelector(signature);
}

/**
 * Selector via the literal `ethers.id(sig).slice(0, 10)` pattern, exposed so call
 * sites that currently do `ethers.id(sig).slice(0, 10)` can migrate verbatim
 * without depending on viem's signature normalization.
 */
export function selectorFromId(signature: string): Hex {
  return id(signature).slice(0, 10) as Hex;
}
