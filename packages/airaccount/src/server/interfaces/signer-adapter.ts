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
}
