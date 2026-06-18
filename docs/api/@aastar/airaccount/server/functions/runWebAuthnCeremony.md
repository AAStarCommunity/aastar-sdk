> **runWebAuthnCeremony**(`begin`, `options`): `Promise`\<[`WebAuthnAssertion`](../interfaces/WebAuthnAssertion.md)\>

Defined in: [packages/airaccount/src/server/services/webauthn-ceremony.ts:238](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/webauthn-ceremony.ts#L238)

Run a full WebAuthn challenge-binding ceremony (AirAccount #49):
  1. fetch a one-time TA challenge from the `begin` endpoint,
  2. embed it in clientDataJSON,
  3. build + sign the assertion,
  4. return `{ ChallengeId, Credential }` for the KMS `WebAuthn` /
     `webAuthnAssertion` field.

`begin` is injected so the same helper serves both the generic
(purpose="authentication") and grant-session (purpose="grant-session")
challenge endpoints.

## Parameters

| Parameter | Type |
| ------ | ------ |
| `begin` | () => `Promise`\<[`BeginCeremonyResponse`](../interfaces/BeginCeremonyResponse.md)\> |
| `options` | [`RunCeremonyOptions`](../interfaces/RunCeremonyOptions.md) |

## Returns

`Promise`\<[`WebAuthnAssertion`](../interfaces/WebAuthnAssertion.md)\>
