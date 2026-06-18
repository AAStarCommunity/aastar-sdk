Defined in: [packages/airaccount/src/server/services/webauthn-ceremony.ts:93](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/webauthn-ceremony.ts#L93)

Pluggable passkey signer. The ceremony helper builds clientDataJSON +
authenticatorData and computes the WebAuthn message
(authenticatorData || SHA-256(clientDataJSON)); this signer turns that message
into an ES256 (ECDSA P-256 over SHA-256) DER signature.

Browser callers back this with the platform authenticator; server/test callers
use [P256PasskeySigner](../classes/P256PasskeySigner.md).

## Properties

### credentialId

> `readonly` **credentialId**: `string`

Defined in: [packages/airaccount/src/server/services/webauthn-ceremony.ts:95](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/webauthn-ceremony.ts#L95)

base64url credential id registered with the KMS for this passkey.

## Methods

### sign()

> **sign**(`message`): `Uint8Array` \| `Promise`\<`Uint8Array`\>

Defined in: [packages/airaccount/src/server/services/webauthn-ceremony.ts:101](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/webauthn-ceremony.ts#L101)

Sign the WebAuthn message (authenticatorData || SHA-256(clientDataJSON)).
MUST return a DER-encoded ES256 signature (ECDSA P-256 with SHA-256 applied
to the message), matching the WebAuthn wire format.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `Uint8Array` |

#### Returns

`Uint8Array` \| `Promise`\<`Uint8Array`\>
