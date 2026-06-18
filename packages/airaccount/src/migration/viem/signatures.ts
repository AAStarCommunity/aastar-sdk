/**
 * Viem reimplementation of the signature-normalization helpers that the
 * AirAccount KMS signer and EIP-7702 delegate service currently implement with
 * ethers.
 *
 * This is a NEW, parallel module written for the ethers -> viem migration. The
 * original ethers code (kms-signer.ts / eip7702-delegate-service.ts) is left
 * untouched; the differential parity test next to this file proves that, for
 * the same inputs, these viem helpers produce byte-identical results.
 *
 * The load-bearing invariant being migrated:
 *   - The KMS and EIP-7702 paths assemble / consume a 65-byte signature laid
 *     out as r(32) || s(32) || v(1), where the final byte v is the Ethereum
 *     recovery id 27/28 (NOT the EIP-2098 yParity 0/1). viem's
 *     parseSignature/serializeSignature must preserve this exact layout, and
 *     must NOT emit the compact (64-byte) yParityAndS form.
 */
import {
  type Address,
  type Hex,
  type ByteArray,
  concatHex,
  hashMessage as viemHashMessage,
  keccak256,
  numberToHex,
  parseSignature,
  recoverAddress as viemRecoverAddress,
  recoverMessageAddress,
  serializeSignature,
  toRlp,
} from "viem";

/** The Ethereum personal-message hashable input (mirrors ethers.hashMessage). */
export type SignableMessage = string | ByteArray;

/**
 * Normalize a 65-byte ECDSA signature to the canonical r(32)||s(32)||v(1)
 * serialization with v = 27/28.
 *
 * Equivalent to `ethers.Signature.from(sig).serialized`. Accepts a 65-byte
 * signature whose final byte is either the legacy recovery id (27/28) or the
 * raw yParity (0/1); both normalize to 27/28 in the output. The output is
 * ALWAYS 65 bytes — viem's compact yParityAndS variant is never produced.
 */
export function normalizeSignature(sig: Hex): Hex {
  const parsed = parseSignature(sig);
  // serializeSignature with a default `to: "hex"` and a v/yParity present
  // writes the 65-byte r||s||v form, mapping yParity 0 -> 0x1b, 1 -> 0x1c.
  return serializeSignature(parsed);
}

/**
 * Hash a personal message exactly like `ethers.hashMessage`.
 *
 * keccak256("\x19Ethereum Signed Message:\n" + len + message). A `string` is
 * treated as UTF-8 text (NOT hex); a byte array is hashed as raw bytes.
 */
export function hashMessage(message: SignableMessage): Hex {
  if (typeof message === "string") return viemHashMessage(message);
  return viemHashMessage({ raw: message });
}

/**
 * Recover the signer address from a digest + 65-byte signature.
 *
 * Async equivalent of `ethers.recoverAddress(hash, sig)`. Returns a
 * checksummed address.
 */
export async function recoverAddress(hash: Hex, signature: Hex): Promise<Address> {
  return viemRecoverAddress({ hash, signature });
}

/**
 * Recover the signer address of a personal message.
 *
 * Async equivalent of `ethers.verifyMessage(message, sig)` (which returns the
 * recovered address). Returns a checksummed address.
 */
export async function verifyMessage(
  message: SignableMessage,
  signature: Hex
): Promise<Address> {
  if (typeof message === "string") return recoverMessageAddress({ message, signature });
  return recoverMessageAddress({ message: { raw: message }, signature });
}

/**
 * Compute the EIP-7702 SET_CODE authorization hash that an EOA must sign.
 *
 * Hash = keccak256(0x05 || RLP([chainId, address, nonce]))
 *
 * Mirrors `EIP7702DelegateService.buildAuthorizationHash`. chainId and nonce
 * are RLP-encoded as minimal big-endian integers (0 -> empty byte string).
 */
export function buildAuthorizationHash(
  chainId: number,
  nonce: bigint,
  delegateAddress: Address
): Hex {
  const encoded = toRlp([
    chainId === 0 ? "0x" : numberToHex(chainId),
    delegateAddress,
    nonce === 0n ? "0x" : numberToHex(nonce),
  ]);
  return keccak256(concatHex(["0x05", encoded]));
}

/**
 * Verify a 65-byte signature is a valid EIP-7702 authorization for `eoa`.
 *
 * Async equivalent of `EIP7702DelegateService.verifyAuthorization`. Recovers
 * the signer from the authorization hash and compares (case-insensitively)
 * against the expected EOA.
 */
export async function verifyAuthorization(
  eoa: Address,
  chainId: number,
  nonce: bigint,
  signature: Hex,
  delegateAddress: Address
): Promise<boolean> {
  const hash = buildAuthorizationHash(chainId, nonce, delegateAddress);
  const recovered = await recoverAddress(hash, signature);
  return recovered.toLowerCase() === eoa.toLowerCase();
}
