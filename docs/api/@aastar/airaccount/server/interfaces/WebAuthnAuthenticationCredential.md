Defined in: [packages/airaccount/src/server/services/webauthn-ceremony.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/webauthn-ceremony.ts#L71)

WebAuthn AuthenticationResponseJSON (the subset the KMS verifies). This is the
value placed in `WebAuthnAssertion.Credential`.

## Properties

### clientExtensionResults?

> `optional` **clientExtensionResults**: `Record`\<`string`, `unknown`\>

Defined in: [packages/airaccount/src/server/services/webauthn-ceremony.ts:81](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/webauthn-ceremony.ts#L81)

***

### id

> **id**: `string`

Defined in: [packages/airaccount/src/server/services/webauthn-ceremony.ts:72](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/webauthn-ceremony.ts#L72)

***

### rawId

> **rawId**: `string`

Defined in: [packages/airaccount/src/server/services/webauthn-ceremony.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/webauthn-ceremony.ts#L73)

***

### response

> **response**: `object`

Defined in: [packages/airaccount/src/server/services/webauthn-ceremony.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/webauthn-ceremony.ts#L75)

#### authenticatorData

> **authenticatorData**: `string`

#### clientDataJSON

> **clientDataJSON**: `string`

#### signature

> **signature**: `string`

#### userHandle?

> `optional` **userHandle**: `string`

***

### type

> **type**: `"public-key"`

Defined in: [packages/airaccount/src/server/services/webauthn-ceremony.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/webauthn-ceremony.ts#L74)
