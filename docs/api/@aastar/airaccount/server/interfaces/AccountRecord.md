Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/interfaces/storage-adapter.ts#L4)

Account record stored by the SDK.

## Properties

### address

> **address**: `string`

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/interfaces/storage-adapter.ts#L6)

***

### createdAt

> **createdAt**: `string`

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/interfaces/storage-adapter.ts#L14)

***

### dailyLimit?

> `optional` **dailyLimit**: `string`

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/interfaces/storage-adapter.ts#L20)

Daily transfer limit in wei, stored as a decimal string (bigint serialization).
"0" or undefined means no guard / no limit.
Written into the factory config at account creation time.

***

### deployed

> **deployed**: `boolean`

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/interfaces/storage-adapter.ts#L9)

***

### deploymentTxHash

> **deploymentTxHash**: `string` \| `null`

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/interfaces/storage-adapter.ts#L10)

***

### entryPointVersion

> **entryPointVersion**: `string`

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/interfaces/storage-adapter.ts#L12)

***

### factoryAddress

> **factoryAddress**: `string`

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/interfaces/storage-adapter.ts#L13)

***

### guardian1?

> `optional` **guardian1**: `string`

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/interfaces/storage-adapter.ts#L26)

Guardian addresses and their acceptance signatures.
Present only for accounts created via createAccountWithGuardians().
Required by transfer-manager to reconstruct initCode using createAccountWithDefaults.

***

### guardian1Sig?

> `optional` **guardian1Sig**: `string`

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/interfaces/storage-adapter.ts#L27)

***

### guardian2?

> `optional` **guardian2**: `string`

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/interfaces/storage-adapter.ts#L28)

***

### guardian2Sig?

> `optional` **guardian2Sig**: `string`

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/interfaces/storage-adapter.ts#L29)

***

### salt

> **salt**: `number` \| `bigint`

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/interfaces/storage-adapter.ts#L8)

***

### signerAddress

> **signerAddress**: `string`

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/interfaces/storage-adapter.ts#L7)

***

### userId

> **userId**: `string`

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/interfaces/storage-adapter.ts#L5)

***

### validatorAddress

> **validatorAddress**: `string`

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/interfaces/storage-adapter.ts#L11)
