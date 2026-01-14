> **SuperPaymasterActions** = `object`

Defined in: [packages/core/src/actions/superPaymaster.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L4)

## Properties

### renounceSuperPaymasterOwnership()

> **renounceSuperPaymasterOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:95](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L95)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### superPaymasterAddStake()

> **superPaymasterAddStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:98](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L98)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### superPaymasterAddSuperStake()

> **superPaymasterAddSuperStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L12)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### superPaymasterAPNTS\_TOKEN()

> **superPaymasterAPNTS\_TOKEN**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:80](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L80)

#### Returns

`Promise`\<`Address`\>

***

### superPaymasterAPNTsPriceUSD()

> **superPaymasterAPNTsPriceUSD**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L43)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterBalanceOfOperator()

> **superPaymasterBalanceOfOperator**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L42)

#### Parameters

##### args

###### operator

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterBlockedUsers()

> **superPaymasterBlockedUsers**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L41)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### superPaymasterBlockUser()

> **superPaymasterBlockUser**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L30)

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

### superPaymasterBLS\_AGGREGATOR()

> **superPaymasterBLS\_AGGREGATOR**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L82)

#### Returns

`Promise`\<`Address`\>

***

### superPaymasterBPS\_DENOMINATOR()

> **superPaymasterBPS\_DENOMINATOR**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:86](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L86)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterCachedPrice()

> **superPaymasterCachedPrice**: () => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L44)

#### Returns

`Promise`\<`any`\>

***

### superPaymasterConfigureOperator()

> **superPaymasterConfigureOperator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L17)

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

### superPaymasterDeposit()

> **superPaymasterDeposit**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L6)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### ~~superPaymasterDepositAPNTs()~~

> **superPaymasterDepositAPNTs**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L8)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

Use superPaymasterDeposit for clarity

***

### superPaymasterDepositETH()

> **superPaymasterDepositETH**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L9)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### value

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### superPaymasterDepositFor()

> **superPaymasterDepositFor**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L10)

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

### superPaymasterDepositForAlias()

> **superPaymasterDepositForAlias**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:99](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L99)

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

### superPaymasterEntryPoint()

> **superPaymasterEntryPoint**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L50)

#### Returns

`Promise`\<`Address`\>

***

### superPaymasterETH\_USD\_PRICE\_FEED()

> **superPaymasterETH\_USD\_PRICE\_FEED**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L83)

#### Returns

`Promise`\<`Address`\>

***

### superPaymasterExecuteSlashWithBLS()

> **superPaymasterExecuteSlashWithBLS**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L21)

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

### superPaymasterGetAvailableCredit()

> **superPaymasterGetAvailableCredit**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L40)

#### Parameters

##### args

###### operator

`Address`

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterGetDeposit()

> **superPaymasterGetDeposit**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L39)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterGetLatestSlash()

> **superPaymasterGetLatestSlash**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L57)

#### Parameters

##### args

###### operator

`Address`

#### Returns

`Promise`\<`any`\>

***

### superPaymasterGetSlashCount()

> **superPaymasterGetSlashCount**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L56)

#### Parameters

##### args

###### operator

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterGetSlashHistory()

> **superPaymasterGetSlashHistory**: (`args`) => `Promise`\<`any`[]\>

Defined in: [packages/core/src/actions/superPaymaster.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L55)

#### Parameters

##### args

###### operator

`Address`

#### Returns

`Promise`\<`any`[]\>

***

### superPaymasterLastUserOpTimestamp()

> **superPaymasterLastUserOpTimestamp**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L52)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterMAX\_ETH\_USD\_PRICE()

> **superPaymasterMAX\_ETH\_USD\_PRICE**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L89)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterMAX\_PROTOCOL\_FEE()

> **superPaymasterMAX\_PROTOCOL\_FEE**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:105](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L105)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterMIN\_ETH\_USD\_PRICE()

> **superPaymasterMIN\_ETH\_USD\_PRICE**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:90](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L90)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterOnTransferReceived()

> **superPaymasterOnTransferReceived**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L74)

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

### superPaymasterOperators()

> **superPaymasterOperators**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L38)

#### Parameters

##### args

###### operator

`Address`

#### Returns

`Promise`\<`any`\>

***

### superPaymasterOwner()

> **superPaymasterOwner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:94](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L94)

#### Returns

`Promise`\<`Address`\>

***

### superPaymasterPAYMASTER\_DATA\_OFFSET()

> **superPaymasterPAYMASTER\_DATA\_OFFSET**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L84)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterPostOp()

> **superPaymasterPostOp**: (`args`) => `Promise`\<`void`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L35)

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

### superPaymasterPRICE\_CACHE\_DURATION()

> **superPaymasterPRICE\_CACHE\_DURATION**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:87](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L87)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterPRICE\_STALENESS\_THRESHOLD()

