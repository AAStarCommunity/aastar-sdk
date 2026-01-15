Defined in: [V4/PaymasterOperator.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/paymaster/src/V4/PaymasterOperator.ts#L8)

PaymasterOperator
Focus: Deployment, Configuration, Maintenance, Keeper Bots.

## Constructors

### Constructor

```ts
new PaymasterOperator(): PaymasterOperator;
```

#### Returns

`PaymasterOperator`

## Methods

### addDeposit()

```ts
static addDeposit(
   wallet, 
   address, 
amount): Promise<any>;
```

Defined in: [V4/PaymasterOperator.ts:107](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/paymaster/src/V4/PaymasterOperator.ts#L107)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `address` | `` `0x${string}` `` |
| `amount` | `bigint` |

#### Returns

`Promise`\<`any`\>

***

### addGasToken()

```ts
static addGasToken(
   wallet, 
   address, 
token): Promise<any>;
```

Defined in: [V4/PaymasterOperator.ts:117](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/paymaster/src/V4/PaymasterOperator.ts#L117)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `address` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |

#### Returns

`Promise`\<`any`\>

***

### addStake()

```ts
static addStake(
   wallet, 
   address, 
   amount, 
unstakeDelaySec): Promise<any>;
```

Defined in: [V4/PaymasterOperator.ts:96](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/paymaster/src/V4/PaymasterOperator.ts#L96)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `address` | `` `0x${string}` `` |
| `amount` | `bigint` |
| `unstakeDelaySec` | `number` |

#### Returns

`Promise`\<`any`\>

***

### checkGaslessReadiness()

```ts
static checkGaslessReadiness(
   publicClient, 
   entryPoint, 
   paymasterAddress, 
   user, 
token): Promise<GaslessReadinessReport>;
```

Defined in: [V4/PaymasterOperator.ts:169](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/paymaster/src/V4/PaymasterOperator.ts#L169)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `publicClient` | `any` |
| `entryPoint` | `` `0x${string}` `` |
| `paymasterAddress` | `` `0x${string}` `` |
| `user` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |

#### Returns

`Promise`\<[`GaslessReadinessReport`](../type-aliases/GaslessReadinessReport.md)\>

***

### ensurePriceInitialized()

```ts
static ensurePriceInitialized(
   wallet, 
   publicClient, 
address): Promise<boolean>;
```

Defined in: [V4/PaymasterOperator.ts:87](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/paymaster/src/V4/PaymasterOperator.ts#L87)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `publicClient` | `any` |
| `address` | `` `0x${string}` `` |

#### Returns

`Promise`\<`boolean`\>

***

### getCachedPrice()

```ts
static getCachedPrice(publicClient, address): Promise<{
  price: bigint;
  updatedAt: bigint;
}>;
```

Defined in: [V4/PaymasterOperator.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/paymaster/src/V4/PaymasterOperator.ts#L36)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `publicClient` | `any` |
| `address` | `` `0x${string}` `` |

#### Returns

`Promise`\<\{
  `price`: `bigint`;
  `updatedAt`: `bigint`;
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

Defined in: [V4/PaymasterOperator.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/paymaster/src/V4/PaymasterOperator.ts#L69)

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

### getTokenPrice()

```ts
static getTokenPrice(
   publicClient, 
   address, 
token): Promise<bigint>;
```

Defined in: [V4/PaymasterOperator.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/paymaster/src/V4/PaymasterOperator.ts#L54)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `publicClient` | `any` |
| `address` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |

#### Returns

`Promise`\<`bigint`\>

***

### prepareGaslessEnvironment()

```ts
static prepareGaslessEnvironment(
   operatorWallet, 
   publicClient, 
   entryPoint, 
   paymasterAddress, 
   token, 
options): Promise<object[]>;
```

Defined in: [V4/PaymasterOperator.ts:229](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/paymaster/src/V4/PaymasterOperator.ts#L229)

#### Parameters

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

#### Returns

`Promise`\<`object`[]\>

***

### removeGasToken()

```ts
static removeGasToken(
   wallet, 
   address, 
token): Promise<any>;
```

Defined in: [V4/PaymasterOperator.ts:127](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/paymaster/src/V4/PaymasterOperator.ts#L127)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `address` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |

#### Returns

`Promise`\<`any`\>

***

### setMaxGasCostCap()

```ts
static setMaxGasCostCap(
   wallet, 
   address, 
cap): Promise<any>;
```

Defined in: [V4/PaymasterOperator.ts:147](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/paymaster/src/V4/PaymasterOperator.ts#L147)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `address` | `` `0x${string}` `` |
| `cap` | `bigint` |

#### Returns

`Promise`\<`any`\>

***

### setServiceFeeRate()

```ts
static setServiceFeeRate(
   wallet, 
   address, 
rate): Promise<any>;
```

Defined in: [V4/PaymasterOperator.ts:137](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/paymaster/src/V4/PaymasterOperator.ts#L137)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `address` | `` `0x${string}` `` |
| `rate` | `bigint` |

#### Returns

`Promise`\<`any`\>

***

### setTokenPrice()

```ts
static setTokenPrice(
   wallet, 
   address, 
   token, 
priceUSD): Promise<any>;
```

Defined in: [V4/PaymasterOperator.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/paymaster/src/V4/PaymasterOperator.ts#L26)

Set the token price (in 8 decimals, e.g., 1e8 = $1 USD).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `address` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |
| `priceUSD` | `bigint` |

#### Returns

`Promise`\<`any`\>

***

### updatePrice()

```ts
static updatePrice(wallet, address): Promise<any>;
```

Defined in: [V4/PaymasterOperator.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/paymaster/src/V4/PaymasterOperator.ts#L14)

Update the cached ETH/USD price from Chainlink Oracle.
Must be called if cachedPrice is 0 (uninitialized).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `address` | `` `0x${string}` `` |

#### Returns

`Promise`\<`any`\>

***

### withdrawPNT()

```ts
static withdrawPNT(
   wallet, 
   address, 
   to, 
   token, 
amount): Promise<any>;
```

Defined in: [V4/PaymasterOperator.ts:157](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/paymaster/src/V4/PaymasterOperator.ts#L157)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `address` | `` `0x${string}` `` |
| `to` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |
| `amount` | `bigint` |

#### Returns

`Promise`\<`any`\>
