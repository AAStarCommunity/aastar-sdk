> **buildAuthenticationCredential**(`opts`): `Promise`\<[`WebAuthnAuthenticationCredential`](../interfaces/WebAuthnAuthenticationCredential.md)\>

Defined in: [packages/airaccount/src/server/services/webauthn-ceremony.ts:181](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/webauthn-ceremony.ts#L181)

Build a complete WebAuthn AuthenticationResponseJSON for a dynamic TA
challenge: construct clientDataJSON (embedding the challenge) + authenticatorData,
then sign (authenticatorData || SHA-256(clientDataJSON)).

## Parameters

| Parameter | Type |
| ------ | ------ |
| `opts` | [`BuildCredentialOptions`](../interfaces/BuildCredentialOptions.md) |

## Returns

`Promise`\<[`WebAuthnAuthenticationCredential`](../interfaces/WebAuthnAuthenticationCredential.md)\>
