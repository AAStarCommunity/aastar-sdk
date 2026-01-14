> **XPNTsFactoryActions** = `object`

Defined in: [packages/core/src/actions/factory.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L5)

## Properties

### aPNTsPriceUSD()

> **aPNTsPriceUSD**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/factory.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L44)

#### Returns

`Promise`\<`bigint`\>

***

### communityToToken()

> **communityToToken**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L18)

#### Parameters

##### args

###### community

`Address`

#### Returns

`Promise`\<`Address`\>

***

### createToken()

> **createToken**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L7)

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

### DEFAULT\_SAFETY\_FACTOR()

> **DEFAULT\_SAFETY\_FACTOR**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/factory.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L62)

#### Returns

`Promise`\<`bigint`\>

***

### deployedTokens()

> **deployedTokens**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L17)

#### Parameters

##### args

###### index

`bigint`

#### Returns

`Promise`\<`Address`\>

***

### deployForCommunity()

> **deployForCommunity**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L8)

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

Defined in: [packages/core/src/actions/factory.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L37)

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

### getAllTokens()

> **getAllTokens**: () => `Promise`\<`Address`[]\>

Defined in: [packages/core/src/actions/factory.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L15)

#### Returns

`Promise`\<`Address`[]\>

***

### getAPNTsPrice()

> **getAPNTsPrice**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/factory.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L43)

#### Returns

`Promise`\<`bigint`\>

***

### getCommunityByToken()

> **getCommunityByToken**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L14)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`Address`\>

***

### getDeployedCount()

> **getDeployedCount**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/factory.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L55)

#### Returns

`Promise`\<`bigint`\>

***

### getDepositBreakdown()

> **getDepositBreakdown**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/factory.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L42)

#### Parameters

##### args

###### community

`Address`

#### Returns

`Promise`\<`any`\>

***

### getImplementation()

> **getImplementation**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L24)

#### Returns

`Promise`\<`Address`\>

***

### getIndustryMultiplier()

> **getIndustryMultiplier**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/factory.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L57)

#### Parameters

##### args

###### industry

`string`

#### Returns

`Promise`\<`bigint`\>

***

### getPredictionParams()

> **getPredictionParams**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/factory.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L41)

#### Parameters

##### args

###### community

`Address`

#### Returns

`Promise`\<`any`\>

***

### getTokenAddress()

> **getTokenAddress**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L11)

#### Parameters

##### args

###### community

`Address`

#### Returns

`Promise`\<`Address`\>

***

### getTokenCount()

> **getTokenCount**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/factory.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L16)

#### Returns

`Promise`\<`bigint`\>

***

### hasToken()

> **hasToken**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/factory.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L54)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### industryMultipliers()

> **industryMultipliers**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/factory.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L56)

#### Parameters

##### args

###### industry

`string`

#### Returns

`Promise`\<`bigint`\>

***

### isTokenDeployed()

> **isTokenDeployed**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/factory.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L13)

#### Parameters

##### args

###### community

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### MIN\_SUGGESTED\_AMOUNT()

> **MIN\_SUGGESTED\_AMOUNT**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/factory.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L61)

#### Returns

`Promise`\<`bigint`\>

***

### predictAddress()

> **predictAddress**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L12)

#### Parameters

##### args

###### community

`Address`

###### salt?

`bigint`

#### Returns

`Promise`\<`Address`\>

***

### predictDepositAmount()

> **predictDepositAmount**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/factory.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L40)

#### Parameters

##### args

###### community

`Address`

###### userCount

`bigint`

#### Returns

`Promise`\<`bigint`\>

***

### predictions()

> **predictions**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/factory.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L58)

#### Parameters

##### args

###### community

`Address`

#### Returns

`Promise`\<`any`\>

***

### REGISTRY()

> **REGISTRY**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L27)

#### Returns

`Promise`\<`Address`\>

***

### renounceXPNTsFactoryOwnership()

> **renounceXPNTsFactoryOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L34)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setImplementation()

> **setImplementation**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L23)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### impl

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setIndustryMultiplier()

> **setIndustryMultiplier**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L47)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### industry

`string`

###### multiplier

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setRegistry()

> **setRegistry**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L21)

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

Defined in: [packages/core/src/actions/factory.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L22)

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

Defined in: [packages/core/src/actions/factory.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L48)

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

Defined in: [packages/core/src/actions/factory.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L28)

#### Returns

`Promise`\<`Address`\>

***

### SUPERPAYMASTER()

> **SUPERPAYMASTER**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L63)

#### Returns

`Promise`\<`Address`\>

***

### tokenImplementation()

> **tokenImplementation**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L29)

#### Returns

`Promise`\<`Address`\>

***

### transferXPNTsFactoryOwnership()

> **transferXPNTsFactoryOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L33)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### newOwner

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### updateAPNTsPrice()

> **updateAPNTsPrice**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L49)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### newPrice

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### updatePrediction()

> **updatePrediction**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L50)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### community

`Address`

###### userCount

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### updatePredictionCustom()

> **updatePredictionCustom**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L51)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### community

`Address`

###### params

`any`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### xPNTsFactoryOwner()

> **xPNTsFactoryOwner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L32)

#### Returns

`Promise`\<`Address`\>

***

### xPNTsFactoryVersion()

> **xPNTsFactoryVersion**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/factory.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/factory.ts#L66)

#### Returns

`Promise`\<`string`\>
