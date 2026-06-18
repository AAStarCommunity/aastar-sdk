Defined in: [packages/airaccount/src/server/services/kms-signer.ts:121](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-signer.ts#L121)

## Properties

### domain

> **domain**: [`KmsEip712Domain`](KmsEip712Domain.md)

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:124](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-signer.ts#L124)

***

### hdPath?

> `optional` **hdPath**: `string`

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:123](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-signer.ts#L123)

***

### keyId

> **keyId**: `string`

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:122](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-signer.ts#L122)

***

### message

> **message**: [`KmsEip712FieldValue`](KmsEip712FieldValue.md)[]

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:127](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-signer.ts#L127)

***

### primaryType

> **primaryType**: `string`

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:125](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-signer.ts#L125)

***

### types

> **types**: [`KmsEip712TypeDef`](KmsEip712TypeDef.md)[]

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:126](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-signer.ts#L126)

***

### webAuthnAssertion?

> `optional` **webAuthnAssertion**: [`WebAuthnAssertion`](WebAuthnAssertion.md)

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:129](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-signer.ts#L129)

Required unless a Bearer agent JWT is supplied. Legacy passkeyAssertion is rejected.
