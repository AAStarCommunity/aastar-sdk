import { ISignerAdapter, PasskeyAssertionContext } from "../interfaces/signer-adapter";

/**
 * Thin wrapper around ISignerAdapter for consistent wallet access.
 */
export class WalletManager {
  constructor(private readonly signer: ISignerAdapter) {}

  async getAddress(userId: string): Promise<`0x${string}`> {
    return this.signer.getAddress(userId);
  }

  async signMessage(
    userId: string,
    message: `0x${string}` | Uint8Array,
    ctx?: PasskeyAssertionContext
  ): Promise<`0x${string}`> {
    return this.signer.signMessage(userId, message, ctx);
  }

  async ensureSigner(userId: string): Promise<{ address: `0x${string}` }> {
    return this.signer.ensureSigner(userId);
  }
}
