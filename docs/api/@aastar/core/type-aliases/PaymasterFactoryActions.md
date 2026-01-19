> **PaymasterFactoryActions** = `object`

Defined in: [packages/core/src/actions/factory.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/factory.ts#L48)

## Properties

### addImplementation()

> **addImplementation**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:64](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/factory.ts#L64)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### impl

`Address`

###### version

`string`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### calculateAddress()

> **calculateAddress**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/factory.ts#L54)

#### Parameters

##### args

###### owner

`Address`

#### Returns

`Promise`\<`Address`\>

***

### defaultVersion()

> **defaultVersion**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/factory.ts:81](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/factory.ts#L81)

#### Returns

`Promise`\<`string`\>

***

### deployPaymaster()

> **deployPaymaster**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/factory.ts#L50)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### initData?

[`Hex`](https://viem.sh/docs/index.html)

###### version?

`string`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### deployPaymasterDeterministic()

> **deployPaymasterDeterministic**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/factory.ts#L51)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### initData

[`Hex`](https://viem.sh/docs/index.html)

###### salt

[`Hex`](https://viem.sh/docs/index.html)

###### version

`string`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### ENTRY\_POINT()

> **ENTRY\_POINT**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/factory.ts#L74)

#### Returns

`Promise`\<`Address`\>

***

### getAllPaymasters()

> **getAllPaymasters**: () => `Promise`\<`Address`[]\>

Defined in: [packages/core/src/actions/factory.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/factory.ts#L59)

#### Returns

`Promise`\<`Address`[]\>

***

### getImplementation()

> **getImplementation**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:68](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/factory.ts#L68)

#### Parameters

##### args

###### version

`string`

#### Returns

`Promise`\<`Address`\>

***

### getImplementationV4()

> **getImplementationV4**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/factory.ts#L69)

#### Returns

`Promise`\<`Address`\>

***

### getOperatorByPaymaster()

> **getOperatorByPaymaster**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/factory.ts#L57)

#### Parameters

##### args

###### paymaster

`Address`

#### Returns

`Promise`\<`Address`\>

***

### getPaymaster()

> **getPaymaster**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/factory.ts#L55)

#### Parameters

##### args

###### owner

`Address`

#### Returns

`Promise`\<`Address`\>

***

### getPaymasterByOperator()

> **getPaymasterByOperator**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/factory.ts#L56)

#### Parameters

##### args

###### operator

`Address`

#### Returns

`Promise`\<`Address`\>

***

### getPaymasterCount()

> **getPaymasterCount**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/factory.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/factory.ts#L58)

#### Returns

`Promise`\<`bigint`\>

***

### hasPaymaster()

> **hasPaymaster**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/factory.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/factory.ts#L60)

#### Parameters

##### args

###### owner

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### isPaymasterDeployed()

> **isPaymasterDeployed**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/factory.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/factory.ts#L61)

#### Parameters

##### args

###### owner

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### owner()

> **owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:77](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/factory.ts#L77)

#### Returns

`Promise`\<`Address`\>

***

### REGISTRY()

> **REGISTRY**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/factory.ts#L73)

#### Returns

`Promise`\<`Address`\>

***

### setDefaultVersion()

> **setDefaultVersion**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/factory.ts#L66)

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

Defined in: [packages/core/src/actions/factory.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/factory.ts#L67)

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

Defined in: [packages/core/src/actions/factory.ts:70](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/factory.ts#L70)

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

Defined in: [packages/core/src/actions/factory.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/factory.ts#L82)

#### Returns

`Promise`\<`bigint`\>

***

### transferOwnership()

> **transferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:78](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/factory.ts#L78)

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

Defined in: [packages/core/src/actions/factory.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/factory.ts#L65)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### impl

`Address`

###### version

`string`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### version()

> **version**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/factory.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/factory.ts#L83)

#### Returns

`Promise`\<`string`\>
