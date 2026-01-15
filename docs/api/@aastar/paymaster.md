## Classes

### PaymasterClient

Defined in: [V4/PaymasterClient.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterClient.ts#L8)

PaymasterClient
Focus: Integration, Funding, Interaction.

#### Constructors

##### Constructor

```ts
new PaymasterClient(): PaymasterClient;
```

###### Returns

[`PaymasterClient`](#paymasterclient)

#### Methods

##### approveGasToken()

```ts
static approveGasToken(
   wallet, 
   token, 
   spender, 
amount): Promise<any>;
```

Defined in: [V4/PaymasterClient.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterClient.ts#L47)

Approve the Paymaster (or any spender) to spend gas tokens.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `token` | `` `0x${string}` `` |
| `spender` | `` `0x${string}` `` |
| `amount` | `bigint` |

###### Returns

`Promise`\<`any`\>

##### depositFor()

```ts
static depositFor(
   wallet, 
   address, 
   user, 
   token, 
amount): Promise<any>;
```

Defined in: [V4/PaymasterClient.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterClient.ts#L34)

Deposit tokens to Paymaster for a user (enables gasless transactions).

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `address` | `` `0x${string}` `` |
| `user` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |
| `amount` | `bigint` |

###### Returns

`Promise`\<`any`\>

##### encodeExecution()

```ts
static encodeExecution(
   target, 
   value, 
   data): `0x${string}`;
```

Defined in: [V4/PaymasterClient.ts:378](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterClient.ts#L378)

Helper: Encode a SimpleAccount execution.
Wraps the inner call into: `execute(target, value, data)`
This is the payload signed by the user.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `target` | `` `0x${string}` `` |
| `value` | `bigint` |
| `data` | `` `0x${string}` `` |

###### Returns

`` `0x${string}` ``

##### encodeTokenTransfer()

```ts
static encodeTokenTransfer(recipient, amount): `0x${string}`;
```

Defined in: [V4/PaymasterClient.ts:365](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterClient.ts#L365)

Helper: Encode a standardized ERC-20 Transfer.
Returns the raw function data: `transfer(to, amount)`

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `recipient` | `` `0x${string}` `` |
| `amount` | `bigint` |

###### Returns

`` `0x${string}` ``

##### estimateUserOperationGas()

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

Defined in: [V4/PaymasterClient.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterClient.ts#L60)

Estimate Gas for a UserOperation.

###### Parameters

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

###### Returns

`Promise`\<\{
  `callGasLimit`: `bigint`;
  `paymasterPostOpGasLimit`: `bigint`;
  `paymasterVerificationGasLimit`: `bigint` \| `undefined`;
  `preVerificationGas`: `bigint`;
  `verificationGasLimit`: `bigint`;
\}\>

##### getDepositedBalance()

```ts
static getDepositedBalance(
   publicClient, 
   address, 
   user, 
token): Promise<bigint>;
```

Defined in: [V4/PaymasterClient.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterClient.ts#L13)

Get user's deposited balance on the Paymaster.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `publicClient` | `any` |
| `address` | `` `0x${string}` `` |
| `user` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |

###### Returns

`Promise`\<`bigint`\>

##### getFeeFromReceipt()

```ts
static getFeeFromReceipt(receipt, paymasterAddress): 
  | {
  actualGasCostWei: bigint;
  tokenCost: bigint;
}
  | null;
```

Defined in: [V4/PaymasterClient.ts:325](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterClient.ts#L325)

Helper to extract the actual Gas Token fee from a UserOperation receipt.
Looks for the 'PostOpProcessed' event emitted by the Paymaster.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `receipt` | `any` |
| `paymasterAddress` | `` `0x${string}` `` |

###### Returns

  \| \{
  `actualGasCostWei`: `bigint`;
  `tokenCost`: `bigint`;
\}
  \| `null`

##### getTransactionFee()

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

Defined in: [V4/PaymasterClient.ts:352](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterClient.ts#L352)

Get the fee for a specific transaction hash.
Fetches the receipt (no scanning required) and decodes the log.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `publicClient` | `any` |
| `txHash` | `` `0x${string}` `` |
| `paymasterAddress` | `` `0x${string}` `` |

###### Returns

`Promise`\<
  \| \{
  `actualGasCostWei`: `bigint`;
  `tokenCost`: `bigint`;
\}
  \| `null`\>

##### submitGaslessUserOperation()

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

Defined in: [V4/PaymasterClient.ts:165](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterClient.ts#L165)

High-level API to submit a gasless UserOperation.
Automatically handles nonce fetching, gas estimation (if not provided), signing, and submission.

###### Parameters

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

###### Returns

`Promise`\<`` `0x${string}` ``\>

***

### PaymasterOperator

Defined in: [V4/PaymasterOperator.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterOperator.ts#L8)

PaymasterOperator
Focus: Deployment, Configuration, Maintenance, Keeper Bots.

#### Constructors

##### Constructor

```ts
new PaymasterOperator(): PaymasterOperator;
```

###### Returns

[`PaymasterOperator`](#paymasteroperator)

#### Methods

##### addDeposit()

```ts
static addDeposit(
   wallet, 
   address, 
amount): Promise<any>;
```

Defined in: [V4/PaymasterOperator.ts:107](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterOperator.ts#L107)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `address` | `` `0x${string}` `` |
| `amount` | `bigint` |

###### Returns

`Promise`\<`any`\>

##### addGasToken()

```ts
static addGasToken(
   wallet, 
   address, 
token): Promise<any>;
```

Defined in: [V4/PaymasterOperator.ts:117](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterOperator.ts#L117)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `address` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |

###### Returns

`Promise`\<`any`\>

##### addStake()

```ts
static addStake(
   wallet, 
   address, 
   amount, 
unstakeDelaySec): Promise<any>;
```

Defined in: [V4/PaymasterOperator.ts:96](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterOperator.ts#L96)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `address` | `` `0x${string}` `` |
| `amount` | `bigint` |
| `unstakeDelaySec` | `number` |

###### Returns

`Promise`\<`any`\>

##### checkGaslessReadiness()

```ts
static checkGaslessReadiness(
   publicClient, 
   entryPoint, 
   paymasterAddress, 
   user, 
token): Promise<GaslessReadinessReport>;
```

Defined in: [V4/PaymasterOperator.ts:169](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterOperator.ts#L169)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `publicClient` | `any` |
| `entryPoint` | `` `0x${string}` `` |
| `paymasterAddress` | `` `0x${string}` `` |
| `user` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |

###### Returns

`Promise`\<[`GaslessReadinessReport`](#gaslessreadinessreport)\>

##### ensurePriceInitialized()

```ts
static ensurePriceInitialized(
   wallet, 
   publicClient, 
address): Promise<boolean>;
```

Defined in: [V4/PaymasterOperator.ts:87](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterOperator.ts#L87)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `publicClient` | `any` |
| `address` | `` `0x${string}` `` |

###### Returns

`Promise`\<`boolean`\>

##### getCachedPrice()

```ts
static getCachedPrice(publicClient, address): Promise<{
  price: bigint;
  updatedAt: bigint;
}>;
```

Defined in: [V4/PaymasterOperator.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterOperator.ts#L36)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `publicClient` | `any` |
| `address` | `` `0x${string}` `` |

###### Returns

`Promise`\<\{
  `price`: `bigint`;
  `updatedAt`: `bigint`;
\}\>

##### getDepositedBalance()

```ts
static getDepositedBalance(
   publicClient, 
   address, 
   user, 
token): Promise<bigint>;
```

Defined in: [V4/PaymasterOperator.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterOperator.ts#L69)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `publicClient` | `any` |
| `address` | `` `0x${string}` `` |
| `user` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |

###### Returns

`Promise`\<`bigint`\>

##### getTokenPrice()

```ts
static getTokenPrice(
   publicClient, 
   address, 
token): Promise<bigint>;
```

Defined in: [V4/PaymasterOperator.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterOperator.ts#L54)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `publicClient` | `any` |
| `address` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |

###### Returns

`Promise`\<`bigint`\>

##### prepareGaslessEnvironment()

```ts
static prepareGaslessEnvironment(
   operatorWallet, 
   publicClient, 
   entryPoint, 
   paymasterAddress, 
   token, 
options): Promise<object[]>;
```

Defined in: [V4/PaymasterOperator.ts:229](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterOperator.ts#L229)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `operatorWallet` | `any` |
| `publicClient` | `any` |
| `entryPoint` | `` `0x${string}` `` |
| `paymasterAddress` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |
| `options` | \{ `minDeposit?`: `bigint`; `minStake?`: `bigint`; `tokenPriceUSD?`: `bigint`; \} |
| `options.minDeposit?` | `bigint` |
| `options.minStake?` | `bigint` |
| `options.tokenPriceUSD?` | `bigint` |

###### Returns

`Promise`\<`object`[]\>

##### removeGasToken()

```ts
static removeGasToken(
   wallet, 
   address, 
token): Promise<any>;
```

Defined in: [V4/PaymasterOperator.ts:127](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterOperator.ts#L127)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `address` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |

###### Returns

`Promise`\<`any`\>

##### setMaxGasCostCap()

```ts
static setMaxGasCostCap(
   wallet, 
   address, 
cap): Promise<any>;
```

Defined in: [V4/PaymasterOperator.ts:147](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterOperator.ts#L147)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `address` | `` `0x${string}` `` |
| `cap` | `bigint` |

###### Returns

`Promise`\<`any`\>

##### setServiceFeeRate()

```ts
static setServiceFeeRate(
   wallet, 
   address, 
rate): Promise<any>;
```

Defined in: [V4/PaymasterOperator.ts:137](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterOperator.ts#L137)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `address` | `` `0x${string}` `` |
| `rate` | `bigint` |

###### Returns

`Promise`\<`any`\>

##### setTokenPrice()

```ts
static setTokenPrice(
   wallet, 
   address, 
   token, 
priceUSD): Promise<any>;
```

Defined in: [V4/PaymasterOperator.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterOperator.ts#L26)

Set the token price (in 8 decimals, e.g., 1e8 = $1 USD).

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `address` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |
| `priceUSD` | `bigint` |

###### Returns

`Promise`\<`any`\>

##### updatePrice()

```ts
static updatePrice(wallet, address): Promise<any>;
```

Defined in: [V4/PaymasterOperator.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterOperator.ts#L14)

Update the cached ETH/USD price from Chainlink Oracle.
Must be called if cachedPrice is 0 (uninitialized).

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `address` | `` `0x${string}` `` |

###### Returns

`Promise`\<`any`\>

##### withdrawPNT()

```ts
static withdrawPNT(
   wallet, 
   address, 
   to, 
   token, 
amount): Promise<any>;
```

Defined in: [V4/PaymasterOperator.ts:157](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterOperator.ts#L157)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `address` | `` `0x${string}` `` |
| `to` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |
| `amount` | `bigint` |

###### Returns

`Promise`\<`any`\>

***

### SuperPaymasterAdminClient

Defined in: [SuperPaymaster/index.ts:95](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/SuperPaymaster/index.ts#L95)

Admin Client for SuperPaymaster V3

#### Constructors

##### Constructor

```ts
new SuperPaymasterAdminClient(client, paymasterAddress): SuperPaymasterAdminClient;
```

Defined in: [SuperPaymaster/index.ts:99](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/SuperPaymaster/index.ts#L99)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `client` | `any` |
| `paymasterAddress` | `` `0x${string}` `` |

###### Returns

[`SuperPaymasterAdminClient`](#superpaymasteradminclient)

#### Methods

##### getOperator()

```ts
getOperator(operator): Promise<any>;
```

Defined in: [SuperPaymaster/index.ts:104](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/SuperPaymaster/index.ts#L104)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `operator` | `` `0x${string}` `` |

###### Returns

`Promise`\<`any`\>

##### configureOperator()

```ts
static configureOperator(
   wallet, 
   paymaster, 
   token, 
   treasury, 
exchangeRate): Promise<any>;
```

Defined in: [SuperPaymaster/index.ts:113](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/SuperPaymaster/index.ts#L113)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `paymaster` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |
| `treasury` | `` `0x${string}` `` |
| `exchangeRate` | `bigint` |

###### Returns

`Promise`\<`any`\>

##### setAPNTsToken()

```ts
static setAPNTsToken(
   wallet, 
   paymaster, 
token): Promise<any>;
```

Defined in: [SuperPaymaster/index.ts:149](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/SuperPaymaster/index.ts#L149)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `paymaster` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |

###### Returns

`Promise`\<`any`\>

##### setOperatorPaused()

```ts
static setOperatorPaused(
   wallet, 
   paymaster, 
   operator, 
paused): Promise<any>;
```

Defined in: [SuperPaymaster/index.ts:129](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/SuperPaymaster/index.ts#L129)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `paymaster` | `` `0x${string}` `` |
| `operator` | `` `0x${string}` `` |
| `paused` | `boolean` |

###### Returns

`Promise`\<`any`\>

##### setXPNTsFactory()

```ts
static setXPNTsFactory(
   wallet, 
   paymaster, 
factory): Promise<any>;
```

Defined in: [SuperPaymaster/index.ts:159](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/SuperPaymaster/index.ts#L159)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `paymaster` | `` `0x${string}` `` |
| `factory` | `` `0x${string}` `` |

###### Returns

`Promise`\<`any`\>

##### updateReputation()

```ts
static updateReputation(
   wallet, 
   paymaster, 
   operator, 
score): Promise<any>;
```

Defined in: [SuperPaymaster/index.ts:139](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/SuperPaymaster/index.ts#L139)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `paymaster` | `` `0x${string}` `` |
| `operator` | `` `0x${string}` `` |
| `score` | `bigint` |

###### Returns

`Promise`\<`any`\>

***

### SuperPaymasterClient

Defined in: [V4/SuperPaymasterClient.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/SuperPaymasterClient.ts#L20)

SuperPaymasterClient
High-level API for SuperPaymaster operations, including dynamic gas estimation.

#### Constructors

##### Constructor

```ts
new SuperPaymasterClient(): SuperPaymasterClient;
```

###### Returns

[`SuperPaymasterClient`](#superpaymasterclient)

#### Methods

##### submitGaslessTransaction()

```ts
static submitGaslessTransaction(
   client, 
   wallet, 
   aaAddress, 
   entryPoint, 
   bundlerUrl, 
config): Promise<`0x${string}`>;
```

Defined in: [V4/SuperPaymasterClient.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/SuperPaymasterClient.ts#L26)

Submit a gasless transaction using SuperPaymaster.
Automatically handles gas estimation with a smart efficiency buffer.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `client` | `any` |
| `wallet` | `any` |
| `aaAddress` | `` `0x${string}` `` |
| `entryPoint` | `` `0x${string}` `` |
| `bundlerUrl` | `string` |
| `config` | [`GaslessTransactionConfig`](#gaslesstransactionconfig) |

###### Returns

`Promise`\<`` `0x${string}` ``\>

## Type Aliases

### GaslessReadinessReport

```ts
type GaslessReadinessReport = object;
```

Defined in: [V4/PaymasterUtils.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterUtils.ts#L11)

#### Properties

##### details

```ts
details: object;
```

Defined in: [V4/PaymasterUtils.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterUtils.ts#L14)

###### ethUsdPrice

```ts
ethUsdPrice: bigint;
```

###### paymasterDeposit

```ts
paymasterDeposit: bigint;
```

###### paymasterStake

```ts
paymasterStake: bigint;
```

###### tokenPrice

```ts
tokenPrice: bigint;
```

###### tokenSupported

```ts
tokenSupported: boolean;
```

###### userPaymasterDeposit

```ts
userPaymasterDeposit: bigint;
```

###### userTokenBalance

```ts
userTokenBalance: bigint;
```

##### isReady

```ts
isReady: boolean;
```

Defined in: [V4/PaymasterUtils.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterUtils.ts#L12)

##### issues

```ts
issues: string[];
```

Defined in: [V4/PaymasterUtils.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterUtils.ts#L13)

***

### GaslessTransactionConfig

```ts
type GaslessTransactionConfig = object;
```

Defined in: [V4/SuperPaymasterClient.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/SuperPaymasterClient.ts#L6)

#### Properties

##### amount

```ts
amount: bigint;
```

Defined in: [V4/SuperPaymasterClient.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/SuperPaymasterClient.ts#L9)

##### factory?

```ts
optional factory: Address;
```

Defined in: [V4/SuperPaymasterClient.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/SuperPaymasterClient.ts#L12)

##### factoryData?

```ts
optional factoryData: Hex;
```

Defined in: [V4/SuperPaymasterClient.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/SuperPaymasterClient.ts#L13)

##### operator

```ts
operator: Address;
```

Defined in: [V4/SuperPaymasterClient.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/SuperPaymasterClient.ts#L10)

##### paymasterAddress

```ts
paymasterAddress: Address;
```

Defined in: [V4/SuperPaymasterClient.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/SuperPaymasterClient.ts#L11)

##### recipient

```ts
recipient: Address;
```

Defined in: [V4/SuperPaymasterClient.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/SuperPaymasterClient.ts#L8)

##### token

```ts
token: Address;
```

Defined in: [V4/SuperPaymasterClient.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/SuperPaymasterClient.ts#L7)

***

### PaymasterConfig

```ts
type PaymasterConfig = object;
```

Defined in: [SuperPaymaster/index.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/SuperPaymaster/index.ts#L4)

#### Properties

##### maxRate?

```ts
optional maxRate: bigint;
```

Defined in: [SuperPaymaster/index.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/SuperPaymaster/index.ts#L7)

##### operator

```ts
operator: Address;
```

Defined in: [SuperPaymaster/index.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/SuperPaymaster/index.ts#L6)

##### paymasterAddress

```ts
paymasterAddress: Address;
```

Defined in: [SuperPaymaster/index.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/SuperPaymaster/index.ts#L5)

##### postOpGasLimit?

```ts
optional postOpGasLimit: bigint;
```

Defined in: [SuperPaymaster/index.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/SuperPaymaster/index.ts#L9)

##### verificationGasLimit?

```ts
optional verificationGasLimit: bigint;
```

Defined in: [SuperPaymaster/index.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/SuperPaymaster/index.ts#L8)

***

### PaymasterV4MiddlewareConfig

```ts
type PaymasterV4MiddlewareConfig = object;
```

Defined in: [V4/PaymasterUtils.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterUtils.ts#L4)

#### Properties

##### gasToken

```ts
gasToken: Address;
```

Defined in: [V4/PaymasterUtils.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterUtils.ts#L6)

##### paymasterAddress

```ts
paymasterAddress: Address;
```

Defined in: [V4/PaymasterUtils.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterUtils.ts#L5)

##### postOpGasLimit?

```ts
optional postOpGasLimit: bigint;
```

Defined in: [V4/PaymasterUtils.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterUtils.ts#L8)

##### verificationGasLimit?

```ts
optional verificationGasLimit: bigint;
```

Defined in: [V4/PaymasterUtils.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterUtils.ts#L7)

## Functions

### buildPaymasterData()

```ts
function buildPaymasterData(
   paymasterAddress, 
   token, 
   options?): `0x${string}`;
```

Defined in: [V4/PaymasterUtils.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterUtils.ts#L59)

Build paymasterAndData for gasless UserOperation.
Layout: [Paymaster(20)] [VerificationGasLimit(16)] [PostOpGasLimit(16)] [Token(20)] [ValidUntil(6)] [ValidAfter(6)]

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `paymasterAddress` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |
| `options?` | \{ `postOpGasLimit?`: `bigint`; `validityWindow?`: `number`; `verificationGasLimit?`: `bigint`; \} |
| `options.postOpGasLimit?` | `bigint` |
| `options.validityWindow?` | `number` |
| `options.verificationGasLimit?` | `bigint` |

#### Returns

`` `0x${string}` ``

***

### buildSuperPaymasterData()

```ts
function buildSuperPaymasterData(
   paymasterAddress, 
   operator, 
   options?): `0x${string}`;
```

Defined in: [V4/PaymasterUtils.ts:95](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterUtils.ts#L95)

Build paymasterAndData for SuperPaymaster V3.
Layout: [Paymaster(20)] [verGas(16)] [postGas(16)] [operator(20)] [maxRate(32)]

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `paymasterAddress` | `` `0x${string}` `` |
| `operator` | `` `0x${string}` `` |
| `options?` | \{ `postOpGasLimit?`: `bigint`; `verificationGasLimit?`: `bigint`; \} |
| `options.postOpGasLimit?` | `bigint` |
| `options.verificationGasLimit?` | `bigint` |

#### Returns

`` `0x${string}` ``

***

### checkEligibility()

```ts
function checkEligibility(
   client, 
   paymaster, 
   user, 
   operator): Promise<{
  credit?: bigint;
  eligible: boolean;
  token?: `0x${string}`;
}>;
```

Defined in: [SuperPaymaster/index.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/SuperPaymaster/index.ts#L49)

Enhanced eligibility check for SuperPaymaster V3.
Validates that user has sufficient credit with the given operator.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `client` | `any` |
| `paymaster` | `` `0x${string}` `` |
| `user` | `` `0x${string}` `` |
| `operator` | `` `0x${string}` `` |

#### Returns

`Promise`\<\{
  `credit?`: `bigint`;
  `eligible`: `boolean`;
  `token?`: `` `0x${string}` ``;
\}\>

***

### formatUserOpV07()

```ts
function formatUserOpV07(userOp): any;
```

Defined in: [V4/PaymasterUtils.ts:123](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterUtils.ts#L123)

Helper to format UserOp for Alchemy/Standard Bundlers (v0.7 Decomposed)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userOp` | `any` |

#### Returns

`any`

***

### getPaymasterV4Middleware()

```ts
function getPaymasterV4Middleware(config): object;
```

Defined in: [V4/PaymasterUtils.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterUtils.ts#L32)

Constructs the middleware for Paymaster V4.
Returns the `paymasterAndData` hex string.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`PaymasterV4MiddlewareConfig`](#paymasterv4middlewareconfig) |

#### Returns

`object`

| Name | Type | Defined in |
| ------ | ------ | ------ |
| `sponsorUserOperation()` | (`args`) => `Promise`\<\{ `paymasterAndData`: `` `0x${string}` ``; `preVerificationGas`: `any`; `verificationGasLimit`: `bigint`; \}\> | [V4/PaymasterUtils.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterUtils.ts#L34) |

***

### getSuperPaymasterMiddleware()

```ts
function getSuperPaymasterMiddleware(config): object;
```

Defined in: [SuperPaymaster/index.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/SuperPaymaster/index.ts#L19)

Constructs the middleware for SuperPaymaster.
Returns the `paymasterAndData` hex string.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`PaymasterConfig`](#paymasterconfig) |

#### Returns

`object`

| Name | Type | Defined in |
| ------ | ------ | ------ |
| `sponsorUserOperation()` | (`args`) => `Promise`\<\{ `paymasterAndData`: `` `0x${string}` ``; `preVerificationGas`: `any`; `verificationGasLimit`: `bigint`; \}\> | [SuperPaymaster/index.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/SuperPaymaster/index.ts#L21) |

***

### getUserOpHashV07()

```ts
function getUserOpHashV07(
   userOp, 
   entryPoint, 
   chainId): `0x${string}`;
```

Defined in: [V4/PaymasterUtils.ts:167](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/paymaster/src/V4/PaymasterUtils.ts#L167)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userOp` | `any` |
| `entryPoint` | `` `0x${string}` `` |
| `chainId` | `bigint` |

#### Returns

`` `0x${string}` ``
