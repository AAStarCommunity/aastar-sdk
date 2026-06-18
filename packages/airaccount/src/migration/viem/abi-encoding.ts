/**
 * viem reimplementation of the ethers ABI-encoding helpers used across
 * @aastar/airaccount.
 *
 * Original ethers call sites (UNTOUCHED):
 *   - core/erc4337/userop.builder.ts  : ethers.AbiCoder.defaultAbiCoder().encode(...)
 *   - server/services/force-exit-service.ts : ...encode(["uint8"], [l2Type])
 *   - core/bls/bls.manager.ts         : ethers.solidityPacked(...)
 *   - server/utils/oapd.ts            : ethers.solidityPacked(["address","string"], ...)
 *   - server/services/module-manager.ts / account-manager.ts : ethers.solidityPacked(...)
 *
 * This module is a NEW, parallel implementation built on viem. It does not
 * modify any existing file.
 *
 * Mapping:
 *   ethers.AbiCoder.defaultAbiCoder().encode(types, values)
 *     -> encodeAbiParams(types, values)  (viem encodeAbiParameters + parseAbiParameters)
 *   ethers.AbiCoder.defaultAbiCoder().decode(types, data)
 *     -> decodeAbiParams(types, data)    (viem decodeAbiParameters + parseAbiParameters)
 *   ethers.solidityPacked(types, values)
 *     -> solidityPacked(types, values)   (viem encodePacked)
 */
import {
  encodeAbiParameters,
  decodeAbiParameters,
  parseAbiParameters,
  encodePacked,
  type Hex,
} from "viem";

/**
 * Equivalent of ethers `AbiCoder.defaultAbiCoder().encode(types, values)`.
 *
 * `types` is the ethers-style array of solidity type strings, e.g.
 * `["address", "uint256", "bytes32"]`. They are joined into a viem
 * `parseAbiParameters` string. viem accepts both `number` and `bigint` for
 * integer types, matching ethers' tolerance.
 */
export function encodeAbiParams(types: readonly string[], values: readonly unknown[]): Hex {
  const params = parseAbiParameters(types.join(", "));
  return encodeAbiParameters(params, values as unknown[]);
}

/**
 * Equivalent of ethers `AbiCoder.defaultAbiCoder().decode(types, data)`.
 * Returns a plain array of decoded values (ethers returns a Result, which is
 * array-like; element values are equivalent: bigint for ints, checksummed
 * address strings, lowercase hex for bytes).
 */
export function decodeAbiParams(types: readonly string[], data: Hex): readonly unknown[] {
  const params = parseAbiParameters(types.join(", "));
  return decodeAbiParameters(params, data) as readonly unknown[];
}

/**
 * Equivalent of ethers `solidityPacked(types, values)` (non-standard packed
 * encoding). viem's `encodePacked` takes the same shape: a types array and a
 * matching values array.
 *
 * Note: unlike ethers, viem's integer values for packed encoding are happiest
 * as `bigint`, but `number` is also accepted. Fixed `bytesN` are right-padded
 * within N bytes and `bytes`/`string` are appended raw — identical to ethers.
 */
export function solidityPacked(types: readonly string[], values: readonly unknown[]): Hex {
  return encodePacked(types as string[], values as unknown[]);
}
