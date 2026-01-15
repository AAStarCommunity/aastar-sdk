```ts
type XPNTsFactoryActions = object;
```

Defined in: [packages/core/src/actions/factory.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L5)

## Properties

### aPNTsPriceUSD()

```ts
aPNTsPriceUSD: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/factory.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L44)

#### Returns

`Promise`\<`bigint`\>

***

### communityToToken()

```ts
communityToToken: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/factory.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L18)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; \} |
| `args.community` | `Address` |

#### Returns

`Promise`\<`Address`\>

***

### createToken()

```ts
createToken: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/factory.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L7)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `community`: `Address`; `name`: `string`; `symbol`: `string`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.community` | `Address` |
| `args.name` | `string` |
| `args.symbol` | `string` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### DEFAULT\_SAFETY\_FACTOR()

```ts
DEFAULT_SAFETY_FACTOR: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/factory.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L62)

#### Returns

`Promise`\<`bigint`\>

***

### deployedTokens()

```ts
deployedTokens: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/factory.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L17)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `index`: `bigint`; \} |
| `args.index` | `bigint` |

#### Returns

`Promise`\<`Address`\>

***

### deployForCommunity()

```ts
deployForCommunity: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/factory.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L8)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `community`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.community` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### deployxPNTsToken()

```ts
deployxPNTsToken: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/factory.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L37)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `community`: `Address`; `name`: `string`; `symbol`: `string`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.community` | `Address` |
| `args.name` | `string` |
| `args.symbol` | `string` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### getAllTokens()

```ts
getAllTokens: () => Promise<Address[]>;
```

Defined in: [packages/core/src/actions/factory.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L15)

#### Returns

`Promise`\<`Address`[]\>

***

### getAPNTsPrice()

```ts
getAPNTsPrice: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/factory.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L43)

#### Returns

`Promise`\<`bigint`\>

***

### getCommunityByToken()

```ts
getCommunityByToken: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/factory.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L14)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Address`\>

***

### getDeployedCount()

```ts
getDeployedCount: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/factory.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L55)

#### Returns

`Promise`\<`bigint`\>

***

### getDepositBreakdown()

```ts
getDepositBreakdown: (args) => Promise<any>;
```

Defined in: [packages/core/src/actions/factory.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L42)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; \} |
| `args.community` | `Address` |

#### Returns

`Promise`\<`any`\>

***

### getImplementation()

```ts
getImplementation: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/factory.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L24)

#### Returns

`Promise`\<`Address`\>

***

### getIndustryMultiplier()

```ts
getIndustryMultiplier: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/factory.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L57)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `industry`: `string`; \} |
| `args.industry` | `string` |

#### Returns

`Promise`\<`bigint`\>

***

### getPredictionParams()

```ts
getPredictionParams: (args) => Promise<any>;
```

Defined in: [packages/core/src/actions/factory.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L41)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; \} |
| `args.community` | `Address` |

#### Returns

`Promise`\<`any`\>

***

### getTokenAddress()

```ts
getTokenAddress: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/factory.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L11)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; \} |
| `args.community` | `Address` |

#### Returns

`Promise`\<`Address`\>

***

### getTokenCount()

```ts
getTokenCount: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/factory.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L16)

#### Returns

`Promise`\<`bigint`\>

***

### hasToken()

```ts
hasToken: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/factory.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L54)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### industryMultipliers()

```ts
industryMultipliers: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/factory.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L56)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `industry`: `string`; \} |
| `args.industry` | `string` |

#### Returns

`Promise`\<`bigint`\>

***

### isTokenDeployed()

```ts
isTokenDeployed: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/factory.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L13)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; \} |
| `args.community` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### MIN\_SUGGESTED\_AMOUNT()

```ts
MIN_SUGGESTED_AMOUNT: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/factory.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L61)

#### Returns

`Promise`\<`bigint`\>

***

### predictAddress()

```ts
predictAddress: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/factory.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L12)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; `salt?`: `bigint`; \} |
| `args.community` | `Address` |
| `args.salt?` | `bigint` |

#### Returns

`Promise`\<`Address`\>

***

### predictDepositAmount()

```ts
predictDepositAmount: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/factory.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L40)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; `userCount`: `bigint`; \} |
| `args.community` | `Address` |
| `args.userCount` | `bigint` |

#### Returns

`Promise`\<`bigint`\>

***

### predictions()

```ts
predictions: (args) => Promise<any>;
```

Defined in: [packages/core/src/actions/factory.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L58)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; \} |
| `args.community` | `Address` |

#### Returns

`Promise`\<`any`\>

***

### REGISTRY()

```ts
REGISTRY: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/factory.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L27)

#### Returns

`Promise`\<`Address`\>

***

### renounceXPNTsFactoryOwnership()

```ts
renounceXPNTsFactoryOwnership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/factory.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L34)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### setImplementation()

```ts
setImplementation: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/factory.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L23)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `impl`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.impl` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### setIndustryMultiplier()

```ts
setIndustryMultiplier: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/factory.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L47)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `industry`: `string`; `multiplier`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.industry` | `string` |
| `args.multiplier` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### setRegistry()

```ts
setRegistry: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/factory.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L21)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `registry`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.registry` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### setSuperPaymaster()

```ts
setSuperPaymaster: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/factory.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L22)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `paymaster`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.paymaster` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### setSuperPaymasterAddress()

```ts
setSuperPaymasterAddress: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/factory.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L48)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `paymaster`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.paymaster` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### SUPER\_PAYMASTER()

```ts
SUPER_PAYMASTER: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/factory.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L28)

#### Returns

`Promise`\<`Address`\>

***

### SUPERPAYMASTER()

```ts
SUPERPAYMASTER: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/factory.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L63)

#### Returns

`Promise`\<`Address`\>

***

### tokenImplementation()

```ts
tokenImplementation: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/factory.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L29)

#### Returns

`Promise`\<`Address`\>

***

### transferXPNTsFactoryOwnership()

```ts
transferXPNTsFactoryOwnership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/factory.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L33)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `newOwner`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.newOwner` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### updateAPNTsPrice()

```ts
updateAPNTsPrice: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/factory.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L49)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `newPrice`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.newPrice` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### updatePrediction()

```ts
updatePrediction: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/factory.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L50)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `community`: `Address`; `userCount`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.community` | `Address` |
| `args.userCount` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### updatePredictionCustom()

```ts
updatePredictionCustom: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/factory.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L51)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `community`: `Address`; `params`: `any`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.community` | `Address` |
| `args.params` | `any` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### xPNTsFactoryOwner()

```ts
xPNTsFactoryOwner: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/factory.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L32)

#### Returns

`Promise`\<`Address`\>

***

### xPNTsFactoryVersion()

```ts
xPNTsFactoryVersion: () => Promise<string>;
```

Defined in: [packages/core/src/actions/factory.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L66)

#### Returns

`Promise`\<`string`\>
