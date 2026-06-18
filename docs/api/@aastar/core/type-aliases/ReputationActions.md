> **ReputationActions** = `object`

Defined in: [packages/core/src/actions/reputation.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L20)

## Properties

### ~~batchSyncToRegistry()~~

> **batchSyncToRegistry**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L75)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `users`: `Address`[]; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.users` | `Address`[] |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

Removed in the v5.x contract refactor — no batch sync variant. Throws ErrorCode.NOT\_IMPLEMENTED; use [syncToRegistry](#synctoregistry) (per-user, with proof).

***

### ~~batchUpdateScores()~~

> **batchUpdateScores**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L73)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `scores`: `bigint`[]; `users`: `Address`[]; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.scores` | `bigint`[] |
| `args.users` | `Address`[] |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

Removed in the v5.x contract refactor — no `batchUpdateScores`. Throws ErrorCode.NOT\_IMPLEMENTED; use [setCommunityReputation](#setcommunityreputation) per user or [syncToRegistry](#synctoregistry).

***

### boostedCollections()

> **boostedCollections**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/reputation.ts:68](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L68)

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

Defined in: [packages/core/src/actions/reputation.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L42)

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

Defined in: [packages/core/src/actions/reputation.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L37)

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

Defined in: [packages/core/src/actions/reputation.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L60)

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

Defined in: [packages/core/src/actions/reputation.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L36)

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

Defined in: [packages/core/src/actions/reputation.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L41)

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

Defined in: [packages/core/src/actions/reputation.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L38)

#### Returns

`Promise`\<[`ReputationRule`](ReputationRule.md)\>

***

### ~~disableRule()~~

> **disableRule**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L29)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `ruleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.ruleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

Removed in the v5.x contract refactor — rules have no enable/disable toggle. Throws ErrorCode.NOT\_IMPLEMENTED.

***

### ~~enableRule()~~

> **enableRule**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L27)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `ruleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.ruleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

Removed in the v5.x contract refactor — rules have no enable/disable toggle. Throws ErrorCode.NOT\_IMPLEMENTED.

***

### entropyFactors()

> **entropyFactors**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L69)

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

Defined in: [packages/core/src/actions/reputation.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L32)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; \} |
| `args.community` | `Address` |

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)[]\>

***

### ~~getCommunityScore()~~

> **getCommunityScore**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L59)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; \} |
| `args.community` | `Address` |

#### Returns

`Promise`\<`bigint`\>

#### Deprecated

NOT available on-chain. `getCommunityScore` does not exist in the deployed
ReputationSystem ABI (calling it reverts). There is no aggregate per-community score
getter — use [communityReputations](#communityreputations) (per-user community score) or
[calculateReputation](#calculatereputation) (returns `communityScore` for a given user) instead.
This method now throws a descriptive error rather than reverting on-chain.

***

### ~~getEntropyFactor()~~

> **getEntropyFactor**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:91](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L91)

#### Returns

`Promise`\<`bigint`\>

#### Deprecated

Removed in the v5.x contract refactor — no no-arg `getEntropyFactor`. Throws ErrorCode.NOT\_IMPLEMENTED; use [entropyFactors](#entropyfactors)({ community }).

***

### getReputationBreakdown()

> **getReputationBreakdown**: (`args`) => `Promise`\<[`ReputationBreakdown`](ReputationBreakdown.md)\>

Defined in: [packages/core/src/actions/reputation.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L43)

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

### ~~getReputationRule()~~

> **getReputationRule**: (`args`) => `Promise`\<[`ReputationRule`](ReputationRule.md)\>

Defined in: [packages/core/src/actions/reputation.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L25)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `ruleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.ruleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`ReputationRule`](ReputationRule.md)\>

#### Deprecated

Removed in the v5.x contract refactor — no single-rule getter by ruleId. Throws ErrorCode.NOT\_IMPLEMENTED; use [communityRules](#communityrules) (per-community) or [defaultRule](#defaultrule).

***

### ~~getRuleCount()~~

> **getRuleCount**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L34)

#### Returns

`Promise`\<`bigint`\>

#### Deprecated

Removed in the v5.x contract refactor — no global rule counter. Throws ErrorCode.NOT\_IMPLEMENTED.

***

### ~~getUserScore()~~

> **getUserScore**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L51)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

#### Deprecated

NOT available on-chain. `getUserScore` does not exist in the deployed
ReputationSystem ABI (calling it reverts). There is no single-argument global score
getter — use [calculateReputation](#calculatereputation) (returns `globalScore`, requires a community
+ timestamp) or read `globalReputation(user)` from the Registry contract instead.
This method now throws a descriptive error rather than reverting on-chain.

***

### ~~isRuleActive()~~

> **isRuleActive**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/reputation.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L31)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `ruleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.ruleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`boolean`\>

#### Deprecated

Removed in the v5.x contract refactor — no `isRuleActive(ruleId)` getter (rule activity is per-community). Throws ErrorCode.NOT\_IMPLEMENTED; use [getActiveRules](#getactiverules)({ community }) and test membership.

***

### MAX\_BOOSTED\_COLLECTIONS()

> **MAX\_BOOSTED\_COLLECTIONS**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:96](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L96)

Max number of NFT collections that can grant a reputation boost (view). ABI: MAX_BOOSTED_COLLECTIONS() -> uint256.

#### Returns

`Promise`\<`bigint`\>

***

### nftCollectionBoost()

> **nftCollectionBoost**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/reputation.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L65)

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

Defined in: [packages/core/src/actions/reputation.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L66)

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

Defined in: [packages/core/src/actions/reputation.ts:99](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L99)

#### Returns

`Promise`\<`Address`\>

***

### REGISTRY()

> **REGISTRY**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/reputation.ts:94](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L94)

#### Returns

`Promise`\<`Address`\>

***

### renounceOwnership()

> **renounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:101](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L101)

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

Defined in: [packages/core/src/actions/reputation.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L61)

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

Defined in: [packages/core/src/actions/reputation.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L89)

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

Defined in: [packages/core/src/actions/reputation.ts:64](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L64)

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

### ~~setRegistry()~~

> **setRegistry**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:88](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L88)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `registry`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.registry` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

Removed in the v5.x contract refactor — REGISTRY is immutable (no `setRegistry`). Throws ErrorCode.NOT\_IMPLEMENTED.

***

### ~~setReputationRule()~~

> **setReputationRule**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L23)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `rule`: [`ReputationRule`](ReputationRule.md); `ruleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.rule` | [`ReputationRule`](ReputationRule.md) |
| `args.ruleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

The deployed ReputationSystem ABI has no `setReputationRule` — this wrapper now calls the ABI-confirmed `setRule(ruleId, base, bonus, max, desc)` (the [ReputationRule](ReputationRule.md) struct is flattened). Prefer [setRule](#setrule).

***

### setRule()

> **setRule**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L35)

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

Defined in: [packages/core/src/actions/reputation.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L76)

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

Defined in: [packages/core/src/actions/reputation.ts:100](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L100)

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

Defined in: [packages/core/src/actions/reputation.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L67)

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

Defined in: [packages/core/src/actions/reputation.ts:104](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/reputation.ts#L104)

#### Returns

`Promise`\<`string`\>
