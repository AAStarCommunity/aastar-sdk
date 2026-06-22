import { createHash } from "node:crypto";
import { p256 } from "@noble/curves/nist.js";
import { KmsHttpClient } from "./kms-http-client";
import { WebAuthnAssertion } from "./kms-signer";

// ─────────────────────────────────────────────────────────────────────────
// WebAuthn challenge-binding ceremony (AirAccount KMS #49 / Beta3)
//
// The KMS now issues a one-time challenge (nonce) from a `begin` endpoint and
// requires that nonce to be embedded in the WebAuthn `clientDataJSON` of the
// assertion submitted to the signing endpoints. This binds each signature to a
// fresh server-issued challenge → replay protection.
//
// Transition vs. strict mode (KMS-side `ENFORCE_TA_CHALLENGE`):
//   - transition (current): requests WITH clientDataJSON get strict nonce
//     validation; requests WITHOUT it fall back to legacy ECDSA-only.
//   - strict (pre-mainnet flip): requests WITHOUT clientDataJSON are REJECTED.
// This module always produces the clientDataJSON-bound assertion, so it is
// correct under both modes.
//
// Wire format mirrors the authoritative reference ceremony:
//   AirAccount/kms/test/run-full-e2e.sh  (ceremony / ceremony_grant)
//   AirAccount/kms/test/p256_helper.py   (make_ceremony_assertion)
// ─────────────────────────────────────────────────────────────────────────

/**
 * RP id the TA verifies against. The TA hardcodes
 * `EXPECTED_RP_ID_HASH = SHA-256("aastar.io")` (AirAccount PR#44 / Issue #39);
 * any other rpId makes the TA reject the assertion with "rpId hash mismatch".
 */
export const DEFAULT_RP_ID = "aastar.io";

/** Origin embedded in clientDataJSON — must be the RP origin the TA expects. */
export const DEFAULT_ORIGIN = "https://aastar.io";

/**
 * Placeholder credential id (base64url of "test-credential") matching the
 * reference ceremony fixtures. Production callers SHOULD pass the credential id
 * returned by CompleteRegistration for the registered passkey.
 */
export const DEFAULT_CREDENTIAL_ID = "dGVzdC1jcmVkZW50aWFs";

// ── base64url (no padding) — the WebAuthn wire encoding ───────────────────

