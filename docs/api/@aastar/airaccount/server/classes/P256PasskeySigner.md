Defined in: [packages/airaccount/src/server/services/webauthn-ceremony.ts:109](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/webauthn-ceremony.ts#L109)

Server/test [PasskeyCeremonySigner](../interfaces/PasskeyCeremonySigner.md) backed by a raw P-256 private key
(the passkey bound to the KMS key). Mirrors `p256_helper.py`'s
`make_ceremony_assertion`: ES256 DER signature over the WebAuthn message.

## Implements

- [`PasskeyCeremonySigner`](../interfaces/PasskeyCeremonySigner.md)

## Constructors

### Constructor

> **new P256PasskeySigner**(`privateKey`, `credentialId`): `P256PasskeySigner`

Defined in: [packages/airaccount/src/server/services/webauthn-ceremony.ts:117](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/webauthn-ceremony.ts#L117)

#### Parameters

| Parameter | Type | Default value | Description |
| ------ | ------ | ------ | ------ |
| `privateKey` | `string` \| `Uint8Array` | `undefined` | raw 32-byte P-256 scalar (Uint8Array or hex, 0x optional). |
| `credentialId` | `string` | `DEFAULT_CREDENTIAL_ID` | base64url credential id (defaults to the reference fixture). |

#### Returns

`P256PasskeySigner`

## Properties

### credentialId

> `readonly` **credentialId**: `string`

Defined in: [packages/airaccount/src/server/services/webauthn-ceremony.ts:110](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/webauthn-ceremony.ts#L110)

base64url credential id registered with the KMS for this passkey.

#### Implementation of

[`PasskeyCeremonySigner`](../interfaces/PasskeyCeremonySigner.md).[`credentialId`](../interfaces/PasskeyCeremonySigner.md#credentialid)

## Accessors

### publicKeyHex

#### Get Signature

> **get** **publicKeyHex**(): `string`

Defined in: [packages/airaccount/src/server/services/webauthn-ceremony.ts:127](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/webauthn-ceremony.ts#L127)

Uncompressed (0x04…, 65-byte) P-256 public key hex. Register this with the
KMS via CreateKey `PasskeyPublicKey` (or ChangePasskey) so the TA can verify
assertions produced by this signer.

##### Returns

`string`

## Methods

### sign()

> **sign**(`message`): `Uint8Array`

Defined in: [packages/airaccount/src/server/services/webauthn-ceremony.ts:131](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/webauthn-ceremony.ts#L131)

Sign the WebAuthn message (authenticatorData || SHA-256(clientDataJSON)).
MUST return a DER-encoded ES256 signature (ECDSA P-256 with SHA-256 applied
to the message), matching the WebAuthn wire format.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `Uint8Array` |

#### Returns

`Uint8Array`

#### Implementation of

[`PasskeyCeremonySigner`](../interfaces/PasskeyCeremonySigner.md).[`sign`](../interfaces/PasskeyCeremonySigner.md#sign)
