Defined in: [packages/airaccount/src/auth/hardware/yubikey.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/auth/hardware/yubikey.ts#L32)

yubikey.ts — YubiKey / FIDO2 hardware wallet signer for AirAccount M7.

Uses navigator.credentials.get() (WebAuthn CTAP2) to produce a P256
signature from a YubiKey or any FIDO2 security key that stores a P-256
credential.

Signature format (65 bytes):
  [0x03][r(32)][s(32)]

Compatible with AirAccount algId=0x03 (P256) when the account has been
initialized with the matching P256 public key via setP256Key(x, y).

⚠ WebAuthn authentication note:
  Standard WebAuthn signs `authData || SHA256(clientDataJSON)`, not the
  raw userOpHash. The P256 signature is VALID for the WebAuthn assertion
  but NOT directly verifiable by the contract's _validateP256() which
  expects a signature directly over `userOpHash`.

  Use cases:
  1. Tier 2/3 composite signatures (server-verifies WebAuthn assertion).
  2. Standalone algId=0x03: requires EIP-7212 raw P256 signing, which is
     NOT standard WebAuthn. For this use case, pair with a server that
     relays the FIDO2 assertion and verifies it off-chain, or use a
     purpose-built Ethereum app on the YubiKey (e.g. Keystone firmware).

Requirements:
  - Browser environment with WebAuthn support
  - YubiKey or FIDO2 device with a P-256 credential registered

## Methods

### sign()

> **sign**(`userOpHash`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/airaccount/src/auth/hardware/yubikey.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/auth/hardware/yubikey.ts#L43)

Trigger a WebAuthn assertion and return the raw P256 signature bytes
formatted as [0x03][r(32)][s(32)] for AirAccount algId=0x03.

The `challenge` is set to the userOpHash bytes so the assertion is
cryptographically bound to this specific UserOp.

Compatible with the `signer` field of AirAccountProviderConfig (for
Tier 2/3 flows where the server validates the WebAuthn assertion).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userOpHash` | `` `0x${string}` `` |

#### Returns

`Promise`\<`` `0x${string}` ``\>
