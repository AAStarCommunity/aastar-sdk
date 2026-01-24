> **ReputationActions** = `object`

Defined in: [packages/core/src/actions/reputation.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L20)

## Properties

### batchSyncToRegistry()

> **batchSyncToRegistry**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:53](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L53)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `users`: `Address`[]; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.users` | `Address`[] |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### batchUpdateScores()

> **batchUpdateScores**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L52)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `scores`: `bigint`[]; `users`: `Address`[]; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.scores` | `bigint`[] |
| `args.users` | `Address`[] |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### boostedCollections()

> **boostedCollections**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/reputation.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L48)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `index`: `bigint`; \} |
| `args.index` | `bigint` |

#### Returns

`Promise`\<`Address`\>

***

### calculateReputation()

> **calculateReputation**: (`args`) => `Promise`\<\{ `communityScore`: `bigint`; `globalScore`: `bigint`; \}\>

Defined in: [packages/core/src/actions/reputation.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L36)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; `timestamp`: `bigint`; `user`: `Address`; \} |
| `args.community` | `Address` |
| `args.timestamp` | `bigint` |
| `args.user` | `Address` |

#### Returns

`Promise`\<\{ `communityScore`: `bigint`; `globalScore`: `bigint`; \}\>

***

### communityActiveRules()

> **communityActiveRules**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L31)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; `index`: `bigint`; \} |
| `args.community` | `Address` |
| `args.index` | `bigint` |

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### communityReputations()

> **communityReputations**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L40)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; `user`: `Address`; \} |
| `args.community` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### communityRules()

> **communityRules**: (`args`) => `Promise`\<[`ReputationRule`](ReputationRule.md)\>

Defined in: [packages/core/src/actions/reputation.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L30)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; `ruleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.community` | `Address` |
| `args.ruleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`ReputationRule`](ReputationRule.md)\>

***

### computeScore()

> **computeScore**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L35)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `activities`: `bigint`[][]; `communities`: `Address`[]; `ruleIds`: [`Hex`](https://viem.sh/docs/index.html)[][]; `user`: `Address`; \} |
| `args.activities` | `bigint`[][] |
| `args.communities` | `Address`[] |
| `args.ruleIds` | [`Hex`](https://viem.sh/docs/index.html)[][] |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### defaultRule()

> **defaultRule**: () => `Promise`\<[`ReputationRule`](ReputationRule.md)\>

Defined in: [packages/core/src/actions/reputation.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L32)

#### Returns

`Promise`\<[`ReputationRule`](ReputationRule.md)\>

***

### disableRule()

> **disableRule**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L25)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `ruleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.ruleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### enableRule()

> **enableRule**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L24)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `ruleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.ruleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### entropyFactors()

> **entropyFactors**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L49)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; \} |
| `args.community` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### getActiveRules()

> **getActiveRules**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)[]\>

Defined in: [packages/core/src/actions/reputation.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L27)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; \} |
| `args.community` | `Address` |

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)[]\>

***

### getCommunityScore()

> **getCommunityScore**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L39)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; \} |
| `args.community` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### getEntropyFactor()

> **getEntropyFactor**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L67)

#### Returns

`Promise`\<`bigint`\>

***

### getReputationBreakdown()

> **getReputationBreakdown**: (`args`) => `Promise`\<[`ReputationBreakdown`](ReputationBreakdown.md)\>

Defined in: [packages/core/src/actions/reputation.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L37)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; `timestamp`: `bigint`; `user`: `Address`; \} |
| `args.community` | `Address` |
| `args.timestamp` | `bigint` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`ReputationBreakdown`](ReputationBreakdown.md)\>

***

### getReputationRule()

> **getReputationRule**: (`args`) => `Promise`\<[`ReputationRule`](ReputationRule.md)\>

Defined in: [packages/core/src/actions/reputation.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L23)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `ruleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.ruleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`ReputationRule`](ReputationRule.md)\>

***

### getRuleCount()

> **getRuleCount**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L28)

#### Returns

`Promise`\<`bigint`\>

***

### getUserScore()

> **getUserScore**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L38)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### isRuleActive()

> **isRuleActive**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/reputation.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L26)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `ruleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.ruleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`boolean`\>

***

### nftCollectionBoost()

> **nftCollectionBoost**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L45)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `collection`: `Address`; \} |
| `args.collection` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### nftHoldStart()

> **nftHoldStart**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L46)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `collection`: `Address`; `user`: `Address`; \} |
| `args.collection` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### owner()

> **owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/reputation.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L73)

#### Returns

`Promise`\<`Address`\>

***

### REGISTRY()

> **REGISTRY**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/reputation.ts:70](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L70)

#### Returns

`Promise`\<`Address`\>

***

### renounceOwnership()

> **renounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L75)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setCommunityReputation()

> **setCommunityReputation**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L41)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `community`: `Address`; `score`: `bigint`; `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.community` | `Address` |
| `args.score` | `bigint` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setEntropyFactor()

> **setEntropyFactor**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L66)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `community`: `Address`; `factor`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.community` | `Address` |
| `args.factor` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setNFTBoost()

> **setNFTBoost**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L44)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `boost`: `bigint`; `collection`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.boost` | `bigint` |
| `args.collection` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setRegistry()

> **setRegistry**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L65)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `registry`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.registry` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setReputationRule()

> **setReputationRule**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L22)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `rule`: [`ReputationRule`](ReputationRule.md); `ruleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.rule` | [`ReputationRule`](ReputationRule.md) |
| `args.ruleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setRule()

> **setRule**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L29)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `base`: `bigint`; `bonus`: `bigint`; `desc`: `string`; `max`: `bigint`; `ruleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.base` | `bigint` |
| `args.bonus` | `bigint` |
| `args.desc` | `string` |
| `args.max` | `bigint` |
| `args.ruleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### syncToRegistry()

> **syncToRegistry**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L54)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `activities`: `bigint`[][]; `communities`: `Address`[]; `epoch`: `bigint`; `proof`: [`Hex`](https://viem.sh/docs/index.html); `ruleIds`: [`Hex`](https://viem.sh/docs/index.html)[][]; `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.activities` | `bigint`[][] |
| `args.communities` | `Address`[] |
| `args.epoch` | `bigint` |
| `args.proof` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.ruleIds` | [`Hex`](https://viem.sh/docs/index.html)[][] |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### transferOwnership()

> **transferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L74)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newOwner`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newOwner` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### updateNFTHoldStart()

> **updateNFTHoldStart**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L47)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `collection`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.collection` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### version()

> **version**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/reputation.ts:78](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/reputation.ts#L78)

#### Returns

`Promise`\<`string`\>
