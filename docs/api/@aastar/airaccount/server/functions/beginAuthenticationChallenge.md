> **beginAuthenticationChallenge**(`http`, `keyId`): `Promise`\<[`BeginCeremonyResponse`](../interfaces/BeginCeremonyResponse.md)\>

Defined in: [packages/airaccount/src/server/services/webauthn-ceremony.ts:262](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/webauthn-ceremony.ts#L262)

Fetch a generic authentication challenge (purpose="authentication").

## Parameters

| Parameter | Type |
| ------ | ------ |
| `http` | [`KmsHttpClient`](../classes/KmsHttpClient.md) |
| `keyId` | `string` |

## Returns

`Promise`\<[`BeginCeremonyResponse`](../interfaces/BeginCeremonyResponse.md)\>
