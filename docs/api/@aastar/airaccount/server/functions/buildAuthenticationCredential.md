> **buildAuthenticationCredential**(`opts`): `Promise`\<[`WebAuthnAuthenticationCredential`](../interfaces/WebAuthnAuthenticationCredential.md)\>

Defined in: [packages/airaccount/src/server/services/webauthn-ceremony.ts:181](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/webauthn-ceremony.ts#L181)

Build a complete WebAuthn AuthenticationResponseJSON for a dynamic TA
challenge: construct clientDataJSON (embedding the challenge) + authenticatorData,
then sign (authenticatorData || SHA-256(clientDataJSON)).

## Parameters

| Parameter | Type |
| ------ | ------ |
| `opts` | [`BuildCredentialOptions`](../interfaces/BuildCredentialOptions.md) |

## Returns

`Promise`\<[`WebAuthnAuthenticationCredential`](../interfaces/WebAuthnAuthenticationCredential.md)\>
