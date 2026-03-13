import { ethers } from "ethers";
import { ISignerAdapter, PasskeyAssertionContext } from "../interfaces/signer-adapter";

/**
 * Local wallet signer — backs all users with a single private key.
 * Suitable for testing, demos, and single-tenant server setups.
 *
 * For multi-tenant production use, implement ISignerAdapter with
 * per-user key management (e.g., KMS, HSM, or encrypted database).
 */
export class LocalWalletSigner implements ISignerAdapter {
  private readonly wallet: ethers.Wallet;

  constructor(privateKey: string, provider?: ethers.Provider) {
    this.wallet = new ethers.Wallet(privateKey, provider);
  }

  async getAddress(_userId: string): Promise<string> {
    return this.wallet.address;
  }

  async getSigner(_userId: string, _ctx?: PasskeyAssertionContext): Promise<ethers.Signer> {
    return this.wallet;
  }

  async ensureSigner(_userId: string): Promise<{ signer: ethers.Signer; address: string }> {
    return { signer: this.wallet, address: this.wallet.address };
  }
}
