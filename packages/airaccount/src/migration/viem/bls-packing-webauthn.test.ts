// Tests for the WebAuthn cumulative packers (algId 0x09 / 0x0a) — airaccount-contract #147/#148.
// A synthetic WebAuthn assertion is built with a software P-256 key (authenticatorData +
// clientDataJSON with challenge=base64url(userOpHash) + a DER signature over
// sha256(authenticatorData ‖ sha256(clientDataJSON))), exactly what navigator.credentials.get()
// produces, so the packed bytes are verified against the contract's expected layout.
import { describe, it, expect } from "vitest";
import {
  sha256,
  concat,
  size,
  numberToHex,
  hexToBytes,
  bytesToHex,
  stringToBytes,
  decodeAbiParameters,
  type Hex,
} from "viem";
import { p256 } from "@noble/curves/nist.js";
import {
  packWebAuthnBlob,
  packCumulativeT2WA,
  packCumulativeT3WA,
  packBlsPayload,
  packOwnerAuthEcdsa,
  packOwnerAuthWebAuthn,
  OWNER_AUTH_TAG_ECDSA,
  OWNER_AUTH_TAG_WEBAUTHN,
  ALG_CUMULATIVE_T2_WA,
  ALG_CUMULATIVE_T3_WA,
} from "./bls-packing";

const CLIENTDATA_PREFIX = '{"type":"webauthn.get","challenge":"';

function base64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Build a synthetic WebAuthn assertion (the 3 AuthenticatorAssertionResponse fields) over userOpHash. */
function makeAssertion(userOpHash: Hex, priv: Uint8Array, suffix = '","origin":"https://app.example","crossOrigin":false}') {
  const challenge = base64Url(hexToBytes(userOpHash));
  const clientDataJSON = CLIENTDATA_PREFIX + challenge + suffix;
  const clientDataBytes = stringToBytes(clientDataJSON);
  // authenticatorData: rpIdHash(32) + flags(1, UP|UV) + signCount(4) = 37 bytes
  const authenticatorData = hexToBytes(("0x" + "ab".repeat(32) + "05" + "00000001") as Hex);
  const payloadHash = sha256(concat([bytesToHex(authenticatorData), sha256(clientDataBytes)]));
  const der = p256.sign(hexToBytes(payloadHash), priv, { lowS: true, prehash: false, format: "der" });
  const parsed = p256.Signature.fromBytes(der, "der"); // default sign is low-S → r/s are final
  return {
    authenticatorData,
    clientDataJSON,
    signature: der,
    expected: { r: parsed.r, s: parsed.s, suffix },
  };
}

describe("packWebAuthnBlob (algId 0x09/0x0a passkey factor)", () => {
  const userOpHash = ("0x" + "cd".repeat(32)) as Hex;
  const priv = hexToBytes(("0x" + "11".repeat(32)) as Hex);

  it("encodes (authenticatorData, prefix, suffix, r, s) and round-trips", () => {
    const a = makeAssertion(userOpHash, priv);
    const blob = packWebAuthnBlob(a, userOpHash);
    const [authData, prefix, suffix, r, s] = decodeAbiParameters(
      [{ type: "bytes" }, { type: "bytes" }, { type: "bytes" }, { type: "bytes32" }, { type: "bytes32" }],
      blob
    );
    expect(authData).toBe(bytesToHex(a.authenticatorData));
    expect(new TextDecoder().decode(hexToBytes(prefix as Hex))).toBe(CLIENTDATA_PREFIX);
    expect(new TextDecoder().decode(hexToBytes(suffix as Hex))).toBe(a.expected.suffix);
    expect(BigInt(r as Hex)).toBe(a.expected.r);
    expect(BigInt(s as Hex)).toBe(a.expected.s);
  });

  it("enforces low-S (s <= n/2)", () => {
    const a = makeAssertion(userOpHash, priv);
    const blob = packWebAuthnBlob(a, userOpHash);
    const [, , , , s] = decodeAbiParameters(
      [{ type: "bytes" }, { type: "bytes" }, { type: "bytes" }, { type: "bytes32" }, { type: "bytes32" }],
      blob
    );
    const N = p256.Point.Fn.ORDER;
    expect(BigInt(s as Hex) <= N / 2n).toBe(true);
  });

  it("rejects an assertion whose challenge != userOpHash", () => {
    const a = makeAssertion(("0x" + "ee".repeat(32)) as Hex, priv); // signed over a DIFFERENT hash
    expect(() => packWebAuthnBlob(a, userOpHash)).toThrow(/challenge != userOpHash/);
  });

  it("rejects a non-standard clientDataJSON prefix", () => {
    const a = makeAssertion(userOpHash, priv);
    expect(() => packWebAuthnBlob({ ...a, clientDataJSON: '{"challenge":"x"}' }, userOpHash)).toThrow(
      /must start with/
    );
  });
});

