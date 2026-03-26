/**
 * yubikey.ts — YubiKey / FIDO2 hardware wallet signer for AirAccount M7.
 *
 * Uses navigator.credentials.get() (WebAuthn CTAP2) to produce a P256
 * signature from a YubiKey or any FIDO2 security key that stores a P-256
 * credential.
 *
 * Signature format (65 bytes):
 *   [0x03][r(32)][s(32)]
 *
 * Compatible with AirAccount algId=0x03 (P256) when the account has been
 * initialized with the matching P256 public key via setP256Key(x, y).
 *
 * ⚠ WebAuthn authentication note:
 *   Standard WebAuthn signs `authData || SHA256(clientDataJSON)`, not the
 *   raw userOpHash. The P256 signature is VALID for the WebAuthn assertion
 *   but NOT directly verifiable by the contract's _validateP256() which
 *   expects a signature directly over `userOpHash`.
 *
 *   Use cases:
 *   1. Tier 2/3 composite signatures (server-verifies WebAuthn assertion).
 *   2. Standalone algId=0x03: requires EIP-7212 raw P256 signing, which is
 *      NOT standard WebAuthn. For this use case, pair with a server that
 *      relays the FIDO2 assertion and verifies it off-chain, or use a
 *      purpose-built Ethereum app on the YubiKey (e.g. Keystone firmware).
 *
 * Requirements:
 *   - Browser environment with WebAuthn support
 *   - YubiKey or FIDO2 device with a P-256 credential registered
 */

export interface YubiKeySigner {
  /**
   * Trigger a WebAuthn assertion and return the raw P256 signature bytes
   * formatted as [0x03][r(32)][s(32)] for AirAccount algId=0x03.
   *
   * The `challenge` is set to the userOpHash bytes so the assertion is
   * cryptographically bound to this specific UserOp.
   *
   * Compatible with the `signer` field of AirAccountProviderConfig (for
   * Tier 2/3 flows where the server validates the WebAuthn assertion).
   */
  sign(userOpHash: `0x${string}`): Promise<`0x${string}`>;
}

export interface YubiKeySignerConfig {
  /**
   * The credential ID(s) of the registered YubiKey P256 credential.
   * If empty, any FIDO2 resident credential is allowed (discoverable mode).
   */
  credentialIds?: Uint8Array[];

  /**
   * Relying Party ID (rpId), typically the website's eTLD+1.
   * Defaults to window.location.hostname.
   */
  rpId?: string;

  /**
   * Timeout for the WebAuthn request in milliseconds. Default: 60 000.
   */
  timeout?: number;
}

/**
 * Create a YubiKey / FIDO2 P256 signer using WebAuthn.
 *
 * @example
 * ```ts
 * const signer = createYubiKeySigner({
 *   credentialIds: [base64UrlToBuffer(storedCredentialId)],
 * });
 * const provider = new AirAccountEIP1193Provider({
 *   ...,
 *   signer: (hash) => signer.sign(hash),
 * });
 * ```
 */
export function createYubiKeySigner(config: YubiKeySignerConfig = {}): YubiKeySigner {
  return {
    async sign(userOpHash: `0x${string}`): Promise<`0x${string}`> {
      const challenge = hexToBytes(userOpHash);
      const rpId = config.rpId ?? window.location.hostname;

      const allowCredentials: PublicKeyCredentialDescriptor[] = (config.credentialIds ?? []).map(
        (id) => ({ type: "public-key", id }),
      );

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId,
          timeout: config.timeout ?? 60_000,
          userVerification: "preferred",
          allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
        },
      });

      if (!assertion || assertion.type !== "public-key") {
        throw new Error("WebAuthn assertion failed or no credential returned");
      }

      const authAssertion = assertion as PublicKeyCredential;
      const response = authAssertion.response as AuthenticatorAssertionResponse;

      // Extract raw (r, s) from DER-encoded P256 signature
      const { r, s } = decodeDerSignature(new Uint8Array(response.signature));

      // Format: algId=0x03 + r(32) + s(32) = 65 bytes
      return `0x03${bytesToHex(r)}${bytesToHex(s)}`;
    },
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Decode ASN.1 DER-encoded ECDSA signature into raw (r, s) bytes (32 bytes each). */
function decodeDerSignature(der: Uint8Array): { r: Uint8Array; s: Uint8Array } {
  // DER format: 0x30 [total-len] 0x02 [r-len] [r-bytes] 0x02 [s-len] [s-bytes]
  if (der[0] !== 0x30) throw new Error("Invalid DER signature: expected SEQUENCE tag 0x30");

  let offset = 2; // skip 0x30 and total-length byte

  if (der[offset] !== 0x02) throw new Error("Invalid DER signature: expected INTEGER tag 0x02");
  offset++;
  const rLen = der[offset++];
  // DER may prefix 0x00 for positive integers (rLen=33); or omit leading zeros (rLen<32)
  const rStart = rLen > 32 ? offset + 1 : offset;
  const rActualLen = rLen > 32 ? rLen - 1 : rLen;
  const r = der.slice(rStart, rStart + rActualLen);
  offset += rLen;

  if (der[offset] !== 0x02) throw new Error("Invalid DER signature: expected INTEGER tag 0x02");
  offset++;
  const sLen = der[offset++];
  const sStart = sLen > 32 ? offset + 1 : offset;
  const sActualLen = sLen > 32 ? sLen - 1 : sLen;
  const s = der.slice(sStart, sStart + sActualLen);

  return { r: padTo32(r), s: padTo32(s) };
}

/** Left-pad byte array to 32 bytes. */
function padTo32(bytes: Uint8Array): Uint8Array {
  if (bytes.length === 32) return bytes;
  const padded = new Uint8Array(32);
  padded.set(bytes, 32 - bytes.length);
  return padded;
}

/** Convert hex string (with or without "0x") to Uint8Array. */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Convert Uint8Array to lowercase hex string (without "0x"). */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
