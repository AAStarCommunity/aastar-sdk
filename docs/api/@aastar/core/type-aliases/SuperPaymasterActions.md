```ts
type SuperPaymasterActions = object;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L4)

## Properties

### renounceSuperPaymasterOwnership()

```ts
renounceSuperPaymasterOwnership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:95](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L95)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; \} |
| `args.account?` | `Account` \| `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterAddStake()

```ts
superPaymasterAddStake: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:98](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L98)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterAddSuperStake()

```ts
superPaymasterAddSuperStake: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L12)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterAPNTS\_TOKEN()

```ts
superPaymasterAPNTS_TOKEN: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:80](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L80)

#### Returns

`Promise`\<`Address`\>

***

### superPaymasterAPNTsPriceUSD()

```ts
superPaymasterAPNTsPriceUSD: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L43)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterBalanceOfOperator()

```ts
superPaymasterBalanceOfOperator: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L42)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `operator`: `Address`; \} |
| `args.operator` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterBlockedUsers()

```ts
superPaymasterBlockedUsers: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L41)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### superPaymasterBlockUser()

```ts
superPaymasterBlockUser: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L30)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `blocked`: `boolean`; `user`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.blocked` | `boolean` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterBLS\_AGGREGATOR()

```ts
superPaymasterBLS_AGGREGATOR: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L82)

#### Returns

`Promise`\<`Address`\>

***

### superPaymasterBPS\_DENOMINATOR()

```ts
superPaymasterBPS_DENOMINATOR: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:86](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L86)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterCachedPrice()

```ts
superPaymasterCachedPrice: () => Promise<any>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L44)

#### Returns

`Promise`\<`any`\>

***

### superPaymasterConfigureOperator()

```ts
superPaymasterConfigureOperator: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L17)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `exchangeRate`: `bigint`; `treasury`: `Address`; `xPNTsToken`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.exchangeRate` | `bigint` |
| `args.treasury` | `Address` |
| `args.xPNTsToken` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterDeposit()

```ts
superPaymasterDeposit: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L6)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |

#### Returns

`Promise`\<`Hash`\>

***

### ~~superPaymasterDepositAPNTs()~~

```ts
superPaymasterDepositAPNTs: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L8)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |

#### Returns

`Promise`\<`Hash`\>

#### Deprecated

Use superPaymasterDeposit for clarity

***

### superPaymasterDepositETH()

```ts
superPaymasterDepositETH: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L9)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `value`: `bigint`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.value` | `bigint` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterDepositFor()

```ts
superPaymasterDepositFor: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L10)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; `operator`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |
| `args.operator` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterDepositForAlias()

```ts
superPaymasterDepositForAlias: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:99](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L99)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; `operator`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |
| `args.operator` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterEntryPoint()

```ts
superPaymasterEntryPoint: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L50)

#### Returns

`Promise`\<`Address`\>

***

### superPaymasterETH\_USD\_PRICE\_FEED()

```ts
superPaymasterETH_USD_PRICE_FEED: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L83)

#### Returns

`Promise`\<`Address`\>

***

### superPaymasterExecuteSlashWithBLS()

```ts
superPaymasterExecuteSlashWithBLS: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L21)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; `blsSignature`: `Hex`; `operator`: `Address`; `reason`: `string`; `roleId`: `Hex`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |
| `args.blsSignature` | `Hex` |
| `args.operator` | `Address` |
| `args.reason` | `string` |
| `args.roleId` | `Hex` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterGetAvailableCredit()

```ts
superPaymasterGetAvailableCredit: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L40)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `operator`: `Address`; `user`: `Address`; \} |
| `args.operator` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterGetDeposit()

```ts
superPaymasterGetDeposit: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L39)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterGetLatestSlash()

```ts
superPaymasterGetLatestSlash: (args) => Promise<any>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L57)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `operator`: `Address`; \} |
| `args.operator` | `Address` |

#### Returns

`Promise`\<`any`\>

***

### superPaymasterGetSlashCount()

```ts
superPaymasterGetSlashCount: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L56)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `operator`: `Address`; \} |
| `args.operator` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterGetSlashHistory()

```ts
superPaymasterGetSlashHistory: (args) => Promise<any[]>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L55)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `operator`: `Address`; \} |
| `args.operator` | `Address` |

