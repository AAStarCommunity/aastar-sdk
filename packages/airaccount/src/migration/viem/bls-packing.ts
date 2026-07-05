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
  encodeAbiParameters,
  concat,
  size,
  isHex,
  numberToHex,
  hexToBytes,
  bytesToHex,
  stringToBytes,
  type Hex,
} from "viem";
import { ALG_ECDSA } from "../../core/tier/types";
import { sortNodeIdsAscending } from "@aastar/core";
import { bls12_381 as bls } from "@noble/curves/bls12-381.js";
import { p256 } from "@noble/curves/nist.js";

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

  // #274: the BLS 0x01 wire (transfer-manager's non-tiered path) must carry strictly-ascending nodeIds,
  // or the v0.27.0 DVT validator rejects it. BLS aggregation is commutative → no re-aggregation needed.
  const nodeIds = sortNodeIdsAscending(data.nodeIds as Hex[]);
  const nodeIdsLength = encodePacked(["uint256"], [BigInt(nodeIds.length)]);
  const nodeIdsBytes = encodePacked(
    Array(nodeIds.length).fill("bytes32"),
    nodeIds
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
  const nodeIds = sortNodeIdsAscending(data.nodeIds as Hex[]); // #274: strict-ascending wire order
  const nodeIdsLength = encodePacked(["uint256"], [BigInt(nodeIds.length)]);
  const nodeIdsBytes = encodePacked(
    Array(nodeIds.length).fill("bytes32"),
    nodeIds
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
  const nodeIds = sortNodeIdsAscending(data.nodeIds as Hex[]); // #274: strict-ascending wire order
  const nodeIdsLength = encodePacked(["uint256"], [BigInt(nodeIds.length)]);
  const nodeIdsBytes = encodePacked(
    Array(nodeIds.length).fill("bytes32"),
    nodeIds
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

// ── WebAuthn cumulative signatures (algId 0x09 / 0x0a) — airaccount-contract #147/#148 ───────────
//
// Device passkeys (WebAuthn) CANNOT sign userOpHash raw — the authenticator signs
// `authenticatorData ‖ sha256(clientDataJSON)` with the op hash as the clientDataJSON `challenge`.
// So the contract verifies the assertion on-chain (Coinbase webauthn-sol / OZ WebAuthn stance) and
// these packers carry the WebAuthn assertion blob instead of a bare 64-byte r‖s.

/** algId for a WebAuthn-passkey + BLS cumulative Tier-2 signature. */
export const ALG_CUMULATIVE_T2_WA = 0x09;
/** algId for a WebAuthn-passkey + BLS + Guardian cumulative Tier-3 signature. */
export const ALG_CUMULATIVE_T3_WA = 0x0a;

/** The fixed clientDataJSON preamble the contract binds (`type` first, then `challenge`). */
const WEBAUTHN_CLIENTDATA_PREFIX = '{"type":"webauthn.get","challenge":"';

/** Normalize a Hex | Uint8Array to bytes. */
function asBytes(v: Hex | Uint8Array): Uint8Array {
  return typeof v === "string" ? hexToBytes(v) : v;
}

/** Base64URL-encode bytes (no padding) — matches the contract's `_base64UrlEncode32`. */
function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Build the WebAuthn assertion blob the contract decodes for the cumulative passkey factor:
 *   abi.encode(bytes authenticatorData, bytes clientDataJSONPrefix, bytes clientDataJSONSuffix,
 *              bytes32 r, bytes32 s)
 *
 * The signature is the raw P-256 DER from `navigator.credentials.get()`; r/s are decoded and the
 * low-S form is enforced (the contract rejects high-S). clientDataJSON is split into the fixed
 * `{"type":"webauthn.get","challenge":"` prefix and the suffix AFTER the base64url(challenge), so
 * the contract can reconstruct it around `base64url(userOpHash)`.
 *
 * @param assertion The three `AuthenticatorAssertionResponse` fields (ArrayBuffers decoded to bytes,
 *   or hex; clientDataJSON may also be the raw JSON string).
 * @param userOpHash The op hash that MUST be the assertion's challenge — verified here so a mismatched
 *   assertion fails in the SDK, not as an opaque on-chain revert.
 */
export function packWebAuthnBlob(
  assertion: {
    authenticatorData: Hex | Uint8Array;
    clientDataJSON: Hex | Uint8Array | string;
    signature: Hex | Uint8Array;
  },
  userOpHash: Hex
): Hex {
  const authData = asBytes(assertion.authenticatorData);

  const clientDataJSON =
    typeof assertion.clientDataJSON === "string"
      ? assertion.clientDataJSON
      : new TextDecoder().decode(asBytes(assertion.clientDataJSON));

  if (!clientDataJSON.startsWith(WEBAUTHN_CLIENTDATA_PREFIX)) {
    throw new Error(
      `packWebAuthnBlob: clientDataJSON must start with ${WEBAUTHN_CLIENTDATA_PREFIX} (got ${clientDataJSON.slice(0, 40)}…)`
    );
  }
  const rest = clientDataJSON.slice(WEBAUTHN_CLIENTDATA_PREFIX.length);
  const closeQuote = rest.indexOf('"');
  if (closeQuote < 0) throw new Error("packWebAuthnBlob: malformed clientDataJSON (no challenge terminator)");
  const challengeB64 = rest.slice(0, closeQuote);
  const suffix = rest.slice(closeQuote); // includes the closing quote

  // The on-chain reconstruction uses base64url(userOpHash) as the challenge, so the assertion MUST
  // have been signed over exactly that — otherwise the rebuilt clientDataJSON won't match and P256
  // verify fails on-chain.
  const expected = base64UrlEncode(hexToBytes(userOpHash));
  if (challengeB64 !== expected) {
    throw new Error(
      `packWebAuthnBlob: assertion challenge != userOpHash (challenge=${challengeB64}, expected=${expected}). ` +
        "The passkey must sign the prepared userOpHash as its WebAuthn challenge."
    );
  }

  // DER → (r, s), enforce low-S (the contract rejects s > n/2; WebAuthn authenticators don't
  // guarantee low-S, so normalize: @noble/curves v2 — parse DER, flip s when hasHighS()).
  const parsed = p256.Signature.fromBytes(asBytes(assertion.signature), "der");
  const n = p256.Point.Fn.ORDER;
  const sNorm = parsed.hasHighS() ? n - parsed.s : parsed.s;
  const r = numberToHex(parsed.r, { size: 32 });
  const s = numberToHex(sNorm, { size: 32 });

  return encodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes" }, { type: "bytes" }, { type: "bytes32" }, { type: "bytes32" }],
    [bytesToHex(authData), bytesToHex(stringToBytes(WEBAUTHN_CLIENTDATA_PREFIX)), bytesToHex(stringToBytes(suffix)), r, s]
  );
}

/**
 * Owner-authorization tag bytes for the account's `isValidOwnerAuth(userOpHash, ownerAuth)` view
 * (airaccount-contract v0.23.0+, issue #159). The DVT forwards the SDK's `ownerAuth` verbatim to
 * that view via eth_call; the first byte selects the verification branch.
 */
export const OWNER_AUTH_TAG_ECDSA = 0x01;
export const OWNER_AUTH_TAG_WEBAUTHN = 0x02;

/**
 * Tag an ECDSA/KMS owner authorization: `0x01 ‖ 65-byte EIP-191 personal_sign(userOpHash)`.
 * Mirrors the contract's `OWNER_AUTH_TAG_ECDSA` branch (which applies `toEthSignedMessageHash` then
 * ecrecover == owner()), so `personalSign65` MUST be an EIP-191 personal_sign, NOT a raw sign.
 */
export function packOwnerAuthEcdsa(personalSign65: Hex): Hex {
  if (size(personalSign65) !== 65) {
    throw new Error(`packOwnerAuthEcdsa: expected a 65-byte EIP-191 signature, got ${size(personalSign65)} bytes`);
  }
  return concat([numberToHex(OWNER_AUTH_TAG_ECDSA, { size: 1 }), personalSign65]);
}

/**
 * Frame a bare secp256k1 owner signature as a single-ECDSA UserOp signature:
 * `[algId 0x02][r(32)][s(32)][v(1)]` = 66 bytes. airaccount-contract v0.25.0 removed the raw-65
 * fallback, so tiered / compositeValidator accounts REQUIRE this algId prefix (#273).
 *
 * `bareSig65` MUST be a bare 65-byte secp256k1 signature (r‖s‖v) — the value an ISignerAdapter
 * (KMS / local wallet) returns. The strict hex + length check rejects an already-framed signature
 * (e.g. the Ledger path returns [0x02]‖r‖s‖v) so it can't be silently double-prefixed into 67 bytes.
 */
export function packEcdsaAlgId(bareSig65: Hex): Hex {
  if (!isHex(bareSig65, { strict: true }) || size(bareSig65) !== 65) {
    const detail = isHex(bareSig65, { strict: true }) ? `${size(bareSig65)} bytes` : "a non-hex value";
    throw new Error(
      `packEcdsaAlgId: expected a bare 65-byte secp256k1 signature (r‖s‖v) to prefix with algId 0x02, got ${detail}`
    );
  }
  return concat([numberToHex(ALG_ECDSA, { size: 1 }), bareSig65]);
}

/**
 * Tag a device-passkey owner authorization: `0x02 ‖ abi.encode(authenticatorData, clientDataJSONPrefix,
 * clientDataJSONSuffix, r, s)`. The device passkey is the account's `p256KeyX/Y` owner factor; the
 * contract's `OWNER_AUTH_TAG_WEBAUTHN` branch P256-verifies this blob against it. The payload is exactly
 * {@link packWebAuthnBlob}'s output (same assertion the composite P256 factor uses), so re-packing it
 * here does NOT re-consume any one-time credential — it is a pure re-encode.
 */
export function packOwnerAuthWebAuthn(
  assertion: Parameters<typeof packWebAuthnBlob>[0],
  userOpHash: Hex
): Hex {
  return concat([numberToHex(OWNER_AUTH_TAG_WEBAUTHN, { size: 1 }), packWebAuthnBlob(assertion, userOpHash)]);
}

/**
 * Pack a WebAuthn cumulative Tier-2 signature (algId 0x09):
 *   [0x09 (1)] [waBlobLen: uint32 BE (4)] [waBlob] [blsPayload]
 * where blsPayload = `[nodeIdsLength(32)][nodeIds(N×32)][blsSig(256)]` (build via {@link packBlsPayload}).
 */
export function packCumulativeT2WA(waBlob: Hex, blsPayload: Hex): Hex {
  return concat([
    numberToHex(ALG_CUMULATIVE_T2_WA, { size: 1 }),
    numberToHex(size(waBlob), { size: 4 }),
    waBlob,
    blsPayload,
  ]);
}

/**
 * Pack a WebAuthn cumulative Tier-3 signature (algId 0x0a):
 *   [0x0a (1)] [waBlobLen: uint32 BE (4)] [waBlob] [blsPayload] [guardianECDSA (65)]
 */
export function packCumulativeT3WA(waBlob: Hex, blsPayload: Hex, guardianSig: Hex): Hex {
  return concat([
    numberToHex(ALG_CUMULATIVE_T3_WA, { size: 1 }),
    numberToHex(size(waBlob), { size: 4 }),
    waBlob,
    blsPayload,
    guardianSig,
  ]);
}

// #274 nodeId strict-ascending sort lives in @aastar/core (crypto/dvtWire) — the single source shared by
// the core dvtWire encoders and these airaccount packers. Re-exported so ./bls-packing consumers keep it.
export { sortNodeIdsAscending };

/** Build the BLS payload block shared by the cumulative formats: `[nodeIdsLength(32)][nodeIds(N×32)][blsSig(256)]`.
 *  nodeIds are sorted strictly ascending + dedup-checked before packing (#274). */
export function packBlsPayload(nodeIds: readonly Hex[], blsSignature: Hex): Hex {
  const sorted = sortNodeIdsAscending(nodeIds);
  const nodeIdsLength = encodePacked(["uint256"], [BigInt(sorted.length)]);
  const nodeIdsBytes = encodePacked(Array(sorted.length).fill("bytes32"), sorted);
  return concat([nodeIdsLength, nodeIdsBytes, blsSignature]);
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
