import { LegacyPasskeyAssertion, WebAuthnAssertion } from "../services/kms-signer";

/**
 * Context for passing a LEGACY raw passkey assertion through the signing chain.
 *
 * @deprecated KMS v0.20.0+ rejects legacy raw passkey assertions for signing
 * (no challenge binding → replayable). Prefer {@link WebAuthnCeremonyContext}.
 */
export interface PasskeyAssertionContext {
  assertion: LegacyPasskeyAssertion;
}

/**
 * Context carrying a one-time, challenge-bound WebAuthn ceremony assertion
 * (the replay-safe path the KMS now requires). In server transfer flows the
 * passkey lives on the USER's device: the frontend runs the BeginAuthentication
 * ceremony and the backend forwards the resulting `{ ChallengeId, Credential }`.
 * Each assertion is one-time — a flow needing N signatures supplies N of them.
 */
export interface WebAuthnCeremonyContext {
  webAuthnAssertion: WebAuthnAssertion;
}

/** Either auth context accepted by a KMS-backed signer. */
export type SignerAuthContext = PasskeyAssertionContext | WebAuthnCeremonyContext;

/**
 * Pluggable signer adapter — replaces NestJS AuthService wallet management.
 * Implement this to provide signing capabilities from your key management system.
 *
 * Narrow by design: the only operations the SDK performs are EOA address
 * lookup and EIP-191 personal-sign over a digest. There is no transaction
 * signing / provider connection — that lives in the bundler/UserOp path.
 */
export interface ISignerAdapter {
  /** Get the EOA address for a given user. */
  getAddress(userId: string): Promise<`0x${string}`>;

  /**
   * Sign a message for a given user, applying EIP-191 personal-sign semantics
   * (equivalent to ethers `signer.signMessage(bytes)` / viem
   * `account.signMessage({ raw: bytes })`). A `Uint8Array` (or raw `0x` hex) is
   * signed as raw bytes — callers pass a 32-byte digest, NOT UTF-8 text.
   *
   * @param ctx optional auth context for KMS-backed signers — a one-time
   *   {@link WebAuthnCeremonyContext} (preferred) or a legacy
   *   {@link PasskeyAssertionContext}.
   */
  signMessage(
    userId: string,
    message: `0x${string}` | Uint8Array,
    ctx?: SignerAuthContext
  ): Promise<`0x${string}`>;

  /**
   * Ensure a signer exists for the user (create on demand if needed).
   * Returns the signer's address.
   */
  ensureSigner(userId: string): Promise<{ address: `0x${string}` }>;

  /**
   * Begin a challenge-bound ceremony for a payload the FRONTEND will sign with the
   * user's device passkey (the two-phase / "case B" strict path). The adapter:
   *   1. starts a KMS BeginAuthentication ceremony for the user's key,
   *   2. computes the WYSIWYS commitment `challenge = SHA-256(nonce ‖ sign-digest(message))`
   *      — the SAME digest {@link signMessage} would sign — so the SDK owns the payload and
   *      the frontend never guesses it,
   *   3. returns the credential-request options with `challenge` already set to that commitment.
   *
   * The frontend runs `navigator.credentials.get(publicKeyOptions)`; the resulting assertion is
   * passed back via {@link WebAuthnCeremonyContext} to {@link signMessage} (whose digest matches
   * the committed one, so the KMS accepts it under strict mode).
   *
   * Optional: only KMS-backed adapters that support the strict device-passkey path implement it.
   */
  beginCeremony?(
    userId: string,
    message: `0x${string}` | Uint8Array
  ): Promise<{ challengeId: string; publicKeyOptions: PublicKeyCredentialRequestOptions }>;
}
