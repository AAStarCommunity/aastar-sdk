Defined in: [packages/airaccount/src/auth/hardware/ledger.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/auth/hardware/ledger.ts#L22)

ledger.ts — Ledger hardware wallet signer for AirAccount M7.

Produces an ECDSA (algId=0x02) UserOp signature using a Ledger device
connected via WebHID in the browser.

Signature format (66 bytes):
  [0x02][r(32)][s(32)][v(1)]

The contract's _validateECDSA applies EIP-191 prefix, so Ledger's
signPersonalMessage (which also adds EIP-191 prefix) matches exactly.

Requirements:
  - Browser environment with WebHID support (Chrome/Edge 89+)
  - @ledgerhq/hw-transport-webhid
  - @ledgerhq/hw-app-eth

## Properties

### derivationPath?

> `optional` **derivationPath**: `string`

Defined in: [packages/airaccount/src/auth/hardware/ledger.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/auth/hardware/ledger.ts#L27)

BIP-44 derivation path. Defaults to the first Ethereum account.
Use Ledger Live's "m/44'/60'/0'/0/0" for the default account.
