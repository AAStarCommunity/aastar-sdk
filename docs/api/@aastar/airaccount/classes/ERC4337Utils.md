Defined in: [packages/airaccount/src/core/erc4337/utils.ts:3](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/core/erc4337/utils.ts#L3)

## Constructors

### Constructor

> **new ERC4337Utils**(): `ERC4337Utils`

#### Returns

`ERC4337Utils`

## Methods

### packAccountGasLimits()

> `static` **packAccountGasLimits**(`verificationGasLimit`, `callGasLimit`): `string`

Defined in: [packages/airaccount/src/core/erc4337/utils.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/core/erc4337/utils.ts#L4)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `verificationGasLimit` | `string` \| `bigint` |
| `callGasLimit` | `string` \| `bigint` |

#### Returns

`string`

***

### packGasFees()

> `static` **packGasFees**(`maxPriorityFeePerGas`, `maxFeePerGas`): `string`

Defined in: [packages/airaccount/src/core/erc4337/utils.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/core/erc4337/utils.ts#L25)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `maxPriorityFeePerGas` | `string` \| `bigint` |
| `maxFeePerGas` | `string` \| `bigint` |

#### Returns

`string`

***

### packUserOperation()

> `static` **packUserOperation**(`userOp`): [`PackedUserOperation`](../interfaces/PackedUserOperation.md)

Defined in: [packages/airaccount/src/core/erc4337/utils.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/core/erc4337/utils.ts#L43)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userOp` | `any` |

#### Returns

[`PackedUserOperation`](../interfaces/PackedUserOperation.md)

***

### unpackAccountGasLimits()

> `static` **unpackAccountGasLimits**(`accountGasLimits`): `object`

Defined in: [packages/airaccount/src/core/erc4337/utils.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/core/erc4337/utils.ts#L14)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `accountGasLimits` | `string` |

#### Returns

`object`

##### callGasLimit

> **callGasLimit**: `bigint`

##### verificationGasLimit

> **verificationGasLimit**: `bigint`

***

### unpackGasFees()

> `static` **unpackGasFees**(`gasFees`): `object`

Defined in: [packages/airaccount/src/core/erc4337/utils.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/core/erc4337/utils.ts#L32)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `gasFees` | `string` |

#### Returns

`object`

##### maxFeePerGas

> **maxFeePerGas**: `bigint`

##### maxPriorityFeePerGas

> **maxPriorityFeePerGas**: `bigint`

***

### unpackUserOperation()

> `static` **unpackUserOperation**(`packedOp`): `any`

Defined in: [packages/airaccount/src/core/erc4337/utils.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/core/erc4337/utils.ts#L60)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `packedOp` | [`PackedUserOperation`](../interfaces/PackedUserOperation.md) |

#### Returns

`any`
