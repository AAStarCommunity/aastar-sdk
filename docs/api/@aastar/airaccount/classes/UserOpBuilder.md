Defined in: [packages/airaccount/src/core/erc4337/userop.builder.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/core/erc4337/userop.builder.ts#L6)

## Constructors

### Constructor

> **new UserOpBuilder**(): `UserOpBuilder`

Defined in: [packages/airaccount/src/core/erc4337/userop.builder.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/core/erc4337/userop.builder.ts#L13)

#### Returns

`UserOpBuilder`

## Methods

### buildUserOp()

> **buildUserOp**(`params`): `Promise`\<[`UserOperation`](../interfaces/UserOperation.md)\>

Defined in: [packages/airaccount/src/core/erc4337/userop.builder.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/core/erc4337/userop.builder.ts#L21)

Build specific parts of a UserOperation
Note: Full construction often requires chain interaction (nonce, gas price),
which typically happens in the application layer or via a Provider wrapper.
This builder focuses on formatting and structure.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | \{ `callData`: `string`; `callGasLimit?`: `bigint`; `initCode?`: `string`; `maxFeePerGas?`: `bigint`; `maxPriorityFeePerGas?`: `bigint`; `nonce?`: `bigint`; `paymasterAndData?`: `string`; `preVerificationGas?`: `bigint`; `sender`: `string`; `signature?`: `string`; `verificationGasLimit?`: `bigint`; \} |
| `params.callData` | `string` |
| `params.callGasLimit?` | `bigint` |
| `params.initCode?` | `string` |
| `params.maxFeePerGas?` | `bigint` |
| `params.maxPriorityFeePerGas?` | `bigint` |
| `params.nonce?` | `bigint` |
| `params.paymasterAndData?` | `string` |
| `params.preVerificationGas?` | `bigint` |
| `params.sender` | `string` |
| `params.signature?` | `string` |
| `params.verificationGasLimit?` | `bigint` |

#### Returns

`Promise`\<[`UserOperation`](../interfaces/UserOperation.md)\>

***

### getUserOpHash()

> **getUserOpHash**(`userOp`, `entryPoint`, `chainId`): `string`

Defined in: [packages/airaccount/src/core/erc4337/userop.builder.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/core/erc4337/userop.builder.ts#L54)

Hash the UserOperation for signing (ERC-4337 v0.7)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userOp` | [`PackedUserOperation`](../interfaces/PackedUserOperation.md) |
| `entryPoint` | `string` |
| `chainId` | `number` |

#### Returns

`string`
