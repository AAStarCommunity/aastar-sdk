Defined in: [packages/airaccount/src/auth/hardware/yubikey.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/auth/hardware/yubikey.ts#L46)

## Properties

### credentialIds?

> `optional` **credentialIds**: `Uint8Array`[]

Defined in: [packages/airaccount/src/auth/hardware/yubikey.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/auth/hardware/yubikey.ts#L51)

The credential ID(s) of the registered YubiKey P256 credential.
If empty, any FIDO2 resident credential is allowed (discoverable mode).

***

### rpId?

> `optional` **rpId**: `string`

Defined in: [packages/airaccount/src/auth/hardware/yubikey.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/auth/hardware/yubikey.ts#L57)

Relying Party ID (rpId), typically the website's eTLD+1.
Defaults to window.location.hostname.

***

### timeout?

> `optional` **timeout**: `number`

Defined in: [packages/airaccount/src/auth/hardware/yubikey.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/auth/hardware/yubikey.ts#L62)

Timeout for the WebAuthn request in milliseconds. Default: 60 000.
