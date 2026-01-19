> **XPNTsFactoryActions** = `object`

Defined in: [packages/core/src/actions/factory.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L7)

## Properties

### communityToToken()

> **communityToToken**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L23)

#### Parameters

##### args

###### community

`Address`

#### Returns

`Promise`\<`Address`\>

***

### createToken()

> **createToken**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L10)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### community

`Address`

###### name

`string`

###### symbol

`string`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### deployedTokens()

> **deployedTokens**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L22)

#### Parameters

##### args

###### index

`bigint`

#### Returns

`Promise`\<`Address`\>

***

### deployForCommunity()

> **deployForCommunity**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L11)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### community

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### deployxPNTsToken()

> **deployxPNTsToken**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L9)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### communityENS

`string`

###### communityName

`string`

###### exchangeRate

`bigint`

###### name

`string`

###### paymasterAOA

`Address`

###### symbol

`string`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### getAllTokens()

> **getAllTokens**: () => `Promise`\<`Address`[]\>

Defined in: [packages/core/src/actions/factory.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L19)

#### Returns

`Promise`\<`Address`[]\>

***

### getCommunityByToken()

> **getCommunityByToken**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L18)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`Address`\>

***

### getDeployedCount()

> **getDeployedCount**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/factory.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L20)

#### Returns

`Promise`\<`bigint`\>

***

### getImplementation()

> **getImplementation**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L30)

#### Returns

`Promise`\<`Address`\>

***

### getTokenAddress()

> **getTokenAddress**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L14)

#### Parameters

##### args

###### community

`Address`

#### Returns

`Promise`\<`Address`\>

***

### getTokenCount()

> **getTokenCount**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/factory.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L21)

#### Returns

`Promise`\<`bigint`\>

***

### hasToken()

> **hasToken**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/factory.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L16)

#### Parameters

##### args

###### community

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### isTokenDeployed()

> **isTokenDeployed**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/factory.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L17)

#### Parameters

##### args

###### community

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### owner()

> **owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L39)

#### Returns

`Promise`\<`Address`\>

***

### predictAddress()

> **predictAddress**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L15)

#### Parameters

##### args

###### community

`Address`

###### salt?

`bigint`

#### Returns

`Promise`\<`Address`\>

***

### REGISTRY()

> **REGISTRY**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L33)

#### Returns

`Promise`\<`Address`\>

***

### renounceOwnership()

> **renounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L41)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setImplementation()

> **setImplementation**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L29)

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

Defined in: [packages/core/src/actions/factory.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L26)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### registry

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setSuperPaymaster()

> **setSuperPaymaster**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L28)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### paymaster

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setSuperPaymasterAddress()

> **setSuperPaymasterAddress**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L27)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### paymaster

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### SUPER\_PAYMASTER()

> **SUPER\_PAYMASTER**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L35)

#### Returns

`Promise`\<`Address`\>

***

### SUPERPAYMASTER()

> **SUPERPAYMASTER**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L34)

#### Returns

`Promise`\<`Address`\>

***

### tokenImplementation()

> **tokenImplementation**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L36)

#### Returns

`Promise`\<`Address`\>

***

### transferOwnership()

> **transferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L40)

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

Defined in: [packages/core/src/actions/factory.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/factory.ts#L44)

#### Returns

`Promise`\<`string`\>
