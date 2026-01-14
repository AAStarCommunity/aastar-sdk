> **PaymasterV4Actions** = `object`

Defined in: [packages/core/src/actions/paymasterV4.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L5)

## Properties

### paymasterV4AddDeposit()

> **paymasterV4AddDeposit**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L67)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### ~~paymasterV4AddGasToken()~~

> **paymasterV4AddGasToken**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L18)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### priceFeed

`Address`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

V4 uses depositFor + tokenPrices instead

***

### ~~paymasterV4AddSBT()~~

> **paymasterV4AddSBT**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L26)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### sbt

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

V4 does not use SBT whitelist

***

### paymasterV4AddStake()

> **paymasterV4AddStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L41)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

###### unstakeDelaySec

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### paymasterV4Balances()

> **paymasterV4Balances**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L10)

#### Parameters

##### args

###### token

`Address`

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4CachedPriceView()

> **paymasterV4CachedPriceView**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:79](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L79)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4CalculateCost()

> **paymasterV4CalculateCost**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L75)

#### Parameters

##### args

###### gasCost

`bigint`

###### param

`any`

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4DeactivateFromRegistry()

> **paymasterV4DeactivateFromRegistry**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:88](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L88)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### paymasterV4Deposit()

> **paymasterV4Deposit**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L39)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### paymasterV4DepositFor()

> **paymasterV4DepositFor**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L8)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

###### token

`Address`

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### paymasterV4EntryPoint()

> **paymasterV4EntryPoint**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L47)

#### Returns

`Promise`\<`Address`\>

***

### paymasterV4EthUsdPriceFeed()

> **paymasterV4EthUsdPriceFeed**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L71)

#### Returns

`Promise`\<`Address`\>

***

### paymasterV4GetDeposit()

> **paymasterV4GetDeposit**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L44)

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4GetRealtimeTokenCost()

> **paymasterV4GetRealtimeTokenCost**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L76)

#### Parameters

##### args

###### gasCost

`bigint`

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### ~~paymasterV4GetSupportedGasTokens()~~

> **paymasterV4GetSupportedGasTokens**: () => `Promise`\<`Address`[]\>

Defined in: [packages/core/src/actions/paymasterV4.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L22)

#### Returns

`Promise`\<`Address`[]\>

#### Deprecated

V4 uses depositFor + tokenPrices instead

***

### ~~paymasterV4GetSupportedSBTs()~~

> **paymasterV4GetSupportedSBTs**: () => `Promise`\<`Address`[]\>

Defined in: [packages/core/src/actions/paymasterV4.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L30)

#### Returns

`Promise`\<`Address`[]\>

#### Deprecated

V4 does not use SBT whitelist

***

### paymasterV4Initialize()

> **paymasterV4Initialize**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L89)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### owner

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### paymasterV4IsActiveInRegistry()

> **paymasterV4IsActiveInRegistry**: () => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:77](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L77)

#### Returns

`Promise`\<`boolean`\>

***

### ~~paymasterV4IsGasTokenSupported()~~

> **paymasterV4IsGasTokenSupported**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L24)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`boolean`\>

#### Deprecated

V4 uses depositFor + tokenPrices instead

***

### paymasterV4IsRegistrySet()

> **paymasterV4IsRegistrySet**: () => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:78](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L78)

#### Returns

`Promise`\<`boolean`\>

***

### ~~paymasterV4IsSBTSupported()~~

> **paymasterV4IsSBTSupported**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L32)

#### Parameters

##### args

###### sbt

`Address`

#### Returns

`Promise`\<`boolean`\>

#### Deprecated

V4 does not use SBT whitelist

***

### paymasterV4MaxEthUsdPrice()

> **paymasterV4MaxEthUsdPrice**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L59)

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4MaxGasCostCap()

> **paymasterV4MaxGasCostCap**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L58)

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4MaxGasTokens()

> **paymasterV4MaxGasTokens**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L60)

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4MaxSbts()

> **paymasterV4MaxSbts**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L61)

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4MaxServiceFee()

