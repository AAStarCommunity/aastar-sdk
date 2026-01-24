Defined in: [V4/PaymasterClient.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/paymaster/src/V4/PaymasterClient.ts#L10)

PaymasterClient
Focus: Integration, Funding, Interaction.

## Methods

### approveGasToken()

> `static` **approveGasToken**(`wallet`, `token`, `spender`, `amount`): `Promise`\<`any`\>

Defined in: [V4/PaymasterClient.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/paymaster/src/V4/PaymasterClient.ts#L54)

Approve the Paymaster (or any spender) to spend gas tokens.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `token` | `` `0x${string}` `` |
| `spender` | `` `0x${string}` `` |
| `amount` | `bigint` |

#### Returns

`Promise`\<`any`\>

***

### depositFor()

> `static` **depositFor**(`wallet`, `address`, `user`, `token`, `amount`): `Promise`\<`any`\>

Defined in: [V4/PaymasterClient.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/paymaster/src/V4/PaymasterClient.ts#L41)

Deposit tokens to Paymaster for a user (enables gasless transactions).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `address` | `` `0x${string}` `` |
| `user` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |
| `amount` | `bigint` |

#### Returns

`Promise`\<`any`\>

***

### encodeExecution()

> `static` **encodeExecution**(`target`, `value`, `data`): `` `0x${string}` ``

Defined in: [V4/PaymasterClient.ts:474](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/paymaster/src/V4/PaymasterClient.ts#L474)

Helper: Encode a SimpleAccount execution.
Wraps the inner call into: `execute(target, value, data)`
This is the payload signed by the user.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `target` | `` `0x${string}` `` |
| `value` | `bigint` |
| `data` | `` `0x${string}` `` |

#### Returns

`` `0x${string}` ``

***

### encodeTokenTransfer()

> `static` **encodeTokenTransfer**(`recipient`, `amount`): `` `0x${string}` ``

Defined in: [V4/PaymasterClient.ts:461](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/paymaster/src/V4/PaymasterClient.ts#L461)

Helper: Encode a standardized ERC-20 Transfer.
Returns the raw function data: `transfer(to, amount)`

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `recipient` | `` `0x${string}` `` |
| `amount` | `bigint` |

#### Returns

`` `0x${string}` ``

***

### estimateUserOperationGas()

> `static` **estimateUserOperationGas**(`client`, `wallet`, `aaAddress`, `entryPoint`, `paymasterAddress`, `token`, `bundlerUrl`, `callData`, `options?`): `Promise`\<\{ `callGasLimit`: `bigint`; `paymasterPostOpGasLimit`: `bigint`; `paymasterVerificationGasLimit`: `bigint` \| `undefined`; `preVerificationGas`: `bigint`; `verificationGasLimit`: `bigint`; \}\>

Defined in: [V4/PaymasterClient.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/paymaster/src/V4/PaymasterClient.ts#L67)

Estimate Gas for a UserOperation.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `client` | `any` |
| `wallet` | `any` |
| `aaAddress` | `` `0x${string}` `` |
| `entryPoint` | `` `0x${string}` `` |
| `paymasterAddress` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |
| `bundlerUrl` | `string` |
| `callData` | `` `0x${string}` `` |
| `options?` | \{ `factory?`: `` `0x${string}` ``; `factoryData?`: `` `0x${string}` ``; `operator?`: `` `0x${string}` ``; `validityWindow?`: `number`; \} |
| `options.factory?` | `` `0x${string}` `` |
| `options.factoryData?` | `` `0x${string}` `` |
| `options.operator?` | `` `0x${string}` `` |
| `options.validityWindow?` | `number` |

#### Returns

`Promise`\<\{ `callGasLimit`: `bigint`; `paymasterPostOpGasLimit`: `bigint`; `paymasterVerificationGasLimit`: `bigint` \| `undefined`; `preVerificationGas`: `bigint`; `verificationGasLimit`: `bigint`; \}\>

***

### getDepositedBalance()

> `static` **getDepositedBalance**(`publicClient`, `address`, `user`, `token`): `Promise`\<`bigint`\>

Defined in: [V4/PaymasterClient.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/paymaster/src/V4/PaymasterClient.ts#L20)

Get user's deposited balance on the Paymaster.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `publicClient` | `any` |
| `address` | `` `0x${string}` `` |
| `user` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |

#### Returns

`Promise`\<`bigint`\>

***

### getFeeFromReceipt()

> `static` **getFeeFromReceipt**(`receipt`, `paymasterAddress`): \{ `actualGasCostWei`: `bigint`; `tokenCost`: `bigint`; \} \| `null`

Defined in: [V4/PaymasterClient.ts:421](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/paymaster/src/V4/PaymasterClient.ts#L421)

Helper to extract the actual Gas Token fee from a UserOperation receipt.
Looks for the 'PostOpProcessed' event emitted by the Paymaster.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `receipt` | `any` |
| `paymasterAddress` | `` `0x${string}` `` |

#### Returns

\{ `actualGasCostWei`: `bigint`; `tokenCost`: `bigint`; \} \| `null`

***

### getTransactionFee()

> `static` **getTransactionFee**(`publicClient`, `txHash`, `paymasterAddress`): `Promise`\<\{ `actualGasCostWei`: `bigint`; `tokenCost`: `bigint`; \} \| `null`\>

Defined in: [V4/PaymasterClient.ts:448](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/paymaster/src/V4/PaymasterClient.ts#L448)

Get the fee for a specific transaction hash.
Fetches the receipt (no scanning required) and decodes the log.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `publicClient` | `any` |
| `txHash` | `` `0x${string}` `` |
| `paymasterAddress` | `` `0x${string}` `` |

#### Returns

`Promise`\<\{ `actualGasCostWei`: `bigint`; `tokenCost`: `bigint`; \} \| `null`\>

***

### submitGaslessUserOperation()

> `static` **submitGaslessUserOperation**(`client`, `wallet`, `aaAddress`, `entryPoint`, `paymasterAddress`, `token`, `bundlerUrl`, `callData`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [V4/PaymasterClient.ts:235](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/paymaster/src/V4/PaymasterClient.ts#L235)

High-level API to submit a gasless UserOperation.
Automatically handles nonce fetching, gas estimation (if not provided), signing, and submission.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `client` | `any` |
| `wallet` | `any` |
| `aaAddress` | `` `0x${string}` `` |
| `entryPoint` | `` `0x${string}` `` |
| `paymasterAddress` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |
| `bundlerUrl` | `string` |
| `callData` | `` `0x${string}` `` |
| `options?` | \{ `autoEstimate?`: `boolean`; `callGasLimit?`: `bigint`; `factory?`: `` `0x${string}` ``; `factoryData?`: `` `0x${string}` ``; `maxFeePerGas?`: `bigint`; `maxPriorityFeePerGas?`: `bigint`; `operator?`: `` `0x${string}` ``; `paymasterPostOpGasLimit?`: `bigint`; `paymasterVerificationGasLimit?`: `bigint`; `preVerificationGas?`: `bigint`; `validityWindow?`: `number`; `verificationGasLimit?`: `bigint`; \} |
| `options.autoEstimate?` | `boolean` |
| `options.callGasLimit?` | `bigint` |
| `options.factory?` | `` `0x${string}` `` |
| `options.factoryData?` | `` `0x${string}` `` |
| `options.maxFeePerGas?` | `bigint` |
| `options.maxPriorityFeePerGas?` | `bigint` |
| `options.operator?` | `` `0x${string}` `` |
| `options.paymasterPostOpGasLimit?` | `bigint` |
| `options.paymasterVerificationGasLimit?` | `bigint` |
| `options.preVerificationGas?` | `bigint` |
| `options.validityWindow?` | `number` |
| `options.verificationGasLimit?` | `bigint` |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### waitForUserOperation()

> `static` **waitForUserOperation**(`bundlerClient`, `hash`, `timeout`): `Promise`\<`any`\>

Defined in: [V4/PaymasterClient.ts:486](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/paymaster/src/V4/PaymasterClient.ts#L486)

More robust version of waitForUserOperationReceipt.
Catches timeouts and returns a cleaner result.

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `bundlerClient` | `any` | `undefined` |
| `hash` | `` `0x${string}` `` | `undefined` |
| `timeout` | `number` | `60000` |

#### Returns

`Promise`\<`any`\>
