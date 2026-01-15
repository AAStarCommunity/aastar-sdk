> **PaymasterFactoryActions** = `object`

Defined in: [packages/core/src/actions/factory.ts:70](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L70)

## Properties

### addImplementation()

> **addImplementation**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:103](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L103)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### implementation

`Address`

###### version

`string`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### calculateAddress()

> **calculateAddress**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:78](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L78)

#### Parameters

##### args

###### owner

`Address`

#### Returns

`Promise`\<`Address`\>

***

### defaultVersion()

> **defaultVersion**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/factory.ts:117](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L117)

#### Returns

`Promise`\<`string`\>

***

### deployPaymaster()

> **deployPaymaster**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L73)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### initData?

[`Hex`](https://viem.sh/docs/index.html)

###### owner

`Address`

###### version?

`string`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### deployPaymasterDeterministic()

> **deployPaymasterDeterministic**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L74)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### initData?

[`Hex`](https://viem.sh/docs/index.html)

###### owner

`Address`

###### salt

[`Hex`](https://viem.sh/docs/index.html)

###### version?

`string`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### ENTRY\_POINT()

> **ENTRY\_POINT**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:109](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L109)

#### Returns

`Promise`\<`Address`\>

***

### getAllPaymasters()

> **getAllPaymasters**: () => `Promise`\<`Address`[]\>

Defined in: [packages/core/src/actions/factory.ts:81](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L81)

#### Returns

`Promise`\<`Address`[]\>

***

### getImplementationV4()

> **getImplementationV4**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:100](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L100)

#### Returns

`Promise`\<`Address`\>

***

### getOperatorByPaymaster()

> **getOperatorByPaymaster**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L89)

#### Parameters

##### args

###### paymaster

`Address`

#### Returns

`Promise`\<`Address`\>

***

### getPaymaster()

> **getPaymaster**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:79](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L79)

#### Parameters

##### args

###### owner

`Address`

#### Returns

`Promise`\<`Address`\>

***

### getPaymasterByOperator()

> **getPaymasterByOperator**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:91](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L91)

#### Parameters

##### args

###### operator

`Address`

#### Returns

`Promise`\<`Address`\>

***

### getPaymasterCount()

> **getPaymasterCount**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/factory.ts:80](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L80)

#### Returns

`Promise`\<`bigint`\>

***

### getPaymasterInfo()

> **getPaymasterInfo**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/factory.ts:93](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L93)

#### Parameters

##### args

###### paymaster

`Address`

#### Returns

`Promise`\<`any`\>

***

### getPaymasterList()

> **getPaymasterList**: (`args`) => `Promise`\<`Address`[]\>

Defined in: [packages/core/src/actions/factory.ts:85](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L85)

#### Parameters

##### args

###### limit

`bigint`

###### offset

`bigint`

#### Returns

`Promise`\<`Address`[]\>

***

### hasImplementation()

> **hasImplementation**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/factory.ts:95](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L95)

#### Parameters

##### args

###### version

`string`

#### Returns

`Promise`\<`boolean`\>

***

### hasPaymaster()

> **hasPaymaster**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/factory.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L84)

#### Parameters

##### args

###### owner

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### implementations()

> **implementations**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:96](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L96)

#### Parameters

##### args

###### version

`string`

#### Returns

`Promise`\<`Address`\>

***

### isPaymasterDeployed()

> **isPaymasterDeployed**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/factory.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L82)

#### Parameters

##### args

###### owner

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### operatorByPaymaster()

> **operatorByPaymaster**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:90](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L90)

#### Parameters

##### args

###### paymaster

`Address`

#### Returns

`Promise`\<`Address`\>

***

### paymasterByOperator()

> **paymasterByOperator**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:92](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L92)

#### Parameters

##### args

###### operator

`Address`

#### Returns

`Promise`\<`Address`\>

***

### paymasterFactoryOwner()

> **paymasterFactoryOwner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:112](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L112)

#### Returns

`Promise`\<`Address`\>

***

### paymasterFactoryVersion()

> **paymasterFactoryVersion**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/factory.ts:118](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L118)

#### Returns

`Promise`\<`string`\>

***

### paymasterList()

> **paymasterList**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:86](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L86)

#### Parameters

##### args

###### index

`bigint`

#### Returns

`Promise`\<`Address`\>

***

### predictPaymasterAddress()

> **predictPaymasterAddress**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L75)

#### Parameters

##### args

###### owner

`Address`

###### salt

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`Address`\>

***

### REGISTRY()

> **REGISTRY**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:108](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L108)

#### Returns

`Promise`\<`Address`\>

***

### renouncePaymasterFactoryOwnership()

> **renouncePaymasterFactoryOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:114](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L114)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setDefaultVersion()

> **setDefaultVersion**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:105](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L105)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### version

`string`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setImplementationV4()

> **setImplementationV4**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:99](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L99)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### impl

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setRegistry()

> **setRegistry**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:101](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L101)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### registry

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### totalDeployed()

> **totalDeployed**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/factory.ts:87](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L87)

#### Returns

`Promise`\<`bigint`\>

***

### transferPaymasterFactoryOwnership()

> **transferPaymasterFactoryOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:113](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L113)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### newOwner

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### upgradeImplementation()

> **upgradeImplementation**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:104](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/factory.ts#L104)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### newImplementation

`Address`

###### version

`string`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>
