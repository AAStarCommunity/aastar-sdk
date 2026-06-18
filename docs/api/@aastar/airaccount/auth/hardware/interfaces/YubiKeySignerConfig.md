Defined in: [packages/airaccount/src/auth/hardware/yubikey.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/auth/hardware/yubikey.ts#L46)

## Properties

### credentialIds?

> `optional` **credentialIds**: `Uint8Array`[]

Defined in: [packages/airaccount/src/auth/hardware/yubikey.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/auth/hardware/yubikey.ts#L51)

The credential ID(s) of the registered YubiKey P256 credential.
If empty, any FIDO2 resident credential is allowed (discoverable mode).

***

### rpId?

> `optional` **rpId**: `string`

Defined in: [packages/airaccount/src/auth/hardware/yubikey.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/auth/hardware/yubikey.ts#L57)

Relying Party ID (rpId), typically the website's eTLD+1.
Defaults to window.location.hostname.

***

### timeout?

> `optional` **timeout**: `number`

Defined in: [packages/airaccount/src/auth/hardware/yubikey.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/auth/hardware/yubikey.ts#L62)

Timeout for the WebAuthn request in milliseconds. Default: 60 000.
