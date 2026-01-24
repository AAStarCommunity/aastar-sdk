Defined in: [V4/PaymasterClient.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/paymaster/src/V4/PaymasterClient.ts#L9)

PaymasterClient
Focus: Integration, Funding, Interaction.

## Constructors

### Constructor

> **new PaymasterClient**(): `PaymasterClient`

#### Returns

`PaymasterClient`

## Methods

### approveGasToken()

> `static` **approveGasToken**(`wallet`, `token`, `spender`, `amount`): `Promise`\<`any`\>

Defined in: [V4/PaymasterClient.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/paymaster/src/V4/PaymasterClient.ts#L48)

Approve the Paymaster (or any spender) to spend gas tokens.

#### Parameters

##### wallet

`any`

##### token

`` `0x${string}` ``

##### spender

`` `0x${string}` ``

##### amount

`bigint`

#### Returns

`Promise`\<`any`\>

***

### depositFor()

> `static` **depositFor**(`wallet`, `address`, `user`, `token`, `amount`): `Promise`\<`any`\>

Defined in: [V4/PaymasterClient.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/paymaster/src/V4/PaymasterClient.ts#L35)

Deposit tokens to Paymaster for a user (enables gasless transactions).

#### Parameters

##### wallet

`any`

##### address

`` `0x${string}` ``

##### user

`` `0x${string}` ``

##### token

`` `0x${string}` ``

##### amount

`bigint`

#### Returns

`Promise`\<`any`\>

***

### encodeExecution()

> `static` **encodeExecution**(`target`, `value`, `data`): `` `0x${string}` ``

Defined in: [V4/PaymasterClient.ts:468](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/paymaster/src/V4/PaymasterClient.ts#L468)

Helper: Encode a SimpleAccount execution.
Wraps the inner call into: `execute(target, value, data)`
This is the payload signed by the user.

#### Parameters

##### target

`` `0x${string}` ``

##### value

`bigint`

##### data

`` `0x${string}` ``

#### Returns

`` `0x${string}` ``

***

### encodeTokenTransfer()

> `static` **encodeTokenTransfer**(`recipient`, `amount`): `` `0x${string}` ``

Defined in: [V4/PaymasterClient.ts:455](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/paymaster/src/V4/PaymasterClient.ts#L455)

Helper: Encode a standardized ERC-20 Transfer.
Returns the raw function data: `transfer(to, amount)`

#### Parameters

##### recipient

`` `0x${string}` ``

##### amount

`bigint`

#### Returns

`` `0x${string}` ``

***

### estimateUserOperationGas()

> `static` **estimateUserOperationGas**(`client`, `wallet`, `aaAddress`, `entryPoint`, `paymasterAddress`, `token`, `bundlerUrl`, `callData`, `options?`): `Promise`\<\{ `callGasLimit`: `bigint`; `paymasterPostOpGasLimit`: `bigint`; `paymasterVerificationGasLimit`: `bigint` \| `undefined`; `preVerificationGas`: `bigint`; `verificationGasLimit`: `bigint`; \}\>

Defined in: [V4/PaymasterClient.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/paymaster/src/V4/PaymasterClient.ts#L61)

Estimate Gas for a UserOperation.

#### Parameters

##### client

`any`

##### wallet

`any`

##### aaAddress

`` `0x${string}` ``

##### entryPoint

`` `0x${string}` ``

##### paymasterAddress

`` `0x${string}` ``

##### token

`` `0x${string}` ``

##### bundlerUrl

`string`

##### callData

`` `0x${string}` ``

##### options?

###### factory?

`` `0x${string}` ``

###### factoryData?

`` `0x${string}` ``

###### operator?

`` `0x${string}` ``

###### validityWindow?

`number`

#### Returns

`Promise`\<\{ `callGasLimit`: `bigint`; `paymasterPostOpGasLimit`: `bigint`; `paymasterVerificationGasLimit`: `bigint` \| `undefined`; `preVerificationGas`: `bigint`; `verificationGasLimit`: `bigint`; \}\>

***

### getDepositedBalance()

> `static` **getDepositedBalance**(`publicClient`, `address`, `user`, `token`): `Promise`\<`bigint`\>

Defined in: [V4/PaymasterClient.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/paymaster/src/V4/PaymasterClient.ts#L14)

Get user's deposited balance on the Paymaster.

#### Parameters

##### publicClient

`any`

##### address

`` `0x${string}` ``

##### user

`` `0x${string}` ``

##### token

`` `0x${string}` ``

#### Returns

`Promise`\<`bigint`\>

***

### getFeeFromReceipt()

> `static` **getFeeFromReceipt**(`receipt`, `paymasterAddress`): \{ `actualGasCostWei`: `bigint`; `tokenCost`: `bigint`; \} \| `null`

Defined in: [V4/PaymasterClient.ts:415](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/paymaster/src/V4/PaymasterClient.ts#L415)

Helper to extract the actual Gas Token fee from a UserOperation receipt.
Looks for the 'PostOpProcessed' event emitted by the Paymaster.

#### Parameters

##### receipt

`any`

##### paymasterAddress

`` `0x${string}` ``

#### Returns

\{ `actualGasCostWei`: `bigint`; `tokenCost`: `bigint`; \} \| `null`

***

### getTransactionFee()

> `static` **getTransactionFee**(`publicClient`, `txHash`, `paymasterAddress`): `Promise`\<\{ `actualGasCostWei`: `bigint`; `tokenCost`: `bigint`; \} \| `null`\>

Defined in: [V4/PaymasterClient.ts:442](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/paymaster/src/V4/PaymasterClient.ts#L442)

Get the fee for a specific transaction hash.
Fetches the receipt (no scanning required) and decodes the log.

#### Parameters

##### publicClient

`any`

##### txHash

`` `0x${string}` ``

##### paymasterAddress

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `actualGasCostWei`: `bigint`; `tokenCost`: `bigint`; \} \| `null`\>

***

### submitGaslessUserOperation()

> `static` **submitGaslessUserOperation**(`client`, `wallet`, `aaAddress`, `entryPoint`, `paymasterAddress`, `token`, `bundlerUrl`, `callData`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [V4/PaymasterClient.ts:229](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/paymaster/src/V4/PaymasterClient.ts#L229)

High-level API to submit a gasless UserOperation.
Automatically handles nonce fetching, gas estimation (if not provided), signing, and submission.

#### Parameters

##### client

`any`

##### wallet

`any`

##### aaAddress

`` `0x${string}` ``

##### entryPoint

`` `0x${string}` ``

##### paymasterAddress

`` `0x${string}` ``

##### token

`` `0x${string}` ``

##### bundlerUrl

`string`

##### callData

`` `0x${string}` ``

##### options?

###### autoEstimate?

`boolean`

###### callGasLimit?

`bigint`

###### factory?

`` `0x${string}` ``

###### factoryData?

`` `0x${string}` ``

###### maxFeePerGas?

`bigint`

###### maxPriorityFeePerGas?

`bigint`

###### operator?

`` `0x${string}` ``

###### paymasterPostOpGasLimit?

`bigint`

###### paymasterVerificationGasLimit?

`bigint`

###### preVerificationGas?

`bigint`

###### validityWindow?

`number`

###### verificationGasLimit?

`bigint`

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### waitForUserOperation()

> `static` **waitForUserOperation**(`bundlerClient`, `hash`, `timeout`): `Promise`\<`any`\>

Defined in: [V4/PaymasterClient.ts:480](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/paymaster/src/V4/PaymasterClient.ts#L480)

More robust version of waitForUserOperationReceipt.
Catches timeouts and returns a cleaner result.

#### Parameters

##### bundlerClient

`any`

##### hash

`` `0x${string}` ``

##### timeout

`number` = `60000`

#### Returns

`Promise`\<`any`\>
