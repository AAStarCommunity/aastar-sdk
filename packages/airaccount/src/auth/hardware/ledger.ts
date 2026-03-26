/**
 * ledger.ts — Ledger hardware wallet signer for AirAccount M7.
 *
 * Produces an ECDSA (algId=0x02) UserOp signature using a Ledger device
 * connected via WebHID in the browser.
 *
 * Signature format (66 bytes):
 *   [0x02][r(32)][s(32)][v(1)]
 *
 * The contract's _validateECDSA applies EIP-191 prefix, so Ledger's
 * signPersonalMessage (which also adds EIP-191 prefix) matches exactly.
 *
 * Requirements:
 *   - Browser environment with WebHID support (Chrome/Edge 89+)
 *   - @ledgerhq/hw-transport-webhid
 *   - @ledgerhq/hw-app-eth
 */

// Dynamic imports keep Ledger packages out of the main bundle for non-Ledger users.
// Call connectLedger() once and keep the signer for the session.

export interface LedgerSignerConfig {
  /**
   * BIP-44 derivation path. Defaults to the first Ethereum account.
   * Use Ledger Live's "m/44'/60'/0'/0/0" for the default account.
   */
  derivationPath?: string;
}

/** Ledger signer instance returned by connectLedger(). */
export interface LedgerSigner {
  /**
   * Returns the account address for the configured derivation path.
   * Use this to verify the Ledger matches the expected account owner.
   */
  getAddress(): Promise<string>;

  /**
   * Signs the UserOp hash and returns a 66-byte hex signature
   * formatted as [0x02][r(32)][s(32)][v(1)] for algId=0x02 (ECDSA).
   *
   * Compatible with the `signer` field of AirAccountProviderConfig.
   */
  sign(userOpHash: `0x${string}`): Promise<`0x${string}`>;

  /** Disconnect and release the WebHID device. */
  disconnect(): Promise<void>;
}

/**
 * Connect to a Ledger device via WebHID and return a LedgerSigner.
 *
 * Must be called in response to a user gesture (button click, etc.) because
 * WebHID requestDevice() requires user activation.
 *
 * @example
 * ```ts
 * const signer = await connectLedger();
 * const address = await signer.getAddress();
 * const provider = new AirAccountEIP1193Provider({
 *   ...,
 *   accountAddress: myAirAccountAddress,
 *   signer: (hash) => signer.sign(hash),
 * });
 * ```
 */
export async function connectLedger(config: LedgerSignerConfig = {}): Promise<LedgerSigner> {
  const path = config.derivationPath ?? "m/44'/60'/0'/0/0";

  // Dynamic imports — only loaded when Ledger is actually used
  const [{ default: TransportWebHID }, { default: AppEth }] = await Promise.all([
    import("@ledgerhq/hw-transport-webhid"),
    import("@ledgerhq/hw-app-eth"),
  ]);

  const transport = await TransportWebHID.create();
  const eth = new AppEth(transport);

  return {
    async getAddress(): Promise<string> {
      const result = await eth.getAddress(path);
      return result.address;
    },

    async sign(userOpHash: `0x${string}`): Promise<`0x${string}`> {
      // Strip "0x" — Ledger signPersonalMessage takes raw hex (no prefix)
      const msgHex = userOpHash.slice(2);
      const result = await eth.signPersonalMessage(path, msgHex);

      // Ledger returns v as decimal number, r and s as hex strings without "0x"
      const v = result.v;
      const r = result.r.padStart(64, "0");
      const s = result.s.padStart(64, "0");

      // Normalize v: Ledger returns 0/1 or 27/28; contract normalizes internally (v<27 → v+=27)
      // but we send the raw value and let the contract handle it.
      const vHex = v.toString(16).padStart(2, "0");

      // Format: algId=0x02 + r(32) + s(32) + v(1) = 66 bytes
      return `0x02${r}${s}${vHex}`;
    },

    async disconnect(): Promise<void> {
      await transport.close();
    },
  };
}