describe("packCumulativeT2WA / packCumulativeT3WA (contract #147/#148 layout)", () => {
  const userOpHash = ("0x" + "cd".repeat(32)) as Hex;
  const priv = hexToBytes(("0x" + "11".repeat(32)) as Hex);
  const NODE_A = ("0x" + "11".repeat(32)) as Hex;
  const NODE_B = ("0x" + "22".repeat(32)) as Hex;
  const BLS_SIG = ("0x" + "ee".repeat(256)) as Hex;
  const GUARDIAN = ("0x" + "cc".repeat(65)) as Hex;

  it("T2_WA = [0x09][waBlobLen u32 BE][waBlob][blsPayload]", () => {
    const waBlob = packWebAuthnBlob(makeAssertion(userOpHash, priv), userOpHash);
    const blsPayload = packBlsPayload([NODE_A, NODE_B], BLS_SIG);
    const out = packCumulativeT2WA(waBlob, blsPayload);
    expect(out).toBe(
      concat([numberToHex(ALG_CUMULATIVE_T2_WA, { size: 1 }), numberToHex(size(waBlob), { size: 4 }), waBlob, blsPayload])
    );
    // header byte + length prefix decode correctly
    expect(hexToBytes(out)[0]).toBe(0x09);
    const declaredLen = Number(BigInt(("0x" + out.slice(4, 12)) as Hex)); // bytes[1:5]
    expect(declaredLen).toBe(size(waBlob));
    expect(size(out)).toBe(1 + 4 + size(waBlob) + size(blsPayload));
  });

  it("T3_WA appends the 65-byte guardian after blsPayload, algId 0x0a", () => {
    const waBlob = packWebAuthnBlob(makeAssertion(userOpHash, priv), userOpHash);
    const blsPayload = packBlsPayload([NODE_A, NODE_B], BLS_SIG);
    const out = packCumulativeT3WA(waBlob, blsPayload, GUARDIAN);
    expect(hexToBytes(out)[0]).toBe(0x0a);
    expect(size(out)).toBe(1 + 4 + size(waBlob) + size(blsPayload) + 65);
    // last 65 bytes are the guardian sig
    expect(("0x" + out.slice(2).slice(-130)) as Hex).toBe(GUARDIAN);
  });
});

// #261: TAGGED ownerAuth the DVT forwards to account.isValidOwnerAuth(userOpHash, ownerAuth)
// (airaccount-contract v0.23.0, magic 0xa0cf00cf). Tag 0x01 = ECDSA, tag 0x02 = device-passkey WebAuthn.
describe("packOwnerAuth* (DVT ownerAuth for isValidOwnerAuth, #261)", () => {
  const userOpHash = ("0x" + "cd".repeat(32)) as Hex;
  const priv = hexToBytes(("0x" + "11".repeat(32)) as Hex);

  it("packOwnerAuthWebAuthn = 0x02 ‖ packWebAuthnBlob(assertion) (tag 0x02, byte-identical payload)", () => {
    const a = makeAssertion(userOpHash, priv);
    const ownerAuth = packOwnerAuthWebAuthn(a, userOpHash);
    const blob = packWebAuthnBlob(a, userOpHash);
    expect(uint8(ownerAuth, 0)).toBe(OWNER_AUTH_TAG_WEBAUTHN); // 0x02
    expect(("0x" + ownerAuth.slice(4)) as Hex).toBe(blob); // remainder is exactly the WebAuthn blob
    expect(size(ownerAuth)).toBe(1 + size(blob));
  });

  it("packOwnerAuthEcdsa = 0x01 ‖ 65-byte EIP-191 sig (tag 0x01)", () => {
    const sig = ("0x" + "ab".repeat(65)) as Hex; // synthetic 65-byte r‖s‖v
    const ownerAuth = packOwnerAuthEcdsa(sig);
    expect(uint8(ownerAuth, 0)).toBe(OWNER_AUTH_TAG_ECDSA); // 0x01
    expect(("0x" + ownerAuth.slice(4)) as Hex).toBe(sig);
    expect(size(ownerAuth)).toBe(66);
  });

  it("packOwnerAuthEcdsa rejects a non-65-byte signature (fail-loud)", () => {
    expect(() => packOwnerAuthEcdsa(("0x" + "ab".repeat(64)) as Hex)).toThrow(/65-byte/);
  });
});

function uint8(hex: Hex, byteIndex: number): number {
  return hexToBytes(hex)[byteIndex];
}
