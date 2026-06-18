Defined in: [packages/airaccount/src/server/services/kms-agent-service.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-agent-service.ts#L19)

Request to mint a new agent key under an existing human key.

WebAuthn-gated: the human approves the mint with a one-time WebAuthn ceremony
(preferred) or a Legacy passkey assertion. The challenge is obtained via
[KmsManager.beginAuthentication](../classes/KmsManager.md#beginauthentication) (generic, purpose="authentication") —
the caller supplies the resulting assertion here.

## Properties

### humanKeyId

> **humanKeyId**: `string`

Defined in: [packages/airaccount/src/server/services/kms-agent-service.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-agent-service.ts#L20)

***

### label?

> `optional` **label**: `string`

Defined in: [packages/airaccount/src/server/services/kms-agent-service.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-agent-service.ts#L21)

***

### passkeyAssertion?

> `optional` **passkeyAssertion**: [`LegacyPasskeyAssertion`](LegacyPasskeyAssertion.md)

Defined in: [packages/airaccount/src/server/services/kms-agent-service.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-agent-service.ts#L23)

***

### webAuthnAssertion?

> `optional` **webAuthnAssertion**: [`WebAuthnAssertion`](WebAuthnAssertion.md)

Defined in: [packages/airaccount/src/server/services/kms-agent-service.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-agent-service.ts#L22)
