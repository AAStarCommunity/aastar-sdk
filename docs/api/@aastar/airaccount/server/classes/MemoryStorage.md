Defined in: [packages/airaccount/src/server/adapters/memory-storage.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/adapters/memory-storage.ts#L13)

In-memory storage adapter — useful for testing and demos.
All data is lost when the process exits.

## Implements

- [`IStorageAdapter`](../interfaces/IStorageAdapter.md)

## Constructors

### Constructor

> **new MemoryStorage**(): `MemoryStorage`

#### Returns

`MemoryStorage`

## Methods

### findAccountByUserId()

> **findAccountByUserId**(`userId`): `Promise`\<[`AccountRecord`](../interfaces/AccountRecord.md) \| `null`\>

Defined in: [packages/airaccount/src/server/adapters/memory-storage.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/adapters/memory-storage.ts#L29)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userId` | `string` |

#### Returns

`Promise`\<[`AccountRecord`](../interfaces/AccountRecord.md) \| `null`\>

#### Implementation of

[`IStorageAdapter`](../interfaces/IStorageAdapter.md).[`findAccountByUserId`](../interfaces/IStorageAdapter.md#findaccountbyuserid)

***

### findTransferById()

> **findTransferById**(`id`): `Promise`\<[`TransferRecord`](../interfaces/TransferRecord.md) \| `null`\>

Defined in: [packages/airaccount/src/server/adapters/memory-storage.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/adapters/memory-storage.ts#L50)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `string` |

#### Returns

`Promise`\<[`TransferRecord`](../interfaces/TransferRecord.md) \| `null`\>

#### Implementation of

[`IStorageAdapter`](../interfaces/IStorageAdapter.md).[`findTransferById`](../interfaces/IStorageAdapter.md#findtransferbyid)

***

### findTransfersByUserId()

> **findTransfersByUserId**(`userId`): `Promise`\<[`TransferRecord`](../interfaces/TransferRecord.md)[]\>

Defined in: [packages/airaccount/src/server/adapters/memory-storage.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/adapters/memory-storage.ts#L46)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userId` | `string` |

#### Returns

`Promise`\<[`TransferRecord`](../interfaces/TransferRecord.md)[]\>

#### Implementation of

[`IStorageAdapter`](../interfaces/IStorageAdapter.md).[`findTransfersByUserId`](../interfaces/IStorageAdapter.md#findtransfersbyuserid)

***

### getAccounts()

> **getAccounts**(): `Promise`\<[`AccountRecord`](../interfaces/AccountRecord.md)[]\>

Defined in: [packages/airaccount/src/server/adapters/memory-storage.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/adapters/memory-storage.ts#L21)

#### Returns

`Promise`\<[`AccountRecord`](../interfaces/AccountRecord.md)[]\>

#### Implementation of

[`IStorageAdapter`](../interfaces/IStorageAdapter.md).[`getAccounts`](../interfaces/IStorageAdapter.md#getaccounts)

***

### getBlsConfig()

> **getBlsConfig**(): `Promise`\<[`BlsConfigRecord`](../interfaces/BlsConfigRecord.md) \| `null`\>

Defined in: [packages/airaccount/src/server/adapters/memory-storage.ts:90](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/adapters/memory-storage.ts#L90)

#### Returns

`Promise`\<[`BlsConfigRecord`](../interfaces/BlsConfigRecord.md) \| `null`\>

#### Implementation of

[`IStorageAdapter`](../interfaces/IStorageAdapter.md).[`getBlsConfig`](../interfaces/IStorageAdapter.md#getblsconfig)

***

### getPaymasters()

> **getPaymasters**(`userId`): `Promise`\<[`PaymasterRecord`](../interfaces/PaymasterRecord.md)[]\>

Defined in: [packages/airaccount/src/server/adapters/memory-storage.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/adapters/memory-storage.ts#L63)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userId` | `string` |

#### Returns

`Promise`\<[`PaymasterRecord`](../interfaces/PaymasterRecord.md)[]\>

#### Implementation of

[`IStorageAdapter`](../interfaces/IStorageAdapter.md).[`getPaymasters`](../interfaces/IStorageAdapter.md#getpaymasters)

***

### removePaymaster()

> **removePaymaster**(`userId`, `name`): `Promise`\<`boolean`\>

Defined in: [packages/airaccount/src/server/adapters/memory-storage.ts:78](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/adapters/memory-storage.ts#L78)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userId` | `string` |
| `name` | `string` |

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`IStorageAdapter`](../interfaces/IStorageAdapter.md).[`removePaymaster`](../interfaces/IStorageAdapter.md#removepaymaster)

***

### saveAccount()

> **saveAccount**(`account`): `Promise`\<`void`\>

Defined in: [packages/airaccount/src/server/adapters/memory-storage.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/adapters/memory-storage.ts#L25)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `account` | [`AccountRecord`](../interfaces/AccountRecord.md) |

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorageAdapter`](../interfaces/IStorageAdapter.md).[`saveAccount`](../interfaces/IStorageAdapter.md#saveaccount)

***

### savePaymaster()

> **savePaymaster**(`userId`, `paymaster`): `Promise`\<`void`\>

Defined in: [packages/airaccount/src/server/adapters/memory-storage.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/adapters/memory-storage.ts#L67)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userId` | `string` |
| `paymaster` | [`PaymasterRecord`](../interfaces/PaymasterRecord.md) |

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorageAdapter`](../interfaces/IStorageAdapter.md).[`savePaymaster`](../interfaces/IStorageAdapter.md#savepaymaster)

***

### saveTransfer()

> **saveTransfer**(`transfer`): `Promise`\<`void`\>

Defined in: [packages/airaccount/src/server/adapters/memory-storage.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/adapters/memory-storage.ts#L42)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `transfer` | [`TransferRecord`](../interfaces/TransferRecord.md) |

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorageAdapter`](../interfaces/IStorageAdapter.md).[`saveTransfer`](../interfaces/IStorageAdapter.md#savetransfer)

***

### updateAccount()

> **updateAccount**(`userId`, `updates`): `Promise`\<`void`\>

Defined in: [packages/airaccount/src/server/adapters/memory-storage.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/adapters/memory-storage.ts#L33)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userId` | `string` |
| `updates` | `Partial`\<[`AccountRecord`](../interfaces/AccountRecord.md)\> |

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorageAdapter`](../interfaces/IStorageAdapter.md).[`updateAccount`](../interfaces/IStorageAdapter.md#updateaccount)

***

### updateSignerNodesCache()

> **updateSignerNodesCache**(`nodes`): `Promise`\<`void`\>

Defined in: [packages/airaccount/src/server/adapters/memory-storage.ts:94](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/adapters/memory-storage.ts#L94)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `nodes` | `unknown`[] |

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorageAdapter`](../interfaces/IStorageAdapter.md).[`updateSignerNodesCache`](../interfaces/IStorageAdapter.md#updatesignernodescache)

***

### updateTransfer()

> **updateTransfer**(`id`, `updates`): `Promise`\<`void`\>

Defined in: [packages/airaccount/src/server/adapters/memory-storage.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/adapters/memory-storage.ts#L54)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `string` |
| `updates` | `Partial`\<[`TransferRecord`](../interfaces/TransferRecord.md)\> |

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStorageAdapter`](../interfaces/IStorageAdapter.md).[`updateTransfer`](../interfaces/IStorageAdapter.md#updatetransfer)
