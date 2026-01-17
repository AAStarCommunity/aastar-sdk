> **SuperPaymasterActions** = `object`

Defined in: [packages/core/src/actions/superPaymaster.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L6)

## Properties

### addSuperStake()

> **addSuperStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L14)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### APNTS\_TOKEN()

> **APNTS\_TOKEN**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L82)

#### Returns

`Promise`\<`Address`\>

***

### aPNTsPriceUSD()

> **aPNTsPriceUSD**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L45)

#### Returns

`Promise`\<`bigint`\>

***

### balanceOfOperator()

> **balanceOfOperator**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L44)

#### Parameters

##### args

###### operator

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### blockedUsers()

> **blockedUsers**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L43)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### blockUser()

> **blockUser**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L32)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### blocked

`boolean`

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### BLS\_AGGREGATOR()

> **BLS\_AGGREGATOR**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L84)

#### Returns

`Promise`\<`Address`\>

***

### BPS\_DENOMINATOR()

> **BPS\_DENOMINATOR**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:88](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L88)

#### Returns

`Promise`\<`bigint`\>

***

### cachedPrice()

> **cachedPrice**: () => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L46)

#### Returns

`Promise`\<`any`\>

***

### configureOperator()

> **configureOperator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L19)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### exchangeRate

`bigint`

###### treasury

`Address`

###### xPNTsToken

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### deposit()

> **deposit**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L8)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### ~~depositAPNTs()~~

> **depositAPNTs**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L10)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

Use depositAPNTs for clarity

***

### depositETH()

> **depositETH**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L11)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### value

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### depositForOperator()

> **depositForOperator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L12)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

###### operator

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### entryPoint()

> **entryPoint**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L52)

#### Returns

`Promise`\<`Address`\>

***

### ETH\_USD\_PRICE\_FEED()

> **ETH\_USD\_PRICE\_FEED**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:85](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L85)

#### Returns

`Promise`\<`Address`\>

***

### executeSlashWithBLS()

> **executeSlashWithBLS**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L23)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

###### blsSignature

[`Hex`](https://viem.sh/docs/index.html)

###### operator

`Address`

###### reason

`string`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### getAvailableCredit()

> **getAvailableCredit**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L42)

#### Parameters

##### args

###### operator

`Address`

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### getDeposit()

> **getDeposit**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L41)

#### Returns

`Promise`\<`bigint`\>

***

### getLatestSlash()

> **getLatestSlash**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L59)

#### Parameters

##### args

###### operator

`Address`

#### Returns

`Promise`\<`any`\>

***

### getSlashCount()

> **getSlashCount**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L58)

#### Parameters

##### args

###### operator

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### getSlashHistory()

> **getSlashHistory**: (`args`) => `Promise`\<`any`[]\>

Defined in: [packages/core/src/actions/superPaymaster.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L57)

#### Parameters

##### args

###### operator

`Address`

#### Returns

`Promise`\<`any`[]\>

***

### lastUserOpTimestamp()

> **lastUserOpTimestamp**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L54)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### MAX\_ETH\_USD\_PRICE()

> **MAX\_ETH\_USD\_PRICE**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:91](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L91)

#### Returns

`Promise`\<`bigint`\>

***

### MIN\_ETH\_USD\_PRICE()

> **MIN\_ETH\_USD\_PRICE**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:92](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L92)

#### Returns

`Promise`\<`bigint`\>

***

### onTransferReceived()

> **onTransferReceived**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L76)

#### Parameters

##### args

###### amount

`bigint`

###### data

[`Hex`](https://viem.sh/docs/index.html)

###### from

`Address`

#### Returns

`Promise`\<`any`\>

***

### operators()

> **operators**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L40)

#### Parameters

##### args

###### operator

`Address`

#### Returns

`Promise`\<`any`\>

***

### owner()

> **owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:96](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L96)

#### Returns

`Promise`\<`Address`\>