> **superPaymasterPRICE\_STALENESS\_THRESHOLD**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:88](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L88)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterPriceStalenessThreshold()

> **superPaymasterPriceStalenessThreshold**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:107](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L107)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterProtocolFee()

> **superPaymasterProtocolFee**: () => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L45)

#### Returns

`Promise`\<`any`\>

***

### superPaymasterProtocolFeeBPS()

> **superPaymasterProtocolFeeBPS**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L46)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterProtocolRevenue()

> **superPaymasterProtocolRevenue**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L47)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterRATE\_OFFSET()

> **superPaymasterRATE\_OFFSET**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:85](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L85)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterREGISTRY()

> **superPaymasterREGISTRY**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:81](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L81)

#### Returns

`Promise`\<`Address`\>

***

### superPaymasterSbtHolders()

> **superPaymasterSbtHolders**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:108](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L108)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### superPaymasterSetAPNTsPrice()

> **superPaymasterSetAPNTsPrice**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L25)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### priceUSD

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### superPaymasterSetAPNTsToken()

> **superPaymasterSetAPNTsToken**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:70](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L70)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### superPaymasterSetBLSAggregator()

> **superPaymasterSetBLSAggregator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L71)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### aggregator

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### superPaymasterSetCachedPrice()

> **superPaymasterSetCachedPrice**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L26)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### price

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### superPaymasterSetOperatorLimits()

> **superPaymasterSetOperatorLimits**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L19)

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

### superPaymasterSetOperatorPaused()

> **superPaymasterSetOperatorPaused**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L18)

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

### superPaymasterSetProtocolFee()

> **superPaymasterSetProtocolFee**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L27)

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

### superPaymasterSetTreasury()

> **superPaymasterSetTreasury**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L65)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### treasury

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### superPaymasterSetXPNTsFactory()

> **superPaymasterSetXPNTsFactory**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L69)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### factory

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### superPaymasterSlashHistory()

> **superPaymasterSlashHistory**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L58)

#### Parameters

##### args

###### index

`bigint`

###### operator

`Address`

#### Returns

`Promise`\<`any`\>

***

### superPaymasterSlashOperator()

> **superPaymasterSlashOperator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L22)

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

### superPaymasterTotalTrackedBalance()

> **superPaymasterTotalTrackedBalance**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L51)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterTreasury()

> **superPaymasterTreasury**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L48)

#### Returns

`Promise`\<`Address`\>

***

### superPaymasterUnlockStake()

> **superPaymasterUnlockStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:100](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L100)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### superPaymasterUnlockSuperStake()

> **superPaymasterUnlockSuperStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L13)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### superPaymasterUpdateBlockedStatus()

> **superPaymasterUpdateBlockedStatus**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L31)

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

### superPaymasterUpdatePrice()

> **superPaymasterUpdatePrice**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L61)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### superPaymasterUpdatePriceDVT()

> **superPaymasterUpdatePriceDVT**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L62)

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

### superPaymasterUpdateReputation()

> **superPaymasterUpdateReputation**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L20)

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

### superPaymasterUpdateSBTStatus()

> **superPaymasterUpdateSBTStatus**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:110](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L110)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### hasSBT

`boolean`

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### superPaymasterUserOpState()

> **superPaymasterUserOpState**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:109](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L109)

#### Parameters

##### args

###### userOpHash

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`any`\>

***

### superPaymasterValidatePaymasterUserOp()

> **superPaymasterValidatePaymasterUserOp**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L34)

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

### superPaymasterVALIDATION\_BUFFER\_BPS()

> **superPaymasterVALIDATION\_BUFFER\_BPS**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:106](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L106)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterVersion()

> **superPaymasterVersion**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:112](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L112)

#### Returns

`Promise`\<`string`\>

***

### superPaymasterWithdraw()

> **superPaymasterWithdraw**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:101](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L101)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### superPaymasterWithdrawAlias()

> **superPaymasterWithdrawAlias**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:102](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L102)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### superPaymasterWithdrawAPNTs()

> **superPaymasterWithdrawAPNTs**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:77](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L77)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### superPaymasterWithdrawProtocolRevenue()

> **superPaymasterWithdrawProtocolRevenue**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L66)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### to

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### superPaymasterWithdrawStake()

> **superPaymasterWithdrawStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L14)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### to

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### superPaymasterWithdrawTo()

> **superPaymasterWithdrawTo**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L11)

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

### superPaymasterXpntsFactory()

> **superPaymasterXpntsFactory**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L49)

#### Returns

`Promise`\<`Address`\>

***

### transferSuperPaymasterOwnership()

> **transferSuperPaymasterOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:93](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/superPaymaster.ts#L93)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### newOwner

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>
