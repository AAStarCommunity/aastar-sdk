> **createYubiKeySigner**(`config`): [`YubiKeySigner`](../interfaces/YubiKeySigner.md)

Defined in: [packages/airaccount/src/auth/hardware/yubikey.ts:86](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/auth/hardware/yubikey.ts#L86)

Create a YubiKey / FIDO2 P256 signer using WebAuthn.

## Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`YubiKeySignerConfig`](../interfaces/YubiKeySignerConfig.md) |

## Returns

[`YubiKeySigner`](../interfaces/YubiKeySigner.md)

## Example

```ts
const signer = createYubiKeySigner({
  credentialIds: [base64UrlToBuffer(storedCredentialId)],
});
// signer.sign() returns the raw WebAuthn P256 signature bytes.
// ⚠ This is NOT directly valid for standalone algId=0x03 on-chain verification
//   because the contract expects a signature over userOpHash directly, but
//   WebAuthn signs authData || SHA256(clientDataJSON) instead.
// For standalone algId=0x03 you need an EIP-7212-compatible Ethereum app on
//   the security key (e.g. Keystone firmware), NOT standard WebAuthn CTAP2.
//
// Correct Tier 2/3 flow:
const webAuthnAssertion = await signer.sign(userOpHash);
// Send webAuthnAssertion to your Tier 2/3 server, which verifies the WebAuthn
// assertion off-chain and returns a composite signature for the UserOp.
```
