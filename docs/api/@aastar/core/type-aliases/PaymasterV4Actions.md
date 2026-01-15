```ts
type PaymasterV4Actions = object;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L5)

## Properties

### paymasterV4AddDeposit()

```ts
paymasterV4AddDeposit: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L67)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### ~~paymasterV4AddGasToken()~~

```ts
paymasterV4AddGasToken: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L18)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `priceFeed`: `Address`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.priceFeed` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

#### Deprecated

V4 uses depositFor + tokenPrices instead

***

### ~~paymasterV4AddSBT()~~

```ts
paymasterV4AddSBT: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L26)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `sbt`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.sbt` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

#### Deprecated

V4 does not use SBT whitelist

***

### paymasterV4AddStake()

```ts
paymasterV4AddStake: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L41)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `amount`: `bigint`; `unstakeDelaySec`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.amount` | `bigint` |
| `args.unstakeDelaySec` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### paymasterV4Balances()

```ts
paymasterV4Balances: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L10)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; `user`: `Address`; \} |
| `args.token` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4CachedPriceView()

```ts
paymasterV4CachedPriceView: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:79](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L79)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4CalculateCost()

```ts
paymasterV4CalculateCost: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L75)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `gasCost`: `bigint`; `param`: `any`; `token`: `Address`; \} |
| `args.gasCost` | `bigint` |
| `args.param` | `any` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4DeactivateFromRegistry()

```ts
paymasterV4DeactivateFromRegistry: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:88](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L88)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### paymasterV4Deposit()

```ts
paymasterV4Deposit: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L39)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### paymasterV4DepositFor()

```ts
paymasterV4DepositFor: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L8)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `amount`: `bigint`; `token`: `Address`; `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.amount` | `bigint` |
| `args.token` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### paymasterV4EntryPoint()

```ts
paymasterV4EntryPoint: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L47)

#### Returns

`Promise`\<`Address`\>

***

### paymasterV4EthUsdPriceFeed()

```ts
paymasterV4EthUsdPriceFeed: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L71)

#### Returns

`Promise`\<`Address`\>

***

### paymasterV4GetDeposit()

```ts
paymasterV4GetDeposit: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L44)

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4GetRealtimeTokenCost()

```ts
paymasterV4GetRealtimeTokenCost: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L76)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `gasCost`: `bigint`; `token`: `Address`; \} |
| `args.gasCost` | `bigint` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### ~~paymasterV4GetSupportedGasTokens()~~

```ts
paymasterV4GetSupportedGasTokens: () => Promise<Address[]>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L22)

#### Returns

`Promise`\<`Address`[]\>

#### Deprecated

V4 uses depositFor + tokenPrices instead

***

### ~~paymasterV4GetSupportedSBTs()~~

```ts
paymasterV4GetSupportedSBTs: () => Promise<Address[]>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L30)

#### Returns

`Promise`\<`Address`[]\>

#### Deprecated

V4 does not use SBT whitelist

***

### paymasterV4Initialize()

```ts
paymasterV4Initialize: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L89)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `owner`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.owner` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### paymasterV4IsActiveInRegistry()

```ts
paymasterV4IsActiveInRegistry: () => Promise<boolean>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:77](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L77)

#### Returns

`Promise`\<`boolean`\>

***

### ~~paymasterV4IsGasTokenSupported()~~

```ts
paymasterV4IsGasTokenSupported: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L24)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`boolean`\>

#### Deprecated

V4 uses depositFor + tokenPrices instead

***

### paymasterV4IsRegistrySet()

```ts
paymasterV4IsRegistrySet: () => Promise<boolean>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:78](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L78)

#### Returns

`Promise`\<`boolean`\>

***

### ~~paymasterV4IsSBTSupported()~~

```ts
paymasterV4IsSBTSupported: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L32)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `sbt`: `Address`; \} |
| `args.sbt` | `Address` |

#### Returns

`Promise`\<`boolean`\>

#### Deprecated

V4 does not use SBT whitelist

***

### paymasterV4MaxEthUsdPrice()

```ts
paymasterV4MaxEthUsdPrice: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L59)

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4MaxGasCostCap()

```ts
paymasterV4MaxGasCostCap: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L58)

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4MaxGasTokens()

```ts
paymasterV4MaxGasTokens: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L60)

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4MaxSbts()

```ts
paymasterV4MaxSbts: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L61)

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4MaxServiceFee()

```ts
paymasterV4MaxServiceFee: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L62)

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4MinEthUsdPrice()

```ts
paymasterV4MinEthUsdPrice: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L63)

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4OracleDecimals()

