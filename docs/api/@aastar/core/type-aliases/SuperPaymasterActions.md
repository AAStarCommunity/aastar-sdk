> **SuperPaymasterActions** = `object`

Defined in: [packages/core/src/actions/superPaymaster.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L27)

## Properties

### addStake()

> **addStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L36)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `unstakeDelaySec`: `number`; `value`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.unstakeDelaySec` | `number` |
| `args.value` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### APNTS\_TOKEN()

> **APNTS\_TOKEN**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L89)

#### Returns

`Promise`\<`Address`\>

***

### aPNTsPriceUSD()

> **aPNTsPriceUSD**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:81](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L81)

#### Returns

`Promise`\<`bigint`\>

***

### BLS\_AGGREGATOR()

> **BLS\_AGGREGATOR**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:91](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L91)

#### Returns

`Promise`\<`Address`\>

***

### BPS\_DENOMINATOR()

> **BPS\_DENOMINATOR**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:103](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L103)

#### Returns

`Promise`\<`bigint`\>

***

### cachedPrice()

> **cachedPrice**: () => `Promise`\<\{ `decimals`: `number`; `price`: `bigint`; `roundId`: `bigint`; `updatedAt`: `bigint`; \}\>

Defined in: [packages/core/src/actions/superPaymaster.ts:80](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L80)

#### Returns

`Promise`\<\{ `decimals`: `number`; `price`: `bigint`; `roundId`: `bigint`; `updatedAt`: `bigint`; \}\>

***

### configureOperator()

> **configureOperator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L41)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `exchangeRate`: `bigint`; `opTreasury`: `Address`; `xPNTsToken`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.exchangeRate` | `bigint` |
| `args.opTreasury` | `Address` |
| `args.xPNTsToken` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### deposit()

> **deposit**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L29)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amount`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amount` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### depositETH()

> **depositETH**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L30)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `value`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.value` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### depositFor()

> **depositFor**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L31)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amount`: `bigint`; `targetOperator`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amount` | `bigint` |
| `args.targetOperator` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### entryPoint()

> **entryPoint**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:95](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L95)

#### Returns

`Promise`\<`Address`\>

***

### ETH\_USD\_PRICE\_FEED()

> **ETH\_USD\_PRICE\_FEED**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:92](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L92)

#### Returns

`Promise`\<`Address`\>

***

### executeSlashWithBLS()

> **executeSlashWithBLS**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L45)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `level`: `number`; `operator`: `Address`; `proof`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.level` | `number` |
| `args.operator` | `Address` |
| `args.proof` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### getAvailableCredit()

> **getAvailableCredit**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L73)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; `user`: `Address`; \} |
| `args.token` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### getDeposit()

> **getDeposit**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L74)

#### Returns

`Promise`\<`bigint`\>

***

### getLatestSlash()

> **getLatestSlash**: (`args`) => `Promise`\<[`SlashRecord`](SlashRecord.md)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L75)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `operator`: `Address`; \} |
| `args.operator` | `Address` |

#### Returns

`Promise`\<[`SlashRecord`](SlashRecord.md)\>

***

### getSlashCount()

> **getSlashCount**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L76)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `operator`: `Address`; \} |
| `args.operator` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### getSlashHistory()

> **getSlashHistory**: (`args`) => `Promise`\<[`SlashRecord`](SlashRecord.md)[]\>

Defined in: [packages/core/src/actions/superPaymaster.ts:77](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L77)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `operator`: `Address`; \} |
| `args.operator` | `Address` |

#### Returns

`Promise`\<[`SlashRecord`](SlashRecord.md)[]\>

***

### MAX\_ETH\_USD\_PRICE()

> **MAX\_ETH\_USD\_PRICE**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:97](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L97)

#### Returns

`Promise`\<`bigint`\>

***

### MAX\_PROTOCOL\_FEE()

> **MAX\_PROTOCOL\_FEE**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:96](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L96)

#### Returns

`Promise`\<`bigint`\>

***

### MIN\_ETH\_USD\_PRICE()

> **MIN\_ETH\_USD\_PRICE**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:98](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L98)

#### Returns

`Promise`\<`bigint`\>

***

### onTransferReceived()

