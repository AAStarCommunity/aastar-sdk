> **PaymasterFactoryActions** = `object`

Defined in: [packages/core/src/actions/factory.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/factory.ts#L43)

## Properties

### calculateAddress()

> **calculateAddress**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/factory.ts#L49)

#### Parameters

##### args

###### owner

`Address`

#### Returns

`Promise`\<`Address`\>

***

### defaultVersion()

> **defaultVersion**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/factory.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/factory.ts#L69)

#### Returns

`Promise`\<`string`\>

***

### deployPaymaster()

> **deployPaymaster**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/factory.ts#L46)

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

### ENTRY\_POINT()

> **ENTRY\_POINT**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/factory.ts#L62)

#### Returns

`Promise`\<`Address`\>

***

### getAllPaymasters()

> **getAllPaymasters**: () => `Promise`\<`Address`[]\>

Defined in: [packages/core/src/actions/factory.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/factory.ts#L52)

#### Returns

`Promise`\<`Address`[]\>

***

### getImplementationV4()

> **getImplementationV4**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/factory.ts#L57)

#### Returns

`Promise`\<`Address`\>

***

### getPaymaster()

> **getPaymaster**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/factory.ts#L50)

#### Parameters

##### args

###### owner

`Address`

#### Returns

`Promise`\<`Address`\>

***

### getPaymasterCount()

> **getPaymasterCount**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/factory.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/factory.ts#L51)

#### Returns

`Promise`\<`bigint`\>

***

### isPaymasterDeployed()

> **isPaymasterDeployed**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/factory.ts:53](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/factory.ts#L53)

#### Parameters

##### args

###### owner

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### owner()

> **owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/factory.ts#L65)

#### Returns

`Promise`\<`Address`\>

***

### REGISTRY()

> **REGISTRY**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/factory.ts#L61)

#### Returns

`Promise`\<`Address`\>

***

### setImplementationV4()

> **setImplementationV4**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/factory.ts#L56)

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

Defined in: [packages/core/src/actions/factory.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/factory.ts#L58)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### registry

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### transferOwnership()

> **transferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/factory.ts#L66)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### newOwner

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### version()

> **version**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/factory.ts:70](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/factory.ts#L70)

#### Returns

`Promise`\<`string`\>
