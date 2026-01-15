Defined in: [packages/paymaster/src/V4/PaymasterClient.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/paymaster/src/V4/PaymasterClient.ts#L8)

PaymasterClient
Focus: Integration, Funding, Interaction.

## Constructors

### Constructor

```ts
new PaymasterClient(): PaymasterClient;
```

#### Returns

`PaymasterClient`

## Methods

### approveGasToken()

```ts
static approveGasToken(
   wallet, 
   token, 
   spender, 
amount): Promise<any>;
```

Defined in: [packages/paymaster/src/V4/PaymasterClient.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/paymaster/src/V4/PaymasterClient.ts#L47)

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

```ts
static depositFor(
   wallet, 
   address, 
   user, 
   token, 
amount): Promise<any>;
```

Defined in: [packages/paymaster/src/V4/PaymasterClient.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/paymaster/src/V4/PaymasterClient.ts#L34)

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

```ts
static encodeExecution(
   target, 
   value, 
   data): `0x${string}`;
```

Defined in: [packages/paymaster/src/V4/PaymasterClient.ts:378](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/paymaster/src/V4/PaymasterClient.ts#L378)

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

```ts
static encodeTokenTransfer(recipient, amount): `0x${string}`;
```

Defined in: [packages/paymaster/src/V4/PaymasterClient.ts:365](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/paymaster/src/V4/PaymasterClient.ts#L365)

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

```ts
static estimateUserOperationGas(
   client, 
   wallet, 
   aaAddress, 
   entryPoint, 
   paymasterAddress, 
   token, 
   bundlerUrl, 
   callData, 
   options?): Promise<{
  callGasLimit: bigint;
  paymasterPostOpGasLimit: bigint;
  paymasterVerificationGasLimit: bigint | undefined;
  preVerificationGas: bigint;
  verificationGasLimit: bigint;
}>;
```

Defined in: [packages/paymaster/src/V4/PaymasterClient.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/paymaster/src/V4/PaymasterClient.ts#L60)

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

`Promise`\<\{
  `callGasLimit`: `bigint`;
  `paymasterPostOpGasLimit`: `bigint`;
  `paymasterVerificationGasLimit`: `bigint` \| `undefined`;
  `preVerificationGas`: `bigint`;
  `verificationGasLimit`: `bigint`;
\}\>

***

### getDepositedBalance()

```ts
static getDepositedBalance(
   publicClient, 
   address, 
   user, 
token): Promise<bigint>;
```

Defined in: [packages/paymaster/src/V4/PaymasterClient.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/paymaster/src/V4/PaymasterClient.ts#L13)

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

```ts
static getFeeFromReceipt(receipt, paymasterAddress): 
  | {
  actualGasCostWei: bigint;
  tokenCost: bigint;
}
  | null;
```

Defined in: [packages/paymaster/src/V4/PaymasterClient.ts:325](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/paymaster/src/V4/PaymasterClient.ts#L325)

Helper to extract the actual Gas Token fee from a UserOperation receipt.
Looks for the 'PostOpProcessed' event emitted by the Paymaster.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `receipt` | `any` |
| `paymasterAddress` | `` `0x${string}` `` |

#### Returns

  \| \{
  `actualGasCostWei`: `bigint`;
  `tokenCost`: `bigint`;
\}
  \| `null`

***

### getTransactionFee()

```ts
static getTransactionFee(
   publicClient, 
   txHash, 
   paymasterAddress): Promise<
  | {
  actualGasCostWei: bigint;
  tokenCost: bigint;
}
| null>;
```

Defined in: [packages/paymaster/src/V4/PaymasterClient.ts:352](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/paymaster/src/V4/PaymasterClient.ts#L352)

Get the fee for a specific transaction hash.
Fetches the receipt (no scanning required) and decodes the log.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `publicClient` | `any` |
| `txHash` | `` `0x${string}` `` |
| `paymasterAddress` | `` `0x${string}` `` |

#### Returns

`Promise`\<
  \| \{
  `actualGasCostWei`: `bigint`;
  `tokenCost`: `bigint`;
\}
  \| `null`\>

***

### submitGaslessUserOperation()

```ts
static submitGaslessUserOperation(
   client, 
   wallet, 
   aaAddress, 
   entryPoint, 
   paymasterAddress, 
   token, 
   bundlerUrl, 
   callData, 
options?): Promise<`0x${string}`>;
```

Defined in: [packages/paymaster/src/V4/PaymasterClient.ts:165](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/paymaster/src/V4/PaymasterClient.ts#L165)

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
