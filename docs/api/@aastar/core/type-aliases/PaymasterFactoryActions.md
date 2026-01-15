```ts
type PaymasterFactoryActions = object;
```

Defined in: [packages/core/src/actions/factory.ts:70](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L70)

## Properties

### addImplementation()

```ts
addImplementation: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/factory.ts:103](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L103)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `implementation`: `Address`; `version`: `string`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.implementation` | `Address` |
| `args.version` | `string` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### calculateAddress()

```ts
calculateAddress: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/factory.ts:78](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L78)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `owner`: `Address`; \} |
| `args.owner` | `Address` |

#### Returns

`Promise`\<`Address`\>

***

### defaultVersion()

```ts
defaultVersion: () => Promise<string>;
```

Defined in: [packages/core/src/actions/factory.ts:117](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L117)

#### Returns

`Promise`\<`string`\>

***

### deployPaymaster()

```ts
deployPaymaster: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/factory.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L73)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `initData?`: [`Hex`](https://viem.sh/docs/); `owner`: `Address`; `version?`: `string`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.initData?` | [`Hex`](https://viem.sh/docs/) |
| `args.owner` | `Address` |
| `args.version?` | `string` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### deployPaymasterDeterministic()

```ts
deployPaymasterDeterministic: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/factory.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L74)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `initData?`: [`Hex`](https://viem.sh/docs/); `owner`: `Address`; `salt`: [`Hex`](https://viem.sh/docs/); `version?`: `string`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.initData?` | [`Hex`](https://viem.sh/docs/) |
| `args.owner` | `Address` |
| `args.salt` | [`Hex`](https://viem.sh/docs/) |
| `args.version?` | `string` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### ENTRY\_POINT()

```ts
ENTRY_POINT: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/factory.ts:109](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L109)

#### Returns

`Promise`\<`Address`\>

***

### getAllPaymasters()

```ts
getAllPaymasters: () => Promise<Address[]>;
```

Defined in: [packages/core/src/actions/factory.ts:81](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L81)

#### Returns

`Promise`\<`Address`[]\>

***

### getImplementationV4()

```ts
getImplementationV4: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/factory.ts:100](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L100)

#### Returns

`Promise`\<`Address`\>

***

### getOperatorByPaymaster()

```ts
getOperatorByPaymaster: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/factory.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L89)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `paymaster`: `Address`; \} |
| `args.paymaster` | `Address` |

#### Returns

`Promise`\<`Address`\>

***

### getPaymaster()

```ts
getPaymaster: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/factory.ts:79](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L79)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `owner`: `Address`; \} |
| `args.owner` | `Address` |

#### Returns

`Promise`\<`Address`\>

***

### getPaymasterByOperator()

```ts
getPaymasterByOperator: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/factory.ts:91](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L91)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `operator`: `Address`; \} |
| `args.operator` | `Address` |

#### Returns

`Promise`\<`Address`\>

***

### getPaymasterCount()

```ts
getPaymasterCount: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/factory.ts:80](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L80)

#### Returns

`Promise`\<`bigint`\>

***

### getPaymasterInfo()

```ts
getPaymasterInfo: (args) => Promise<any>;
```

Defined in: [packages/core/src/actions/factory.ts:93](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L93)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `paymaster`: `Address`; \} |
| `args.paymaster` | `Address` |

#### Returns

`Promise`\<`any`\>

***

### getPaymasterList()

```ts
getPaymasterList: (args) => Promise<Address[]>;
```

Defined in: [packages/core/src/actions/factory.ts:85](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L85)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `limit`: `bigint`; `offset`: `bigint`; \} |
| `args.limit` | `bigint` |
| `args.offset` | `bigint` |

#### Returns

`Promise`\<`Address`[]\>

***

### hasImplementation()

```ts
hasImplementation: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/factory.ts:95](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L95)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `version`: `string`; \} |
| `args.version` | `string` |

#### Returns

`Promise`\<`boolean`\>

***

### hasPaymaster()

```ts
hasPaymaster: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/factory.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L84)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `owner`: `Address`; \} |
| `args.owner` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### implementations()

```ts
implementations: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/factory.ts:96](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L96)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `version`: `string`; \} |
| `args.version` | `string` |

#### Returns

`Promise`\<`Address`\>

***

### isPaymasterDeployed()

```ts
isPaymasterDeployed: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/factory.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L82)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `owner`: `Address`; \} |
| `args.owner` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### operatorByPaymaster()

```ts
operatorByPaymaster: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/factory.ts:90](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L90)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `paymaster`: `Address`; \} |
| `args.paymaster` | `Address` |

#### Returns

`Promise`\<`Address`\>

***

### paymasterByOperator()

```ts
paymasterByOperator: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/factory.ts:92](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L92)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `operator`: `Address`; \} |
| `args.operator` | `Address` |

#### Returns

`Promise`\<`Address`\>

***

### paymasterFactoryOwner()

```ts
paymasterFactoryOwner: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/factory.ts:112](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L112)

#### Returns

`Promise`\<`Address`\>

***

### paymasterFactoryVersion()

```ts
paymasterFactoryVersion: () => Promise<string>;
```

Defined in: [packages/core/src/actions/factory.ts:118](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L118)

#### Returns

`Promise`\<`string`\>

***

### paymasterList()

```ts
paymasterList: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/factory.ts:86](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L86)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `index`: `bigint`; \} |
| `args.index` | `bigint` |

#### Returns

`Promise`\<`Address`\>

***

### predictPaymasterAddress()

```ts
predictPaymasterAddress: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/factory.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L75)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `owner`: `Address`; `salt`: [`Hex`](https://viem.sh/docs/); \} |
| `args.owner` | `Address` |
| `args.salt` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<`Address`\>

***

### REGISTRY()

```ts
REGISTRY: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/factory.ts:108](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L108)

#### Returns

`Promise`\<`Address`\>

***

### renouncePaymasterFactoryOwnership()

```ts
renouncePaymasterFactoryOwnership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/factory.ts:114](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L114)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### setDefaultVersion()

```ts
setDefaultVersion: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/factory.ts:105](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L105)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `version`: `string`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.version` | `string` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### setImplementationV4()

```ts
setImplementationV4: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/factory.ts:99](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L99)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `impl`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.impl` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### setRegistry()

```ts
setRegistry: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/factory.ts:101](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L101)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `registry`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.registry` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### totalDeployed()

```ts
totalDeployed: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/factory.ts:87](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L87)

#### Returns

`Promise`\<`bigint`\>

***

### transferPaymasterFactoryOwnership()

```ts
transferPaymasterFactoryOwnership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/factory.ts:113](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L113)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `newOwner`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.newOwner` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### upgradeImplementation()

```ts
upgradeImplementation: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/factory.ts:104](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/factory.ts#L104)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `newImplementation`: `Address`; `version`: `string`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.newImplementation` | `Address` |
| `args.version` | `string` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>