```ts
paymasterV4OracleDecimals: () => Promise<number>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:72](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L72)

#### Returns

`Promise`\<`number`\>

***

### paymasterV4Owner()

```ts
paymasterV4Owner: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L50)

#### Returns

`Promise`\<`Address`\>

***

### paymasterV4Paused()

```ts
paymasterV4Paused: () => Promise<boolean>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L57)

#### Returns

`Promise`\<`boolean`\>

***

### paymasterV4PostOp()

```ts
paymasterV4PostOp: (args) => Promise<void>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L36)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `actualGasCost`: `bigint`; `actualUserOpFeePerGas`: `bigint`; `context`: [`Hex`](https://viem.sh/docs/); `mode`: `number`; \} |
| `args.actualGasCost` | `bigint` |
| `args.actualUserOpFeePerGas` | `bigint` |
| `args.context` | [`Hex`](https://viem.sh/docs/) |
| `args.mode` | `number` |

#### Returns

`Promise`\<`void`\>

***

### paymasterV4PriceStalenessThreshold()

```ts
paymasterV4PriceStalenessThreshold: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:64](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L64)

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4Registry()

```ts
paymasterV4Registry: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L55)

#### Returns

`Promise`\<`Address`\>

***

### ~~paymasterV4RemoveGasToken()~~

```ts
paymasterV4RemoveGasToken: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L20)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

#### Deprecated

V4 uses depositFor + tokenPrices instead

***

### ~~paymasterV4RemoveSBT()~~

```ts
paymasterV4RemoveSBT: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L28)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `sbt`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.sbt` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

#### Deprecated

V4 does not use SBT whitelist

***

### paymasterV4RenounceOwnership()

```ts
paymasterV4RenounceOwnership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L52)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### paymasterV4ServiceFeeRate()

```ts
paymasterV4ServiceFeeRate: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L74)

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4SetCachedPrice()

```ts
paymasterV4SetCachedPrice: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L82)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `price`: `bigint`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.price` | `bigint` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### paymasterV4SetMaxGasCostCap()

```ts
paymasterV4SetMaxGasCostCap: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L84)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `cap`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.cap` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### paymasterV4SetPriceStalenessThreshold()

```ts
paymasterV4SetPriceStalenessThreshold: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:85](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L85)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `threshold`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.threshold` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### paymasterV4SetServiceFeeRate()

```ts
paymasterV4SetServiceFeeRate: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L83)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `rate`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.rate` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### paymasterV4SetTokenPrice()

```ts
paymasterV4SetTokenPrice: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L13)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `price`: `bigint`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.price` | `bigint` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### paymasterV4SetTreasury()

```ts
paymasterV4SetTreasury: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:86](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L86)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `treasury`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.treasury` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### paymasterV4TokenDecimals()

```ts
paymasterV4TokenDecimals: (args) => Promise<number>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L73)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`number`\>

***

### paymasterV4TokenPrices()

```ts
paymasterV4TokenPrices: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L14)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### paymasterV4TransferOwnership()

```ts
paymasterV4TransferOwnership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L51)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `newOwner`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.newOwner` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### paymasterV4Treasury()

```ts
paymasterV4Treasury: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L56)

#### Returns

`Promise`\<`Address`\>

***

### paymasterV4UnlockPaymasterStake()

```ts
paymasterV4UnlockPaymasterStake: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L42)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### paymasterV4UnlockStake()

```ts
paymasterV4UnlockStake: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:68](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L68)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### paymasterV4UpdatePrice()

```ts
paymasterV4UpdatePrice: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:87](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L87)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### paymasterV4ValidatePaymasterUserOp()

```ts
paymasterV4ValidatePaymasterUserOp: (args) => Promise<any>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L35)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `maxCost`: `bigint`; `userOp`: `any`; `userOpHash`: [`Hex`](https://viem.sh/docs/); \} |
| `args.maxCost` | `bigint` |
| `args.userOp` | `any` |
| `args.userOpHash` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<`any`\>

***

### paymasterV4Version()

```ts
paymasterV4Version: () => Promise<string>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:91](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L91)

#### Returns

`Promise`\<`string`\>

***

### paymasterV4Withdraw()

```ts
paymasterV4Withdraw: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L9)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `amount`: `bigint`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.amount` | `bigint` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### paymasterV4WithdrawStake()

```ts
paymasterV4WithdrawStake: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L43)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `to`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.to` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### paymasterV4WithdrawTo()

```ts
paymasterV4WithdrawTo: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/paymasterV4.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/paymasterV4.ts#L40)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `amount`: `bigint`; `to`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.amount` | `bigint` |
| `args.to` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>
