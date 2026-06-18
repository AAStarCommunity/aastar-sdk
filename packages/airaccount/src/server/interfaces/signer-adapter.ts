import { LegacyPasskeyAssertion } from "../services/kms-signer";

/**
 * Context for passing Passkey assertion data through the signing chain.
 * Used by KMS-backed signers to authenticate signing operations.
 */
export interface PasskeyAssertionContext {
  assertion: LegacyPasskeyAssertion;
}

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
   * @param ctx optional Passkey assertion context for KMS-backed signers.
   */
  signMessage(
    userId: string,
    message: `0x${string}` | Uint8Array,
    ctx?: PasskeyAssertionContext
  ): Promise<`0x${string}`>;

  /**
   * Ensure a signer exists for the user (create on demand if needed).
   * Returns the signer's address.
   */
  ensureSigner(userId: string): Promise<{ address: `0x${string}` }>;
}
