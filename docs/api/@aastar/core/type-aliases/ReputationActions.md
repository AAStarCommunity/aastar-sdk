> **ReputationActions** = `object`

Defined in: [packages/core/src/actions/reputation.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L6)

## Properties

### batchSyncToRegistry()

> **batchSyncToRegistry**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L39)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### users

`Address`[]

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### batchUpdateScores()

> **batchUpdateScores**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L38)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### scores

`bigint`[]

###### users

`Address`[]

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### boostedCollections()

> **boostedCollections**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/reputation.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L34)

#### Parameters

##### args

###### index

`bigint`

#### Returns

`Promise`\<`Address`\>

***

### calculateReputation()

> **calculateReputation**: (`args`) => `Promise`\<\{ `communityScore`: `bigint`; `globalScore`: `bigint`; \}\>

Defined in: [packages/core/src/actions/reputation.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L22)

#### Parameters

##### args

###### community

`Address`

###### timestamp

`bigint`

###### user

`Address`

#### Returns

`Promise`\<\{ `communityScore`: `bigint`; `globalScore`: `bigint`; \}\>

***

### communityActiveRules()

> **communityActiveRules**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L17)

#### Parameters

##### args

###### community

`Address`

###### index

`bigint`

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### communityReputations()

> **communityReputations**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L26)

#### Parameters

##### args

###### community

`Address`

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### communityRules()

> **communityRules**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/reputation.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L16)

#### Parameters

##### args

###### community

`Address`

###### ruleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`any`\>

***

### computeScore()

> **computeScore**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L21)

#### Parameters

##### args

###### activities

`bigint`[][]

###### communities

`Address`[]

###### ruleIds

[`Hex`](https://viem.sh/docs/index.html)[][]

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### defaultRule()

> **defaultRule**: () => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/reputation.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L18)

#### Returns

`Promise`\<`any`\>

***

### disableRule()

> **disableRule**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L11)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### ruleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### enableRule()

> **enableRule**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L10)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### ruleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### entropyFactors()

> **entropyFactors**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L35)

#### Parameters

##### args

###### community

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### getActiveRules()

> **getActiveRules**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)[]\>

Defined in: [packages/core/src/actions/reputation.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L13)

#### Parameters

##### args

###### community

`Address`

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)[]\>

***

### getCommunityScore()

> **getCommunityScore**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L25)

#### Parameters

##### args

###### community

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### getEntropyFactor()

> **getEntropyFactor**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:53](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L53)

#### Returns

`Promise`\<`bigint`\>

***

### getReputationBreakdown()

> **getReputationBreakdown**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/reputation.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L23)

#### Parameters

##### args

###### community

`Address`

###### timestamp

`bigint`

###### user

`Address`

#### Returns

`Promise`\<`any`\>

***

### getReputationRule()

> **getReputationRule**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/reputation.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L9)

#### Parameters

##### args

###### ruleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`any`\>

***

### getRuleCount()

> **getRuleCount**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L14)

#### Returns

`Promise`\<`bigint`\>

***

### getUserScore()

> **getUserScore**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L24)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### isRuleActive()

> **isRuleActive**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/reputation.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L12)

#### Parameters

##### args

###### ruleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`boolean`\>

***

### nftCollectionBoost()

> **nftCollectionBoost**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L31)

#### Parameters

##### args

###### collection

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### nftHoldStart()

> **nftHoldStart**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L32)

#### Parameters

##### args

###### collection

`Address`

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### owner()

> **owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/reputation.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L59)

#### Returns

`Promise`\<`Address`\>

***

### REGISTRY()

> **REGISTRY**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/reputation.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L56)

#### Returns

`Promise`\<`Address`\>

***

### renounceOwnership()

> **renounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L61)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setCommunityReputation()

> **setCommunityReputation**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L27)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### community

`Address`

###### score

`bigint`

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setEntropyFactor()

> **setEntropyFactor**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L52)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### community

`Address`

###### factor

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setNFTBoost()

> **setNFTBoost**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L30)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### boost

`bigint`

###### collection

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setRegistry()

> **setRegistry**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L51)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### registry

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setReputationRule()

> **setReputationRule**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L8)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### rule

`any`

###### ruleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setRule()

> **setRule**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L15)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### base

`bigint`

###### bonus

`bigint`

###### desc

`string`

###### max

`bigint`

###### ruleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### syncToRegistry()

> **syncToRegistry**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L40)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### activities

`bigint`[][]

###### communities

`Address`[]

###### epoch

`bigint`

###### proof

[`Hex`](https://viem.sh/docs/index.html)

###### ruleIds

[`Hex`](https://viem.sh/docs/index.html)[][]

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### transferOwnership()

> **transferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L60)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### newOwner

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### updateNFTHoldStart()

> **updateNFTHoldStart**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L33)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### collection

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### version()

> **version**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/reputation.ts:64](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/reputation.ts#L64)

#### Returns

`Promise`\<`string`\>