export function base64UrlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export function base64UrlDecode(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) {
    throw new Error("hexToBytes: odd-length hex string");
  }
  // Reject non-hex chars — `parseInt("zz",16)` is NaN → silently stored as 0, which would
  // yield a deterministic-but-WRONG commitment (PR #137 Codex review, Medium).
  if (clean.length > 0 && !/^[0-9a-fA-F]+$/.test(clean)) {
    throw new Error("hexToBytes: non-hex characters in input");
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// ── Types ─────────────────────────────────────────────────────────────────

/**
 * WebAuthn AuthenticationResponseJSON (the subset the KMS verifies). This is the
 * value placed in `WebAuthnAssertion.Credential`.
 */
export interface WebAuthnAuthenticationCredential {
  id: string;
  rawId: string;
  type: "public-key";
  response: {
    clientDataJSON: string; // base64url(JSON embedding the TA challenge)
    authenticatorData: string; // base64url(rpIdHash || flags || signCount)
    signature: string; // base64url(DER ECDSA P-256 / ES256)
    userHandle?: string;
  };
  clientExtensionResults?: Record<string, unknown>;
}

/**
 * Pluggable passkey signer. The ceremony helper builds clientDataJSON +
 * authenticatorData and computes the WebAuthn message
 * (authenticatorData || SHA-256(clientDataJSON)); this signer turns that message
 * into an ES256 (ECDSA P-256 over SHA-256) DER signature.
 *
 * Browser callers back this with the platform authenticator; server/test callers
 * use {@link P256PasskeySigner}.
 */
export interface PasskeyCeremonySigner {
  /** base64url credential id registered with the KMS for this passkey. */
  readonly credentialId: string;
  /**
   * Sign the WebAuthn message (authenticatorData || SHA-256(clientDataJSON)).
   * MUST return a DER-encoded ES256 signature (ECDSA P-256 with SHA-256 applied
   * to the message), matching the WebAuthn wire format.
   */
  sign(message: Uint8Array): Uint8Array | Promise<Uint8Array>;
}

/**
 * Server/test {@link PasskeyCeremonySigner} backed by a raw P-256 private key
 * (the passkey bound to the KMS key). Mirrors `p256_helper.py`'s
 * `make_ceremony_assertion`: ES256 DER signature over the WebAuthn message.
 */
export class P256PasskeySigner implements PasskeyCeremonySigner {
  readonly credentialId: string;
  private readonly privateKey: Uint8Array;

  /**
   * @param privateKey raw 32-byte P-256 scalar (Uint8Array or hex, 0x optional).
   * @param credentialId base64url credential id (defaults to the reference fixture).
   */
  constructor(privateKey: Uint8Array | string, credentialId: string = DEFAULT_CREDENTIAL_ID) {
    this.privateKey = typeof privateKey === "string" ? hexToBytes(privateKey) : privateKey;
    this.credentialId = credentialId;
  }

  /**
   * Uncompressed (0x04…, 65-byte) P-256 public key hex. Register this with the
   * KMS via CreateKey `PasskeyPublicKey` (or ChangePasskey) so the TA can verify
   * assertions produced by this signer.
   */
  get publicKeyHex(): string {
    return "0x" + Buffer.from(p256.getPublicKey(this.privateKey, false)).toString("hex");
  }

  sign(message: Uint8Array): Uint8Array {
    // prehash:true → noble applies SHA-256 to `message` (= ES256), DER output.
    return p256.sign(message, this.privateKey, { prehash: true, format: "der" });
  }
}

// ── Builders ────────────────────────────────────────────────────────────

/**
 * Build the clientDataJSON bytes embedding the TA-issued one-time challenge.
 *
 * Compact JSON (no whitespace) with field order `type, challenge, origin`,
 * mirroring the reference ceremony. The KMS parses this and asserts the
 * `challenge` field equals the stored nonce before verifying the signature over
 * (authenticatorData || SHA-256(clientDataJSON)).
 */
export function buildClientDataJSON(challenge: string, origin: string = DEFAULT_ORIGIN): Uint8Array {
  const json = JSON.stringify({ type: "webauthn.get", challenge, origin });
  return new TextEncoder().encode(json);
}

/**
 * Build authenticatorData = rpIdHash(32) || flags(1) || signCount(4, big-endian).
 * flags = 0x05 (UP | UV). `signCount` must strictly increase across ceremonies
 * for the same wallet (anti-clone check); callers performing multiple sequential
 * signs should pass an incrementing value.
 */
export function buildAuthenticatorData(rpId: string = DEFAULT_RP_ID, signCount: number = 1): Uint8Array {
  // Validate up front (PR #136 NEW-4): a non-integer / out-of-u32 value would silently wrap
  // via `>>> 0` and could produce a counter ≤ the stored one (fail-closed reject at the KMS).
  if (!Number.isInteger(signCount) || signCount < 0 || signCount > 0xffffffff) {
    throw new Error(`buildAuthenticatorData: signCount must be a uint32 (0..2^32-1), got ${signCount}`);
  }
  const rpIdHash = createHash("sha256").update(rpId).digest();
  const out = new Uint8Array(37);
  out.set(rpIdHash, 0);
  out[32] = 0x05; // UP | UV
  new DataView(out.buffer).setUint32(33, signCount, false);
  return out;
}

export interface BuildCredentialOptions {
  /** The base64url challenge returned by the begin endpoint. */
  challenge: string;
  signer: PasskeyCeremonySigner;
  rpId?: string;
  origin?: string;
  signCount?: number;
}

/**
 * Build a complete WebAuthn AuthenticationResponseJSON for a dynamic TA
 * challenge: construct clientDataJSON (embedding the challenge) + authenticatorData,
 * then sign (authenticatorData || SHA-256(clientDataJSON)).
 */
export async function buildAuthenticationCredential(
  opts: BuildCredentialOptions
): Promise<WebAuthnAuthenticationCredential> {
  const origin = opts.origin ?? DEFAULT_ORIGIN;
  const rpId = opts.rpId ?? DEFAULT_RP_ID;
  const signCount = opts.signCount ?? 1;

  const clientDataJSON = buildClientDataJSON(opts.challenge, origin);
  const authenticatorData = buildAuthenticatorData(rpId, signCount);
  const clientDataHash = createHash("sha256").update(clientDataJSON).digest();

  // WebAuthn message: authenticatorData || SHA-256(clientDataJSON).
  const message = new Uint8Array(authenticatorData.length + clientDataHash.length);
  message.set(authenticatorData, 0);
  message.set(clientDataHash, authenticatorData.length);

  const signature = await opts.signer.sign(message);

  return {
    id: opts.signer.credentialId,
    rawId: opts.signer.credentialId,
    type: "public-key",
    response: {
      clientDataJSON: base64UrlEncode(clientDataJSON),
      authenticatorData: base64UrlEncode(authenticatorData),
      signature: base64UrlEncode(signature),
    },
  };
}

// ── Orchestration: begin → embed → assert ─────────────────────────────────

/** Minimal shape returned by BeginAuthentication / begin-grant-session-auth. */
export interface BeginCeremonyResponse {
  ChallengeId: string;
  Options: { challenge: string };
}

export interface RunCeremonyOptions {
  signer: PasskeyCeremonySigner;
  rpId?: string;
  origin?: string;
  signCount?: number;
  /**
   * The 32-byte payload digest being authorized (e.g. the SignHash hash). When set,
   * the WebAuthn challenge is bound to it as `SHA-256(nonce ‖ payload)` instead of the
   * raw nonce — this is the "what you see is what you sign" (WYSIWYS) commitment the
   * TA verifies (AirAccount #68). REQUIRED once the KMS runs in strict mode
   * (`--features strict-challenge`); in the default transition mode the raw nonce is
   * still accepted. Omit only for non-signing ceremonies (none today). Accepts a
   * Uint8Array or a `0x` hex string.
   */
  payload?: Uint8Array | `0x${string}`;
}

/**
 * Compute the WYSIWYS-bound WebAuthn challenge for a signing ceremony:
 * `base64url( SHA-256( decode(nonce) ‖ payload ) )`.
 *
 * `nonce` is the base64url challenge from BeginAuthentication; `payload` is the 32-byte
 * digest about to be signed (the SignHash hash). The KMS/TA recomputes this exact value
 * and rejects the signature if it doesn't match (AirAccount #68). Use this in a browser
 * frontend that builds its own WebAuthn assertion for a device passkey, so the per-call
 * `webAuthnAssertion` it sends commits to the operation hash.
 */
export function commitChallenge(nonceBase64Url: string, payload: Uint8Array | `0x${string}`): string {
  const nonce = base64UrlDecode(nonceBase64Url);
  const payloadBytes = typeof payload === "string" ? hexToBytes(payload) : payload;
  // The payload is always a 32-byte digest (signHash hash / EIP-712 digest / grant final_hash).
  // Reject anything else — a short/empty payload (e.g. "0x") would commit to the wrong thing
  // and the KMS would compute a different commitment (PR #137 Codex review).
  if (payloadBytes.length !== 32) {
    throw new Error(`commitChallenge: payload must be a 32-byte digest, got ${payloadBytes.length} bytes`);
  }
  const committed = createHash("sha256").update(nonce).update(payloadBytes).digest();
  return base64UrlEncode(new Uint8Array(committed));
}

/**
 * Run a full WebAuthn challenge-binding ceremony (AirAccount #49):
 *   1. fetch a one-time TA challenge from the `begin` endpoint,
 *   2. embed it in clientDataJSON,
 *   3. build + sign the assertion,
 *   4. return `{ ChallengeId, Credential }` for the KMS `WebAuthn` /
 *      `webAuthnAssertion` field.
 *
 * `begin` is injected so the same helper serves both the generic
 * (purpose="authentication") and grant-session (purpose="grant-session")
 * challenge endpoints.
 */
export async function runWebAuthnCeremony(
  begin: () => Promise<BeginCeremonyResponse>,
  options: RunCeremonyOptions
): Promise<WebAuthnAssertion> {
  const begun = await begin();
  const nonce = begun?.Options?.challenge;
  if (!begun?.ChallengeId || !nonce) {
    throw new Error(
      "WebAuthn ceremony: begin endpoint did not return a ChallengeId + Options.challenge"
    );
  }
  // WYSIWYS (#68): bind the challenge to the payload via SHA-256(nonce ‖ payload). With no
  // payload we fall back to the raw nonce (transition mode only — not strict-safe).
  const challenge = options.payload ? commitChallenge(nonce, options.payload) : nonce;
  const credential = await buildAuthenticationCredential({
    challenge,
    signer: options.signer,
    rpId: options.rpId,
    origin: options.origin,
    // The KMS enforces a strictly-increasing authenticator signCount (anti-clone). A
    // server-held signer (P256PasskeySigner) has no native counter, so default to a
    // monotonic value — else a second signature on the same key fails
    // "signCount not incremented". A real device passkey passes its own counter.
    signCount: options.signCount ?? nextSignCount(),
  });
  return { ChallengeId: begun.ChallengeId, Credential: credential };
}

// Monotonic signCount for server-held ceremonies. Seeded from wall-clock seconds so it
// stays ahead of any previously-stored counter across process restarts (u32, ok until
// 2106), and increments per ceremony within a process.
//
// ⚠️ Single-process only (PR #136 NEW-2): the counter lives in this module's memory, so two
// workers signing for the SAME key can emit out-of-order signCounts → the lower one is
// fail-closed-rejected by the KMS ("signCount not incremented"; availability only, no forgery,
// retryable). MULTI-WORKER deployments must pass an explicit, shared/persisted, strictly
// increasing `options.signCount` (e.g. from Redis/DB) instead of relying on this default.
let _signCountCounter = Math.floor(Date.now() / 1000);
function nextSignCount(): number {
  _signCountCounter = (_signCountCounter + 1) >>> 0;
  return _signCountCounter;
}

// ── Begin-endpoint fetchers (shared by KmsManager + the agent/session services) ──

/** Fetch a generic authentication challenge (purpose="authentication"). */
export function beginAuthenticationChallenge(
  http: KmsHttpClient,
  keyId: string
): Promise<BeginCeremonyResponse> {
  return http.post<BeginCeremonyResponse>("/BeginAuthentication", { KeyId: keyId });
}

/** Fetch a grant-session challenge (purpose="grant-session"). */
export function beginGrantSessionChallenge(
  http: KmsHttpClient,
  keyId: string
): Promise<BeginCeremonyResponse> {
  return http.get<BeginCeremonyResponse>("/kms/begin-grant-session-auth", {
    params: { keyId },
  });
}

/**
 * Convenience: run a generic authentication ceremony over an {@link KmsHttpClient}.
 * Covers DeriveAddress / Sign / SignHash / SignTypedData / agent-key /
 * p256-session signing paths.
 */
export function runAuthenticationCeremony(
  http: KmsHttpClient,
  keyId: string,
  signer: PasskeyCeremonySigner,
  options?: Omit<RunCeremonyOptions, "signer">
): Promise<WebAuthnAssertion> {
  return runWebAuthnCeremony(() => beginAuthenticationChallenge(http, keyId), {
    signer,
    ...options,
  });
}

/**
 * Convenience: run a grant-session ceremony over an {@link KmsHttpClient}.
 * Required by sign-grant-session / sign-p256-grant-session, which reject the
 * generic 'authentication' challenge for cross-op replay safety.
 */
export function runGrantSessionCeremony(
  http: KmsHttpClient,
  keyId: string,
  signer: PasskeyCeremonySigner,
  options?: Omit<RunCeremonyOptions, "signer">
): Promise<WebAuthnAssertion> {
  return runWebAuthnCeremony(() => beginGrantSessionChallenge(http, keyId), {
    signer,
    ...options,
  });
}
