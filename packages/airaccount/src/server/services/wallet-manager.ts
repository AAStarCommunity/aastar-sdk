import { ethers } from "ethers";
import { ISignerAdapter } from "../interfaces/signer-adapter";

/**
 * Thin wrapper around ISignerAdapter for consistent wallet access.
 */
export class WalletManager {
  constructor(private readonly signer: ISignerAdapter) {}

  async getAddress(userId: string): Promise<string> {
    return this.signer.getAddress(userId);
  }

  async getSigner(userId: string): Promise<ethers.Signer> {
    return this.signer.getSigner(userId);
  }

  async ensureSigner(userId: string): Promise<{ signer: ethers.Signer; address: string }> {
    return this.signer.ensureSigner(userId);
  }
}
