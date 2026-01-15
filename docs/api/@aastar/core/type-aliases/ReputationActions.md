```ts
type ReputationActions = object;
```

Defined in: [packages/core/src/actions/reputation.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L4)

## Properties

### batchSyncToRegistry()

```ts
batchSyncToRegistry: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/reputation.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L27)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `users`: `Address`[]; \} |
| `args.account?` | `Account` \| `Address` |
| `args.users` | `Address`[] |

#### Returns

`Promise`\<`Hash`\>

***

### batchUpdateScores()

```ts
batchUpdateScores: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/reputation.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L26)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `scores`: `bigint`[]; `users`: `Address`[]; \} |
| `args.account?` | `Account` \| `Address` |
| `args.scores` | `bigint`[] |
| `args.users` | `Address`[] |

#### Returns

`Promise`\<`Hash`\>

***

### boostedCollections()

```ts
boostedCollections: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/reputation.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L60)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `collection`: `Address`; \} |
| `args.collection` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### calculateReputation()

```ts
calculateReputation: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/reputation.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L22)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; `user`: `Address`; \} |
| `args.community` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### communityActiveRules()

```ts
communityActiveRules: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/reputation.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L61)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; `ruleId`: `Hex`; \} |
| `args.community` | `Address` |
| `args.ruleId` | `Hex` |

#### Returns

`Promise`\<`boolean`\>

***

### communityReputations()

```ts
communityReputations: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/reputation.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L18)

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

```ts
communityRules: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/reputation.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L56)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; `ruleId`: `Hex`; \} |
| `args.community` | `Address` |
| `args.ruleId` | `Hex` |

#### Returns

`Promise`\<`boolean`\>

***

### computeScore()

```ts
computeScore: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/reputation.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L15)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; `user`: `Address`; \} |
| `args.community` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### defaultRule()

```ts
defaultRule: () => Promise<Hex>;
```

Defined in: [packages/core/src/actions/reputation.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L57)

#### Returns

`Promise`\<`Hex`\>

***

### disableRule()

```ts
disableRule: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/reputation.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L9)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `ruleId`: `Hex`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.ruleId` | `Hex` |

#### Returns

`Promise`\<`Hash`\>

***

### enableRule()

```ts
enableRule: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/reputation.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L8)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `ruleId`: `Hex`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.ruleId` | `Hex` |

#### Returns

`Promise`\<`Hash`\>

***

### entropyFactors()

```ts
entropyFactors: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/reputation.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L58)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `factorId`: `bigint`; \} |
| `args.factorId` | `bigint` |

#### Returns

`Promise`\<`bigint`\>

***

### getActiveRules()

```ts
getActiveRules: (args) => Promise<Hex[]>;
```

Defined in: [packages/core/src/actions/reputation.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L11)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; \} |
| `args.community` | `Address` |

#### Returns

`Promise`\<`Hex`[]\>

***

### getCommunityScore()

```ts
getCommunityScore: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/reputation.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L17)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; \} |
| `args.community` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### getEntropyFactor()

```ts
getEntropyFactor: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/reputation.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L41)

#### Returns

`Promise`\<`bigint`\>

***

### getReputationBreakdown()

```ts
getReputationBreakdown: (args) => Promise<any>;
```

Defined in: [packages/core/src/actions/reputation.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L62)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; `user`: `Address`; \} |
| `args.community` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`any`\>

***

### getReputationRule()

```ts
getReputationRule: (args) => Promise<any>;
```

Defined in: [packages/core/src/actions/reputation.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L7)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `ruleId`: `Hex`; \} |
| `args.ruleId` | `Hex` |

#### Returns

`Promise`\<`any`\>

***

### getRuleCount()

```ts
getRuleCount: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/reputation.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L12)

#### Returns

`Promise`\<`bigint`\>

***

### getUserScore()

```ts
getUserScore: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/reputation.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L16)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### isRuleActive()

```ts
isRuleActive: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/reputation.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L10)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `ruleId`: `Hex`; \} |
| `args.ruleId` | `Hex` |

#### Returns

`Promise`\<`boolean`\>

***

### nftCollectionBoost()

```ts
nftCollectionBoost: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/reputation.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L23)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `collection`: `Address`; \} |
| `args.collection` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### nftHoldStart()

```ts
nftHoldStart: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/reputation.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L59)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `collection`: `Address`; `user`: `Address`; \} |
| `args.collection` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### REGISTRY()

```ts
REGISTRY: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/reputation.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L44)

#### Returns

`Promise`\<`Address`\>

***

### renounceReputationOwnership()

```ts
renounceReputationOwnership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/reputation.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L49)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; \} |
| `args.account?` | `Account` \| `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### reputationOwner()

```ts
reputationOwner: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/reputation.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L47)

#### Returns

`Promise`\<`Address`\>

***

### reputationVersion()

```ts
reputationVersion: () => Promise<string>;
```

Defined in: [packages/core/src/actions/reputation.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L66)

#### Returns

`Promise`\<`string`\>

***

### setCommunityReputation()

```ts
setCommunityReputation: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/reputation.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L52)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `community`: `Address`; `reputation`: `bigint`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.community` | `Address` |
| `args.reputation` | `bigint` |

#### Returns

`Promise`\<`Hash`\>

***

### setEntropyFactor()

```ts
setEntropyFactor: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/reputation.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L40)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `factor`: `bigint`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.factor` | `bigint` |

#### Returns

`Promise`\<`Hash`\>

***

### setNFTBoost()

```ts
setNFTBoost: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/reputation.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L63)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `boost`: `bigint`; `collection`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.boost` | `bigint` |
| `args.collection` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### setRegistry()

```ts
setRegistry: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/reputation.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L39)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `registry`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.registry` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### setReputationRule()

```ts
setReputationRule: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/reputation.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L6)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `rule`: `any`; `ruleId`: `Hex`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.rule` | `any` |
| `args.ruleId` | `Hex` |

#### Returns

`Promise`\<`Hash`\>

***

### setRule()

```ts
setRule: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/reputation.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L21)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `rule`: `any`; `ruleId`: `Hex`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.rule` | `any` |
| `args.ruleId` | `Hex` |

#### Returns

`Promise`\<`Hash`\>

***

### syncToRegistry()

```ts
syncToRegistry: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/reputation.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L28)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `activities`: `bigint`[][]; `communities`: `Address`[]; `epoch`: `bigint`; `proof`: `Hex`; `ruleIds`: `Hex`[][]; `user`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.activities` | `bigint`[][] |
| `args.communities` | `Address`[] |
| `args.epoch` | `bigint` |
| `args.proof` | `Hex` |
| `args.ruleIds` | `Hex`[][] |
| `args.user` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### transferReputationOwnership()

```ts
transferReputationOwnership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/reputation.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L48)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `newOwner`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.newOwner` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### updateNFTHoldStart()

```ts
updateNFTHoldStart: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/reputation.ts:53](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/reputation.ts#L53)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `collection`: `Address`; `start`: `bigint`; `user`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.collection` | `Address` |
| `args.start` | `bigint` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`Hash`\>