#### Returns

`Promise`\<`any`[]\>

***

### superPaymasterLastUserOpTimestamp()

```ts
superPaymasterLastUserOpTimestamp: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L52)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterMAX\_ETH\_USD\_PRICE()

```ts
superPaymasterMAX_ETH_USD_PRICE: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L89)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterMAX\_PROTOCOL\_FEE()

```ts
superPaymasterMAX_PROTOCOL_FEE: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:105](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L105)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterMIN\_ETH\_USD\_PRICE()

```ts
superPaymasterMIN_ETH_USD_PRICE: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:90](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L90)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterOnTransferReceived()

```ts
superPaymasterOnTransferReceived: (args) => Promise<any>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L74)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `amount`: `bigint`; `data`: `Hex`; `from`: `Address`; \} |
| `args.amount` | `bigint` |
| `args.data` | `Hex` |
| `args.from` | `Address` |

#### Returns

`Promise`\<`any`\>

***

### superPaymasterOperators()

```ts
superPaymasterOperators: (args) => Promise<any>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L38)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `operator`: `Address`; \} |
| `args.operator` | `Address` |

#### Returns

`Promise`\<`any`\>

***

### superPaymasterOwner()

```ts
superPaymasterOwner: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:94](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L94)

#### Returns

`Promise`\<`Address`\>

***

### superPaymasterPAYMASTER\_DATA\_OFFSET()

```ts
superPaymasterPAYMASTER_DATA_OFFSET: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L84)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterPostOp()

```ts
superPaymasterPostOp: (args) => Promise<void>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L35)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `actualGasCost`: `bigint`; `actualUserOpFeePerGas`: `bigint`; `context`: `Hex`; `mode`: `number`; \} |
| `args.actualGasCost` | `bigint` |
| `args.actualUserOpFeePerGas` | `bigint` |
| `args.context` | `Hex` |
| `args.mode` | `number` |

#### Returns

`Promise`\<`void`\>

***

### superPaymasterPRICE\_CACHE\_DURATION()

```ts
superPaymasterPRICE_CACHE_DURATION: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:87](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L87)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterPRICE\_STALENESS\_THRESHOLD()

```ts
superPaymasterPRICE_STALENESS_THRESHOLD: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:88](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L88)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterPriceStalenessThreshold()

```ts
superPaymasterPriceStalenessThreshold: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:107](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L107)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterProtocolFee()

```ts
superPaymasterProtocolFee: () => Promise<any>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L45)

#### Returns

`Promise`\<`any`\>

***

### superPaymasterProtocolFeeBPS()

```ts
superPaymasterProtocolFeeBPS: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L46)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterProtocolRevenue()

```ts
superPaymasterProtocolRevenue: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L47)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterRATE\_OFFSET()

```ts
superPaymasterRATE_OFFSET: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:85](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L85)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterREGISTRY()

```ts
superPaymasterREGISTRY: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:81](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L81)

#### Returns

`Promise`\<`Address`\>

***

### superPaymasterSbtHolders()

```ts
superPaymasterSbtHolders: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:108](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L108)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### superPaymasterSetAPNTsPrice()

```ts
superPaymasterSetAPNTsPrice: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L25)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `priceUSD`: `bigint`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.priceUSD` | `bigint` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterSetAPNTsToken()

```ts
superPaymasterSetAPNTsToken: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:70](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L70)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `token`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterSetBLSAggregator()

```ts
superPaymasterSetBLSAggregator: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L71)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `aggregator`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.aggregator` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterSetCachedPrice()

```ts
superPaymasterSetCachedPrice: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L26)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `price`: `bigint`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.price` | `bigint` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterSetOperatorLimits()

```ts
superPaymasterSetOperatorLimits: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L19)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `limits`: `any`; `operator`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.limits` | `any` |
| `args.operator` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterSetOperatorPaused()

```ts
superPaymasterSetOperatorPaused: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L18)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `operator`: `Address`; `paused`: `boolean`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.operator` | `Address` |
| `args.paused` | `boolean` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterSetProtocolFee()

```ts
superPaymasterSetProtocolFee: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L27)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `feeBps`: `bigint`; `feeRecipient`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.feeBps` | `bigint` |
| `args.feeRecipient` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterSetTreasury()

```ts
superPaymasterSetTreasury: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L65)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `treasury`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.treasury` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterSetXPNTsFactory()

```ts
superPaymasterSetXPNTsFactory: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L69)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `factory`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.factory` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterSlashHistory()

```ts
superPaymasterSlashHistory: (args) => Promise<any>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L58)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `index`: `bigint`; `operator`: `Address`; \} |
| `args.index` | `bigint` |
| `args.operator` | `Address` |

