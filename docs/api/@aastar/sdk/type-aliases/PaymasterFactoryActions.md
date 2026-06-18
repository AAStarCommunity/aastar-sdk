> **PaymasterFactoryActions** = `object`

Defined in: [packages/core/src/actions/factory.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/factory.ts#L55)

## Properties

### addImplementation()

> **addImplementation**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/factory.ts#L71)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `impl`: `Address`; `version`: `string`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.impl` | `Address` |
| `args.version` | `string` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### calculateAddress()

> **calculateAddress**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/factory.ts#L61)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `owner`: `Address`; \} |
| `args.owner` | `Address` |

#### Returns

`Promise`\<`Address`\>

***

### defaultVersion()

> **defaultVersion**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/factory.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/factory.ts#L89)

#### Returns

`Promise`\<`string`\>

***

### deployPaymaster()

> **deployPaymaster**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/factory.ts#L57)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `initData?`: [`Hex`](https://viem.sh/docs/index.html); `version?`: `string`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.initData?` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.version?` | `string` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### deployPaymasterDeterministic()

> **deployPaymasterDeterministic**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/factory.ts#L58)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `initData`: [`Hex`](https://viem.sh/docs/index.html); `salt`: [`Hex`](https://viem.sh/docs/index.html); `version`: `string`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.initData` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.salt` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.version` | `string` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### ~~ENTRY\_POINT()~~

> **ENTRY\_POINT**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/factory.ts#L82)

#### Returns

`Promise`\<`Address`\>

#### Deprecated

Removed in the v5.x contract refactor — PaymasterFactory has no `ENTRY_POINT` constant. Throws ErrorCode.NOT\_IMPLEMENTED.

***

### getAllPaymasters()

> **getAllPaymasters**: () => `Promise`\<`Address`[]\>

Defined in: [packages/core/src/actions/factory.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/factory.ts#L66)

#### Returns

`Promise`\<`Address`[]\>

***

### getImplementation()

> **getImplementation**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/factory.ts#L75)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `version`: `string`; \} |
| `args.version` | `string` |

#### Returns

`Promise`\<`Address`\>

***

### getImplementationV4()

> **getImplementationV4**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/factory.ts#L76)

#### Returns

`Promise`\<`Address`\>

***

### getOperatorByPaymaster()

> **getOperatorByPaymaster**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:64](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/factory.ts#L64)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `paymaster`: `Address`; \} |
| `args.paymaster` | `Address` |

#### Returns

`Promise`\<`Address`\>

***

### getPaymaster()

> **getPaymaster**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/factory.ts#L62)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `owner`: `Address`; \} |
| `args.owner` | `Address` |

#### Returns

`Promise`\<`Address`\>

***

### getPaymasterByOperator()

> **getPaymasterByOperator**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/factory.ts#L63)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `operator`: `Address`; \} |
| `args.operator` | `Address` |

#### Returns

`Promise`\<`Address`\>

***

### getPaymasterCount()

> **getPaymasterCount**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/factory.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/factory.ts#L65)

#### Returns

`Promise`\<`bigint`\>

***

### hasPaymaster()

> **hasPaymaster**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/factory.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/factory.ts#L67)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `owner`: `Address`; \} |
| `args.owner` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### isPaymasterDeployed()

> **isPaymasterDeployed**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/factory.ts:68](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/factory.ts#L68)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `owner`: `Address`; \} |
| `args.owner` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### owner()

> **owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:85](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/factory.ts#L85)

#### Returns

`Promise`\<`Address`\>

***

### REGISTRY()

> **REGISTRY**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:80](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/factory.ts#L80)

#### Returns

`Promise`\<`Address`\>

***

### setDefaultVersion()

> **setDefaultVersion**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/factory.ts#L73)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `version`: `string`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.version` | `string` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setImplementationV4()

> **setImplementationV4**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/factory.ts#L74)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `impl`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.impl` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setRegistry()

> **setRegistry**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:77](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/factory.ts#L77)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `registry`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.registry` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### totalDeployed()

> **totalDeployed**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/factory.ts:90](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/factory.ts#L90)

#### Returns

`Promise`\<`bigint`\>

***

### transferOwnership()

> **transferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:86](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/factory.ts#L86)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newOwner`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newOwner` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### upgradeImplementation()

> **upgradeImplementation**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:72](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/factory.ts#L72)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `impl`: `Address`; `version`: `string`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.impl` | `Address` |
| `args.version` | `string` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### version()

> **version**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/factory.ts:91](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/factory.ts#L91)

#### Returns

`Promise`\<`string`\>
