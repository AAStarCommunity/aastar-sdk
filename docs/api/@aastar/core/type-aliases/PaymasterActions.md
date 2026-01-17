> **PaymasterActions** = `object`

Defined in: [packages/core/src/actions/paymaster.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L7)

## Properties

### ~~addGasToken()~~

> **addGasToken**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L20)

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

### ~~addSBT()~~

> **addSBT**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L28)

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

### addStake()

> **addStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L83)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### unstakeDelaySec

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### balances()

> **balances**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymaster.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L12)

#### Parameters

##### args

###### token

`Address`

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### cachedPrice()

> **cachedPrice**: () => `Promise`\<\{ `lastUpdate`: `number`; `price`: `bigint`; \}\>

Defined in: [packages/core/src/actions/paymaster.ts:53](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L53)

#### Returns

`Promise`\<\{ `lastUpdate`: `number`; `price`: `bigint`; \}\>

***

### calculateCost()

> **calculateCost**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymaster.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L56)

#### Parameters

##### args

###### gasCost

`bigint`

###### token

`Address`

###### useRealtime

`boolean`

#### Returns

`Promise`\<`bigint`\>

***

### deactivateFromRegistry()

> **deactivateFromRegistry**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L61)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### deposit()

> **deposit**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:81](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L81)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### depositFor()

> **depositFor**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L10)

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

### entryPoint()

> **entryPoint**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/paymaster.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L89)

#### Returns

`Promise`\<`Address`\>

***

### ethUsdPriceFeed()

> **ethUsdPriceFeed**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/paymaster.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L65)

#### Returns

`Promise`\<`Address`\>

***

### getDeposit()

> **getDeposit**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymaster.ts:86](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L86)

#### Returns

`Promise`\<`bigint`\>

***

### getRealtimeTokenCost()

> **getRealtimeTokenCost**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymaster.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L55)

#### Parameters

##### args

###### gasCost

`bigint`

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### ~~getSupportedGasTokens()~~

> **getSupportedGasTokens**: () => `Promise`\<`Address`[]\>

Defined in: [packages/core/src/actions/paymaster.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L24)

#### Returns

`Promise`\<`Address`[]\>

#### Deprecated

V4 uses depositFor + tokenPrices instead

***

### ~~getSupportedSBTs()~~

> **getSupportedSBTs**: () => `Promise`\<`Address`[]\>

Defined in: [packages/core/src/actions/paymaster.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L32)

#### Returns

`Promise`\<`Address`[]\>

#### Deprecated

V4 does not use SBT whitelist

***

### initialize()

> **initialize**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L41)

#### Parameters

##### args

###### _entryPoint

`Address`

###### _ethUsdPriceFeed

`Address`

###### _maxGasCostCap

`bigint`

###### _owner

`Address`

###### _priceStalenessThreshold

`bigint`

###### _serviceFeeRate

`bigint`

###### _treasury

`Address`

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### isActiveInRegistry()

> **isActiveInRegistry**: () => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/paymaster.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L59)

#### Returns

`Promise`\<`boolean`\>

***

### ~~isGasTokenSupported()~~

> **isGasTokenSupported**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/paymaster.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L26)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`boolean`\>

#### Deprecated

V4 uses depositFor + tokenPrices instead

***

### isRegistrySet()

> **isRegistrySet**: () => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/paymaster.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L60)

#### Returns

`Promise`\<`boolean`\>

***

### ~~isSBTSupported()~~

> **isSBTSupported**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/paymaster.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L34)

#### Parameters

##### args

###### sbt

`Address`

#### Returns

`Promise`\<`boolean`\>

#### Deprecated

V4 does not use SBT whitelist

***

### MAX\_ETH\_USD\_PRICE()

> **MAX\_ETH\_USD\_PRICE**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymaster.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L74)

#### Returns

`Promise`\<`bigint`\>

***

### MAX\_GAS\_TOKENS()

> **MAX\_GAS\_TOKENS**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymaster.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L76)

#### Returns

`Promise`\<`bigint`\>

***

### MAX\_SBTS()

> **MAX\_SBTS**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymaster.ts:77](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L77)

#### Returns

`Promise`\<`bigint`\>

***

### MAX\_SERVICE\_FEE()

> **MAX\_SERVICE\_FEE**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymaster.ts:78](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L78)

#### Returns

`Promise`\<`bigint`\>

***

### maxGasCostCap()

> **maxGasCostCap**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymaster.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L67)

#### Returns

`Promise`\<`bigint`\>

***

### MIN\_ETH\_USD\_PRICE()

> **MIN\_ETH\_USD\_PRICE**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymaster.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L75)

#### Returns

`Promise`\<`bigint`\>

***

### oracleDecimals()

> **oracleDecimals**: () => `Promise`\<`number`\>

Defined in: [packages/core/src/actions/paymaster.ts:70](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L70)

#### Returns

`Promise`\<`number`\>

***

### owner()

> **owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/paymaster.ts:92](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L92)

#### Returns

`Promise`\<`Address`\>

***

### pause()

> **pause**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L48)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### paused()

> **paused**: () => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/paymaster.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L50)

#### Returns

`Promise`\<`boolean`\>

***

### postOp()

> **postOp**: (`args`) => `Promise`\<`void`\>

Defined in: [packages/core/src/actions/paymaster.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L38)

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

### priceStalenessThreshold()

> **priceStalenessThreshold**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymaster.ts:68](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L68)

#### Returns

`Promise`\<`bigint`\>

***

### registry()

> **registry**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/paymaster.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L62)

#### Returns

`Promise`\<`Address`\>

***

### ~~removeGasToken()~~

> **removeGasToken**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L22)

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

### ~~removeSBT()~~

> **removeSBT**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L30)

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

### renounceOwnership()

> **renounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:94](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L94)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### serviceFeeRate()

> **serviceFeeRate**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymaster.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L66)

#### Returns

`Promise`\<`bigint`\>

***

### setMaxGasCostCap()

> **setMaxGasCostCap**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L44)

#### Parameters

##### args

###### _maxGasCostCap

`bigint`

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setPriceStalenessThreshold()

> **setPriceStalenessThreshold**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L45)

#### Parameters

##### args

###### _priceStalenessThreshold

`bigint`

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setServiceFeeRate()

> **setServiceFeeRate**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L43)

#### Parameters

##### args

###### _serviceFeeRate

`bigint`

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setTokenPrice()

> **setTokenPrice**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L15)

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

### setTreasury()

> **setTreasury**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L42)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### treasury

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### tokenDecimals()

> **tokenDecimals**: (`args`) => `Promise`\<`number`\>

Defined in: [packages/core/src/actions/paymaster.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L71)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`number`\>

***

### tokenPrices()

> **tokenPrices**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymaster.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L16)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### transferOwnership()

> **transferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:93](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L93)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### newOwner

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### treasury()

> **treasury**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/paymaster.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L69)

#### Returns

`Promise`\<`Address`\>

***

### unlockPaymasterStake()

> **unlockPaymasterStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L84)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### unpause()

> **unpause**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L49)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### updatePrice()

> **updatePrice**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L54)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### validatePaymasterUserOp()

> **validatePaymasterUserOp**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/paymaster.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L37)

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

### version()

> **version**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/paymaster.ts:95](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L95)

#### Returns

`Promise`\<`string`\>

***

### withdraw()

> **withdraw**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L11)

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

### withdrawStake()

> **withdrawStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:85](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L85)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### to

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### withdrawTo()

> **withdrawTo**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/paymaster.ts#L82)

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
