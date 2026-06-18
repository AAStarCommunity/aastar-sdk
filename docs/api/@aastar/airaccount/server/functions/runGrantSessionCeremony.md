> **runGrantSessionCeremony**(`http`, `keyId`, `signer`, `options?`): `Promise`\<[`WebAuthnAssertion`](../interfaces/WebAuthnAssertion.md)\>

Defined in: [packages/airaccount/src/server/services/webauthn-ceremony.ts:301](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/webauthn-ceremony.ts#L301)

Convenience: run a grant-session ceremony over an [KmsHttpClient](../classes/KmsHttpClient.md).
Required by sign-grant-session / sign-p256-grant-session, which reject the
generic 'authentication' challenge for cross-op replay safety.

## Parameters

| Parameter | Type |
| ------ | ------ |
| `http` | [`KmsHttpClient`](../classes/KmsHttpClient.md) |
| `keyId` | `string` |
| `signer` | [`PasskeyCeremonySigner`](../interfaces/PasskeyCeremonySigner.md) |
| `options?` | `Omit`\<[`RunCeremonyOptions`](../interfaces/RunCeremonyOptions.md), `"signer"`\> |

## Returns

`Promise`\<[`WebAuthnAssertion`](../interfaces/WebAuthnAssertion.md)\>
