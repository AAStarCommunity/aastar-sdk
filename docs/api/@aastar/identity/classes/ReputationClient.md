Defined in: [index.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/identity/src/index.ts#L7)

## Constructors

### Constructor

> **new ReputationClient**(`client`, `reputationAddress`, `walletClient?`): `ReputationClient`

Defined in: [index.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/identity/src/index.ts#L17)

Initialize ReputationClient

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `client` | [`PublicClient`](../../core/interfaces/PublicClient.md) | The public client for queries |
| `reputationAddress` | `` `0x${string}` `` | The address of the reputation system contract |
| `walletClient?` | [`WalletClient`](../../core/interfaces/WalletClient.md)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, [`Account`](https://viem.sh/docs/index.html) \| `undefined`\> | Optional wallet client for write operations |

#### Returns

`ReputationClient`

## Methods

### computeScore()

> **computeScore**(`user`, `communities`, `ruleIds`, `activities`): `Promise`\<`bigint`\>

Defined in: [index.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/identity/src/index.ts#L28)

Compute reputation score for a user

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `user` | `` `0x${string}` `` |
| `communities` | `` `0x${string}` ``[] |
| `ruleIds` | `` `0x${string}` ``[][] |
| `activities` | `bigint`[][] |

#### Returns

`Promise`\<`bigint`\>

***

### getCreditLimit()

> **getCreditLimit**(`user`): `Promise`\<`bigint`\>

Defined in: [index.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/identity/src/index.ts#L58)

Get credit limit based on reputation

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `user` | `` `0x${string}` `` | User address |

#### Returns

`Promise`\<`bigint`\>

Credit limit in wei (Mock logic closely tied to Reputation)

***

### getGlobalReputation()

> **getGlobalReputation**(`user`): `Promise`\<`number`\>

Defined in: [index.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/identity/src/index.ts#L42)

Get global reputation score for a user

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `user` | `` `0x${string}` `` | User address |

#### Returns

`Promise`\<`number`\>

Reputation score

***

### getReputationBreakdown()

> **getReputationBreakdown**(`user`): `Promise`\<\{ `activityBonus`: `number`; `baseScore`: `number`; `penaltyDeduction`: `number`; `stakingBonus`: `number`; `total`: `number`; \}\>

Defined in: [index.ts:77](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/identity/src/index.ts#L77)

Get reputation score breakdown

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `user` | `` `0x${string}` `` | User address |

#### Returns

`Promise`\<\{ `activityBonus`: `number`; `baseScore`: `number`; `penaltyDeduction`: `number`; `stakingBonus`: `number`; `total`: `number`; \}\>

Detailed reputation breakdown (Mock implementation awaiting contract V4)

***

### submitReputationProof()

> **submitReputationProof**(`params`): `Promise`\<`` `0x${string}` ``\>

Defined in: [index.ts:101](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/identity/src/index.ts#L101)

Submit reputation proof (off-chain data to on-chain)

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `params` | \{ `proofData`: `string`; `proofType`: `"github"` \| `"twitter"` \| `"on-chain-activity"`; `signature`: `` `0x${string}` ``; \} | Proof parameters |
| `params.proofData` | `string` | - |
| `params.proofType` | `"github"` \| `"twitter"` \| `"on-chain-activity"` | - |
| `params.signature` | `` `0x${string}` `` | - |

#### Returns

`Promise`\<`` `0x${string}` ``\>

Transaction hash
