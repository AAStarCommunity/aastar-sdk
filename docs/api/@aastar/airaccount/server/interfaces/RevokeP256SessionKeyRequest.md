Defined in: [packages/airaccount/src/server/services/kms-session-service.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-session-service.ts#L54)

## Properties

### keyId

> **keyId**: `string`

Defined in: [packages/airaccount/src/server/services/kms-session-service.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-session-service.ts#L55)

***

### webAuthnAssertion?

> `optional` **webAuthnAssertion**: [`WebAuthnAssertion`](WebAuthnAssertion.md)

Defined in: [packages/airaccount/src/server/services/kms-session-service.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-session-service.ts#L61)

One-time WebAuthn assertion gating revocation. The challenge comes from a
generic [KmsManager.beginAuthentication](../classes/KmsManager.md#beginauthentication) ceremony — the caller runs
the ceremony and supplies the resulting assertion here.
