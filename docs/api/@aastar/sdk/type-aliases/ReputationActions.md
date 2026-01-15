> **ReputationActions** = `object`

Defined in: [packages/core/src/actions/reputation.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L4)

## Properties

### batchSyncToRegistry()

> **batchSyncToRegistry**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L27)

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

Defined in: [packages/core/src/actions/reputation.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L26)

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

> **boostedCollections**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L60)

#### Parameters

##### args

###### collection

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### calculateReputation()

> **calculateReputation**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L22)

#### Parameters

##### args

###### community

`Address`

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### communityActiveRules()

> **communityActiveRules**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/reputation.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L61)

#### Parameters

##### args

###### community

`Address`

###### ruleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`boolean`\>

***

### communityReputations()

> **communityReputations**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L18)

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

> **communityRules**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/reputation.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L56)

#### Parameters

##### args

###### community

`Address`

###### ruleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`boolean`\>

***

### computeScore()

> **computeScore**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L15)

#### Parameters

##### args

###### community

`Address`

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### defaultRule()

> **defaultRule**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L57)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### disableRule()

> **disableRule**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L9)

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

Defined in: [packages/core/src/actions/reputation.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L8)

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

Defined in: [packages/core/src/actions/reputation.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L58)

#### Parameters

##### args

###### factorId

`bigint`

#### Returns

`Promise`\<`bigint`\>

***

### getActiveRules()

> **getActiveRules**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)[]\>

Defined in: [packages/core/src/actions/reputation.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L11)

#### Parameters

##### args

###### community

`Address`

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)[]\>

***

### getCommunityScore()

> **getCommunityScore**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L17)

#### Parameters

##### args

###### community

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### getEntropyFactor()

> **getEntropyFactor**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L41)

#### Returns

`Promise`\<`bigint`\>

***

### getReputationBreakdown()

> **getReputationBreakdown**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/reputation.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L62)

#### Parameters

##### args

###### community

`Address`

###### user

`Address`

#### Returns

`Promise`\<`any`\>

***

### getReputationRule()

> **getReputationRule**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/reputation.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L7)

#### Parameters

##### args

###### ruleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`any`\>

***

### getRuleCount()

> **getRuleCount**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L12)

#### Returns

`Promise`\<`bigint`\>

***

### getUserScore()

> **getUserScore**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L16)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### isRuleActive()

> **isRuleActive**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/reputation.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L10)

#### Parameters

##### args

###### ruleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`boolean`\>

***

### nftCollectionBoost()

> **nftCollectionBoost**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L23)

#### Parameters

##### args

###### collection

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### nftHoldStart()

> **nftHoldStart**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L59)

#### Parameters

##### args

###### collection

`Address`

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### REGISTRY()

> **REGISTRY**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/reputation.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L44)

#### Returns

`Promise`\<`Address`\>

***

### renounceReputationOwnership()

> **renounceReputationOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L49)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### reputationOwner()

> **reputationOwner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/reputation.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L47)

#### Returns

`Promise`\<`Address`\>

***

### reputationVersion()

> **reputationVersion**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/reputation.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L66)

#### Returns

`Promise`\<`string`\>

***

### setCommunityReputation()

> **setCommunityReputation**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L52)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### community

`Address`

###### reputation

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setEntropyFactor()

> **setEntropyFactor**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L40)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### factor

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setNFTBoost()

> **setNFTBoost**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L63)

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

Defined in: [packages/core/src/actions/reputation.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L39)

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

Defined in: [packages/core/src/actions/reputation.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L6)

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

Defined in: [packages/core/src/actions/reputation.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L21)

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

### syncToRegistry()

> **syncToRegistry**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L28)

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

### transferReputationOwnership()

> **transferReputationOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L48)

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

Defined in: [packages/core/src/actions/reputation.ts:53](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/actions/reputation.ts#L53)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### collection

`Address`

###### start

`bigint`

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>