> **onTransferReceived**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L66)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `data`: [`Hex`](https://viem.sh/docs/index.html); `from`: `Address`; `operator`: `Address`; `value`: `bigint`; \} |
| `args.data` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.from` | `Address` |
| `args.operator` | `Address` |
| `args.value` | `bigint` |

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### operators()

> **operators**: (`args`) => `Promise`\<[`OperatorConfig`](OperatorConfig.md)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:72](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L72)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `operator`: `Address`; \} |
| `args.operator` | `Address` |

#### Returns

`Promise`\<[`OperatorConfig`](OperatorConfig.md)\>

***

### owner()

> **owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:106](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L106)

#### Returns

`Promise`\<`Address`\>

***

### PAYMASTER\_DATA\_OFFSET()

> **PAYMASTER\_DATA\_OFFSET**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:99](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L99)

#### Returns

`Promise`\<`bigint`\>

***

### PRICE\_CACHE\_DURATION()

> **PRICE\_CACHE\_DURATION**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:100](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L100)

#### Returns

`Promise`\<`bigint`\>

***

### priceStalenessThreshold()

> **priceStalenessThreshold**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:85](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L85)

#### Returns

`Promise`\<`bigint`\>

***

### protocolFeeBPS()

> **protocolFeeBPS**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L82)

#### Returns

`Promise`\<`bigint`\>

***

### protocolRevenue()

> **protocolRevenue**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L83)

#### Returns

`Promise`\<`bigint`\>

***

### RATE\_OFFSET()

> **RATE\_OFFSET**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:101](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L101)

#### Returns

`Promise`\<`bigint`\>

***

### REGISTRY()

> **REGISTRY**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:90](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L90)

#### Returns

`Promise`\<`Address`\>

***

### renounceOwnership()

> **renounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:108](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L108)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### sbtHolders()

> **sbtHolders**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:86](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L86)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### setAPNTSPrice()

> **setAPNTSPrice**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:53](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L53)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newPrice`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newPrice` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setAPNTsToken()

> **setAPNTsToken**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L61)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setBLSAggregator()

> **setBLSAggregator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L62)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `aggregator`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.aggregator` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setOperatorLimits()

> **setOperatorLimits**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L43)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `minTxInterval`: `number`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.minTxInterval` | `number` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setOperatorPaused()

> **setOperatorPaused**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L42)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `operator`: `Address`; `paused`: `boolean`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.operator` | `Address` |
| `args.paused` | `boolean` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setProtocolFee()

> **setProtocolFee**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L58)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newFeeBPS`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newFeeBPS` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setTreasury()

> **setTreasury**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L59)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `treasury`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.treasury` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setXPNTsFactory()

> **setXPNTsFactory**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L60)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `factory`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.factory` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### slashHistory()

> **slashHistory**: (`args`) => `Promise`\<[`SlashRecord`](SlashRecord.md)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:78](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L78)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `index`: `bigint`; `operator`: `Address`; \} |
| `args.index` | `bigint` |
| `args.operator` | `Address` |

#### Returns

`Promise`\<[`SlashRecord`](SlashRecord.md)\>

***

### slashOperator()

> **slashOperator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L46)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `level`: `number`; `operator`: `Address`; `penaltyAmount`: `bigint`; `reason`: `string`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.level` | `number` |
| `args.operator` | `Address` |
| `args.penaltyAmount` | `bigint` |
| `args.reason` | `string` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### totalTrackedBalance()

> **totalTrackedBalance**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L84)

#### Returns

`Promise`\<`bigint`\>

***

### transferOwnership()

> **transferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:107](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L107)

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

Defined in: [packages/core/src/actions/superPaymaster.ts:93](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L93)

#### Returns

`Promise`\<`Address`\>

***

### unlockStake()

> **unlockStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L37)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### updateBlockedStatus()

> **updateBlockedStatus**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L49)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `operator`: `Address`; `statuses`: `boolean`[]; `users`: `Address`[]; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.operator` | `Address` |
| `args.statuses` | `boolean`[] |
| `args.users` | `Address`[] |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### updatePrice()

> **updatePrice**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L54)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### updatePriceDVT()

> **updatePriceDVT**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L55)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `price`: `bigint`; `proof`: [`Hex`](https://viem.sh/docs/index.html); `updatedAt`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.price` | `bigint` |
| `args.proof` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.updatedAt` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### updateReputation()

> **updateReputation**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L44)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newScore`: `bigint`; `operator`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newScore` | `bigint` |
| `args.operator` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### updateSBTStatus()

> **updateSBTStatus**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L50)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `status`: `boolean`; `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.status` | `boolean` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### userOpState()

> **userOpState**: (`args`) => `Promise`\<\{ `isBlocked`: `boolean`; `lastTimestamp`: `number`; \}\>

Defined in: [packages/core/src/actions/superPaymaster.ts:79](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L79)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `operator`: `Address`; `user`: `Address`; \} |
| `args.operator` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<\{ `isBlocked`: `boolean`; `lastTimestamp`: `number`; \}\>

***

### validatePaymasterUserOp()

> **validatePaymasterUserOp**: (`args`) => `Promise`\<\{ `context`: [`Hex`](https://viem.sh/docs/index.html); `validationData`: `bigint`; \}\>

Defined in: [packages/core/src/actions/superPaymaster.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L69)

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

### VALIDATION\_BUFFER\_BPS()

> **VALIDATION\_BUFFER\_BPS**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:102](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L102)

#### Returns

`Promise`\<`bigint`\>

***

### version()

> **version**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:111](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L111)

#### Returns

`Promise`\<`string`\>

***

### withdraw()

> **withdraw**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L33)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amount`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amount` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### withdrawProtocolRevenue()

> **withdrawProtocolRevenue**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L63)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amount`: `bigint`; `to`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amount` | `bigint` |
| `args.to` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### withdrawStake()

> **withdrawStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L38)

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

Defined in: [packages/core/src/actions/superPaymaster.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L32)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amount`: `bigint`; `to`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amount` | `bigint` |
| `args.to` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### xpntsFactory()

> **xpntsFactory**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:94](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/superPaymaster.ts#L94)

#### Returns

`Promise`\<`Address`\>