***

### PAYMASTER\_DATA\_OFFSET()

> **PAYMASTER\_DATA\_OFFSET**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:86](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L86)

#### Returns

`Promise`\<`bigint`\>

***

### postOp()

> **postOp**: (`args`) => `Promise`\<`void`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L37)

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

### PRICE\_CACHE\_DURATION()

> **PRICE\_CACHE\_DURATION**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L89)

#### Returns

`Promise`\<`bigint`\>

***

### PRICE\_STALENESS\_THRESHOLD()

> **PRICE\_STALENESS\_THRESHOLD**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:90](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L90)

#### Returns

`Promise`\<`bigint`\>

***

### protocolFee()

> **protocolFee**: () => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L47)

#### Returns

`Promise`\<`any`\>

***

### protocolFeeBPS()

> **protocolFeeBPS**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L48)

#### Returns

`Promise`\<`bigint`\>

***

### protocolRevenue()

> **protocolRevenue**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L49)

#### Returns

`Promise`\<`bigint`\>

***

### RATE\_OFFSET()

> **RATE\_OFFSET**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:87](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L87)

#### Returns

`Promise`\<`bigint`\>

***

### REGISTRY()

> **REGISTRY**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L83)

#### Returns

`Promise`\<`Address`\>

***

### renounceOwnership()

> **renounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:97](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L97)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setAPNTsPrice()

> **setAPNTsPrice**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L27)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### priceUSD

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setAPNTsToken()

> **setAPNTsToken**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:72](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L72)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setBLSAggregator()

> **setBLSAggregator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L73)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### aggregator

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setCachedPrice()

> **setCachedPrice**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L28)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### price

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setOperatorLimits()

> **setOperatorLimits**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L21)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### limits

`any`

###### operator

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setOperatorPaused()

> **setOperatorPaused**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L20)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### operator

`Address`

###### paused

`boolean`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setProtocolFee()

> **setProtocolFee**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L29)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### feeBps

`bigint`

###### feeRecipient

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setTreasury()

> **setTreasury**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L67)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### treasury

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setXPNTsFactory()

> **setXPNTsFactory**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L71)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### factory

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### slashHistory()

> **slashHistory**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L60)

#### Parameters

##### args

###### index

`bigint`

###### operator

`Address`

#### Returns

`Promise`\<`any`\>

***

### slashOperator()

> **slashOperator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L24)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

###### operator

`Address`

###### reason

`string`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### totalTrackedBalance()

> **totalTrackedBalance**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:53](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L53)

#### Returns

`Promise`\<`bigint`\>

***

### transferOwnership()

> **transferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:95](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L95)

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

Defined in: [packages/core/src/actions/superPaymaster.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L50)

#### Returns

`Promise`\<`Address`\>

***

### unlockSuperStake()

> **unlockSuperStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L15)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### updateBlockedStatus()

> **updateBlockedStatus**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L33)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### blocked

`boolean`

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### updatePrice()

> **updatePrice**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L63)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### updatePriceDVT()

> **updatePriceDVT**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:64](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L64)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### price

`bigint`

###### proof

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### updateReputation()

> **updateReputation**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L22)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### newReputation

`bigint`

###### operator

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### validatePaymasterUserOp()

> **validatePaymasterUserOp**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L36)

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

Defined in: [packages/core/src/actions/superPaymaster.ts:100](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L100)

#### Returns

`Promise`\<`string`\>

***

### withdrawAPNTs()

> **withdrawAPNTs**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:79](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L79)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### withdrawProtocolRevenue()

> **withdrawProtocolRevenue**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:68](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L68)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### to

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### withdrawStake()

> **withdrawStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L16)

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

Defined in: [packages/core/src/actions/superPaymaster.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L13)

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

***

### xpntsFactory()

> **xpntsFactory**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/superPaymaster.ts#L51)

#### Returns

`Promise`\<`Address`\>