#### Returns

`Promise`\<`any`\>

***

### superPaymasterSlashOperator()

```ts
superPaymasterSlashOperator: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L22)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; `operator`: `Address`; `reason`: `string`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |
| `args.operator` | `Address` |
| `args.reason` | `string` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterTotalTrackedBalance()

```ts
superPaymasterTotalTrackedBalance: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L51)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterTreasury()

```ts
superPaymasterTreasury: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L48)

#### Returns

`Promise`\<`Address`\>

***

### superPaymasterUnlockStake()

```ts
superPaymasterUnlockStake: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:100](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L100)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; \} |
| `args.account?` | `Account` \| `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterUnlockSuperStake()

```ts
superPaymasterUnlockSuperStake: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L13)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; \} |
| `args.account?` | `Account` \| `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterUpdateBlockedStatus()

```ts
superPaymasterUpdateBlockedStatus: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L31)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `blocked`: `boolean`; `user`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.blocked` | `boolean` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterUpdatePrice()

```ts
superPaymasterUpdatePrice: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L61)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; \} |
| `args.account?` | `Account` \| `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterUpdatePriceDVT()

```ts
superPaymasterUpdatePriceDVT: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L62)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `price`: `bigint`; `proof`: `Hex`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.price` | `bigint` |
| `args.proof` | `Hex` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterUpdateReputation()

```ts
superPaymasterUpdateReputation: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L20)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `newReputation`: `bigint`; `operator`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.newReputation` | `bigint` |
| `args.operator` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterUpdateSBTStatus()

```ts
superPaymasterUpdateSBTStatus: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:110](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L110)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `hasSBT`: `boolean`; `user`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.hasSBT` | `boolean` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterUserOpState()

```ts
superPaymasterUserOpState: (args) => Promise<any>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:109](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L109)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `userOpHash`: `Hex`; \} |
| `args.userOpHash` | `Hex` |

#### Returns

`Promise`\<`any`\>

***

### superPaymasterValidatePaymasterUserOp()

```ts
superPaymasterValidatePaymasterUserOp: (args) => Promise<any>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L34)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `maxCost`: `bigint`; `userOp`: `any`; `userOpHash`: `Hex`; \} |
| `args.maxCost` | `bigint` |
| `args.userOp` | `any` |
| `args.userOpHash` | `Hex` |

#### Returns

`Promise`\<`any`\>

***

### superPaymasterVALIDATION\_BUFFER\_BPS()

```ts
superPaymasterVALIDATION_BUFFER_BPS: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:106](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L106)

#### Returns

`Promise`\<`bigint`\>

***

### superPaymasterVersion()

```ts
superPaymasterVersion: () => Promise<string>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:112](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L112)

#### Returns

`Promise`\<`string`\>

***

### superPaymasterWithdraw()

```ts
superPaymasterWithdraw: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:101](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L101)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterWithdrawAlias()

```ts
superPaymasterWithdrawAlias: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:102](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L102)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterWithdrawAPNTs()

```ts
superPaymasterWithdrawAPNTs: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:77](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L77)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterWithdrawProtocolRevenue()

```ts
superPaymasterWithdrawProtocolRevenue: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L66)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `to`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.to` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterWithdrawStake()

```ts
superPaymasterWithdrawStake: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L14)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `to`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.to` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterWithdrawTo()

```ts
superPaymasterWithdrawTo: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L11)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; `to`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |
| `args.to` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### superPaymasterXpntsFactory()

```ts
superPaymasterXpntsFactory: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L49)

#### Returns

`Promise`\<`Address`\>

***

### transferSuperPaymasterOwnership()

```ts
transferSuperPaymasterOwnership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/superPaymaster.ts:93](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/actions/superPaymaster.ts#L93)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `newOwner`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.newOwner` | `Address` |

#### Returns

`Promise`\<`Hash`\>
