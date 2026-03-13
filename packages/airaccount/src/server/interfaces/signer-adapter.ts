import { ethers } from "ethers";
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
 */
export interface ISignerAdapter {
  /** Get the EOA address for a given user. */
  getAddress(userId: string): Promise<string>;

  /** Get an ethers Signer instance for a given user. */
  getSigner(userId: string, ctx?: PasskeyAssertionContext): Promise<ethers.Signer>;

  /**
   * Ensure a signer exists for the user (create on demand if needed).
   * Returns the signer and its address.
   */
  ensureSigner(userId: string): Promise<{ signer: ethers.Signer; address: string }>;
}
