Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:93](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/interfaces/storage-adapter.ts#L93)

Pluggable storage adapter — replaces NestJS DatabaseService.
SDK only manages accounts, transfers, paymasters, and BLS config.
User authentication is NOT handled by the SDK.

## Methods

### findAccountByUserId()

> **findAccountByUserId**(`userId`): `Promise`\<[`AccountRecord`](AccountRecord.md) \| `null`\>

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:97](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/interfaces/storage-adapter.ts#L97)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userId` | `string` |

#### Returns

`Promise`\<[`AccountRecord`](AccountRecord.md) \| `null`\>

***

### findTransferById()

> **findTransferById**(`id`): `Promise`\<[`TransferRecord`](TransferRecord.md) \| `null`\>

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:103](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/interfaces/storage-adapter.ts#L103)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `string` |

#### Returns

`Promise`\<[`TransferRecord`](TransferRecord.md) \| `null`\>

***

### findTransfersByUserId()

> **findTransfersByUserId**(`userId`): `Promise`\<[`TransferRecord`](TransferRecord.md)[]\>

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:102](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/interfaces/storage-adapter.ts#L102)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userId` | `string` |

#### Returns

`Promise`\<[`TransferRecord`](TransferRecord.md)[]\>

***

### getAccounts()

> **getAccounts**(): `Promise`\<[`AccountRecord`](AccountRecord.md)[]\>

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:95](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/interfaces/storage-adapter.ts#L95)

#### Returns

`Promise`\<[`AccountRecord`](AccountRecord.md)[]\>

***

### getBlsConfig()

> **getBlsConfig**(): `Promise`\<[`BlsConfigRecord`](BlsConfigRecord.md) \| `null`\>

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:112](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/interfaces/storage-adapter.ts#L112)

#### Returns

`Promise`\<[`BlsConfigRecord`](BlsConfigRecord.md) \| `null`\>

***

### getPaymasters()

> **getPaymasters**(`userId`): `Promise`\<[`PaymasterRecord`](PaymasterRecord.md)[]\>

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:107](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/interfaces/storage-adapter.ts#L107)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userId` | `string` |

#### Returns

`Promise`\<[`PaymasterRecord`](PaymasterRecord.md)[]\>

***

### removePaymaster()

> **removePaymaster**(`userId`, `name`): `Promise`\<`boolean`\>

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:109](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/interfaces/storage-adapter.ts#L109)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userId` | `string` |
| `name` | `string` |

#### Returns

`Promise`\<`boolean`\>

***

### saveAccount()

> **saveAccount**(`account`): `Promise`\<`void`\>

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:96](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/interfaces/storage-adapter.ts#L96)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `account` | [`AccountRecord`](AccountRecord.md) |

#### Returns

`Promise`\<`void`\>

***

### savePaymaster()

> **savePaymaster**(`userId`, `paymaster`): `Promise`\<`void`\>

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:108](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/interfaces/storage-adapter.ts#L108)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userId` | `string` |
| `paymaster` | [`PaymasterRecord`](PaymasterRecord.md) |

#### Returns

`Promise`\<`void`\>

***

### saveTransfer()

> **saveTransfer**(`transfer`): `Promise`\<`void`\>

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:101](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/interfaces/storage-adapter.ts#L101)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `transfer` | [`TransferRecord`](TransferRecord.md) |

#### Returns

`Promise`\<`void`\>

***

### updateAccount()

> **updateAccount**(`userId`, `updates`): `Promise`\<`void`\>

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:98](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/interfaces/storage-adapter.ts#L98)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userId` | `string` |
| `updates` | `Partial`\<[`AccountRecord`](AccountRecord.md)\> |

#### Returns

`Promise`\<`void`\>

***

### updateSignerNodesCache()

> **updateSignerNodesCache**(`nodes`): `Promise`\<`void`\>

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:113](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/interfaces/storage-adapter.ts#L113)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `nodes` | `unknown`[] |

#### Returns

`Promise`\<`void`\>

***

### updateTransfer()

> **updateTransfer**(`id`, `updates`): `Promise`\<`void`\>

Defined in: [packages/airaccount/src/server/interfaces/storage-adapter.ts:104](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/interfaces/storage-adapter.ts#L104)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `string` |
| `updates` | `Partial`\<[`TransferRecord`](TransferRecord.md)\> |

#### Returns

`Promise`\<`void`\>
