import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { ISignerAdapter, SignerAuthContext } from "../interfaces/signer-adapter";

/**
 * Local wallet signer — backs all users with a single private key.
 * Suitable for testing, demos, and single-tenant server setups.
 *
 * For multi-tenant production use, implement ISignerAdapter with
 * per-user key management (e.g., KMS, HSM, or encrypted database).
 */
export class LocalWalletSigner implements ISignerAdapter {
  private readonly account: PrivateKeyAccount;

  constructor(privateKey: string) {
    this.account = privateKeyToAccount(privateKey as `0x${string}`);
  }

  async getAddress(_userId: string): Promise<`0x${string}`> {
    return this.account.address;
  }

  async signMessage(
    _userId: string,
    message: `0x${string}` | Uint8Array,
    _ctx?: SignerAuthContext
  ): Promise<`0x${string}`> {
    // EIP-191 personal-sign over raw bytes — identical to
    // ethers `wallet.signMessage(bytes)`. `{ raw }` signs the bytes as-is
    // (no UTF-8 reinterpretation of a 0x hex digest).
    return this.account.signMessage({ message: { raw: message } });
  }

  async ensureSigner(_userId: string): Promise<{ address: `0x${string}` }> {
    return { address: this.account.address };
  }
}
