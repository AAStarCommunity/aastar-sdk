> **PaymasterActions** = `object`

Defined in: [packages/core/src/actions/paymaster.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L6)

## Properties

### addDeposit()

> **addDeposit**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L62)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `value?`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.value?` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### addStake()

> **addStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:64](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L64)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `unstakeDelaySec`: `number`; `value?`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.unstakeDelaySec` | `number` |
| `args.value?` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### balances()

> **balances**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymaster.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L10)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; `user`: `Address`; \} |
| `args.token` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### cachedPrice()

> **cachedPrice**: () => `Promise`\<\{ `price`: `bigint`; `updatedAt`: `number`; \}\>

Defined in: [packages/core/src/actions/paymaster.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L34)

#### Returns

`Promise`\<\{ `price`: `bigint`; `updatedAt`: `number`; \}\>

***

### calculateCost()

> **calculateCost**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymaster.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L37)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `gasCost`: `bigint`; `token`: `Address`; `useRealtime`: `boolean`; \} |
| `args.gasCost` | `bigint` |
| `args.token` | `Address` |
| `args.useRealtime` | `boolean` |

#### Returns

`Promise`\<`bigint`\>

***

### deactivateFromRegistry()

> **deactivateFromRegistry**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L42)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### depositFor()

> **depositFor**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L8)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amount`: `bigint`; `token`: `Address`; `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amount` | `bigint` |
| `args.token` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### entryPoint()

> **entryPoint**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/paymaster.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L69)

#### Returns

`Promise`\<`Address`\>

***

### ethUsdPriceFeed()

> **ethUsdPriceFeed**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/paymaster.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L46)

#### Returns

`Promise`\<`Address`\>

***

### getRealtimeTokenCost()

> **getRealtimeTokenCost**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymaster.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L36)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `gasCost`: `bigint`; `token`: `Address`; \} |
| `args.gasCost` | `bigint` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### initialize()

> **initialize**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L22)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `_entryPoint`: `Address`; `_ethUsdPriceFeed`: `Address`; `_maxGasCostCap`: `bigint`; `_owner`: `Address`; `_priceStalenessThreshold`: `bigint`; `_serviceFeeRate`: `bigint`; `_treasury`: `Address`; `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args._entryPoint` | `Address` |
| `args._ethUsdPriceFeed` | `Address` |
| `args._maxGasCostCap` | `bigint` |
| `args._owner` | `Address` |
| `args._priceStalenessThreshold` | `bigint` |
| `args._serviceFeeRate` | `bigint` |
| `args._treasury` | `Address` |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### isActiveInRegistry()

> **isActiveInRegistry**: () => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/paymaster.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L40)

#### Returns

`Promise`\<`boolean`\>

***

### isRegistrySet()

> **isRegistrySet**: () => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/paymaster.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L41)

#### Returns

`Promise`\<`boolean`\>

***

### MAX\_ETH\_USD\_PRICE()

> **MAX\_ETH\_USD\_PRICE**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymaster.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L55)

#### Returns

`Promise`\<`bigint`\>

***

### MAX\_GAS\_TOKENS()

> **MAX\_GAS\_TOKENS**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymaster.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L57)

#### Returns

`Promise`\<`bigint`\>

***

### MAX\_SBTS()

> **MAX\_SBTS**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymaster.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L58)

#### Returns

`Promise`\<`bigint`\>

***

### MAX\_SERVICE\_FEE()

> **MAX\_SERVICE\_FEE**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymaster.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L59)

#### Returns

`Promise`\<`bigint`\>

***

### maxGasCostCap()

> **maxGasCostCap**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymaster.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L48)

#### Returns

`Promise`\<`bigint`\>

***

### MIN\_ETH\_USD\_PRICE()

> **MIN\_ETH\_USD\_PRICE**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymaster.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L56)

#### Returns

`Promise`\<`bigint`\>

***

### oracleDecimals()

> **oracleDecimals**: () => `Promise`\<`number`\>

Defined in: [packages/core/src/actions/paymaster.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L51)

#### Returns

`Promise`\<`number`\>

***

### owner()

> **owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/paymaster.ts:72](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L72)

#### Returns

`Promise`\<`Address`\>

***

### pause()

> **pause**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L29)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### paused()

> **paused**: () => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/paymaster.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L31)

#### Returns

`Promise`\<`boolean`\>

***

### postOp()

> **postOp**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L19)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `actualGasCost`: `bigint`; `actualUserOpFeePerGas`: `bigint`; `context`: [`Hex`](https://viem.sh/docs/index.html); `mode`: `number`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.actualGasCost` | `bigint` |
| `args.actualUserOpFeePerGas` | `bigint` |
| `args.context` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.mode` | `number` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### priceStalenessThreshold()

> **priceStalenessThreshold**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymaster.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L49)

#### Returns

`Promise`\<`bigint`\>

***

### registry()

> **registry**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/paymaster.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L43)

#### Returns

`Promise`\<`Address`\>

***

### renounceOwnership()

> **renounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L74)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### serviceFeeRate()

> **serviceFeeRate**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymaster.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L47)

#### Returns

`Promise`\<`bigint`\>

***

### setCachedPrice()

> **setCachedPrice**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L14)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `price`: `bigint`; `timestamp`: `number`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.price` | `bigint` |
| `args.timestamp` | `number` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setMaxGasCostCap()

> **setMaxGasCostCap**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L25)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `_maxGasCostCap`: `bigint`; `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args._maxGasCostCap` | `bigint` |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setPriceStalenessThreshold()

> **setPriceStalenessThreshold**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L26)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `_priceStalenessThreshold`: `bigint`; `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args._priceStalenessThreshold` | `bigint` |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setServiceFeeRate()

> **setServiceFeeRate**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L24)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `_serviceFeeRate`: `bigint`; `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args._serviceFeeRate` | `bigint` |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setTokenPrice()

> **setTokenPrice**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L13)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `price`: `bigint`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.price` | `bigint` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setTreasury()

> **setTreasury**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L23)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `treasury`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.treasury` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### tokenDecimals()

> **tokenDecimals**: (`args`) => `Promise`\<`number`\>

Defined in: [packages/core/src/actions/paymaster.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L52)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`number`\>

***

### tokenPrices()

> **tokenPrices**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymaster.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L15)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### transferOwnership()

> **transferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L73)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newOwner`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newOwner` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### treasury()

> **treasury**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/paymaster.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L50)

#### Returns

`Promise`\<`Address`\>

***

### unlockStake()

> **unlockStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L65)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### unpause()

> **unpause**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L30)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### updatePrice()

> **updatePrice**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L35)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### validatePaymasterUserOp()

> **validatePaymasterUserOp**: (`args`) => `Promise`\<\{ `context`: [`Hex`](https://viem.sh/docs/index.html); `validationData`: `bigint`; \}\>

Defined in: [packages/core/src/actions/paymaster.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L18)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `maxCost`: `bigint`; `userOp`: `any`; `userOpHash`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.maxCost` | `bigint` |
| `args.userOp` | `any` |
| `args.userOpHash` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<\{ `context`: [`Hex`](https://viem.sh/docs/index.html); `validationData`: `bigint`; \}\>

***

### version()

> **version**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/paymaster.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L75)

#### Returns

`Promise`\<`string`\>

***

### withdraw()

> **withdraw**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L9)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amount`: `bigint`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amount` | `bigint` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### withdrawStake()

> **withdrawStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L66)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `to`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.to` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### withdrawTo()

> **withdrawTo**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymaster.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/paymaster.ts#L63)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amount`: `bigint`; `to`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amount` | `bigint` |
| `args.to` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>
