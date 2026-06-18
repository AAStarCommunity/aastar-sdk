> **buildClientDataJSON**(`challenge`, `origin`): `Uint8Array`

Defined in: [packages/airaccount/src/server/services/webauthn-ceremony.ts:147](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/webauthn-ceremony.ts#L147)

Build the clientDataJSON bytes embedding the TA-issued one-time challenge.

Compact JSON (no whitespace) with field order `type, challenge, origin`,
mirroring the reference ceremony. The KMS parses this and asserts the
`challenge` field equals the stored nonce before verifying the signature over
(authenticatorData || SHA-256(clientDataJSON)).

## Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `challenge` | `string` | `undefined` |
| `origin` | `string` | `DEFAULT_ORIGIN` |

## Returns

`Uint8Array`