> **paymasterV4MaxServiceFee**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L62)

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4MinEthUsdPrice()

> **paymasterV4MinEthUsdPrice**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L63)

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4OracleDecimals()

> **paymasterV4OracleDecimals**: () => `Promise`\<`number`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:72](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L72)

#### Returns

`Promise`\<`number`\>

***

### paymasterV4Owner()

> **paymasterV4Owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L50)

#### Returns

`Promise`\<`Address`\>

***

### paymasterV4Paused()

> **paymasterV4Paused**: () => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L57)

#### Returns

`Promise`\<`boolean`\>

***

### paymasterV4PostOp()

> **paymasterV4PostOp**: (`args`) => `Promise`\<`void`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L36)

#### Parameters

##### args

###### actualGasCost

`bigint`

###### actualUserOpFeePerGas

`bigint`

###### context

[`Hex`](https://viem.sh/docs/index.html)

###### mode

`number`

#### Returns

`Promise`\<`void`\>

***

### paymasterV4PriceStalenessThreshold()

> **paymasterV4PriceStalenessThreshold**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:64](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L64)

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4Registry()

> **paymasterV4Registry**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L55)

#### Returns

`Promise`\<`Address`\>

***

### ~~paymasterV4RemoveGasToken()~~

> **paymasterV4RemoveGasToken**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L20)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

V4 uses depositFor + tokenPrices instead

***

### ~~paymasterV4RemoveSBT()~~

> **paymasterV4RemoveSBT**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L28)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### sbt

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

V4 does not use SBT whitelist

***

### paymasterV4RenounceOwnership()

> **paymasterV4RenounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L52)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### paymasterV4ServiceFeeRate()

> **paymasterV4ServiceFeeRate**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L74)

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4SetCachedPrice()

> **paymasterV4SetCachedPrice**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L82)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### price

`bigint`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### paymasterV4SetMaxGasCostCap()

> **paymasterV4SetMaxGasCostCap**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L84)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### cap

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### paymasterV4SetPriceStalenessThreshold()

> **paymasterV4SetPriceStalenessThreshold**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:85](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L85)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### threshold

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### paymasterV4SetServiceFeeRate()

> **paymasterV4SetServiceFeeRate**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L83)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### rate

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### paymasterV4SetTokenPrice()

> **paymasterV4SetTokenPrice**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L13)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### price

`bigint`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### paymasterV4SetTreasury()

> **paymasterV4SetTreasury**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:86](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L86)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### treasury

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### paymasterV4TokenDecimals()

> **paymasterV4TokenDecimals**: (`args`) => `Promise`\<`number`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L73)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`number`\>

***

### paymasterV4TokenPrices()

> **paymasterV4TokenPrices**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L14)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4TransferOwnership()

> **paymasterV4TransferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L51)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### newOwner

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### paymasterV4Treasury()

> **paymasterV4Treasury**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L56)

#### Returns

`Promise`\<`Address`\>

***

### paymasterV4UnlockPaymasterStake()

> **paymasterV4UnlockPaymasterStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L42)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### paymasterV4UnlockStake()

> **paymasterV4UnlockStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:68](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L68)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### paymasterV4UpdatePrice()

> **paymasterV4UpdatePrice**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:87](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L87)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### paymasterV4ValidatePaymasterUserOp()

> **paymasterV4ValidatePaymasterUserOp**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L35)

#### Parameters

##### args

###### maxCost

`bigint`

###### userOp

`any`

###### userOpHash

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`any`\>

***

### paymasterV4Version()

> **paymasterV4Version**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:91](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L91)

#### Returns

`Promise`\<`string`\>

***

### paymasterV4Withdraw()

> **paymasterV4Withdraw**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L9)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### paymasterV4WithdrawStake()

> **paymasterV4WithdrawStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L43)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### to

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### paymasterV4WithdrawTo()

> **paymasterV4WithdrawTo**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/paymasterV4.ts#L40)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

###### to

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>
