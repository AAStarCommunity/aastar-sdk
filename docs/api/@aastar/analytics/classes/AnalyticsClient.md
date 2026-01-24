Defined in: [index.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/analytics/src/index.ts#L17)

Analytics client for monitoring and statistics

## Role Required

None (public query APIs)

## Description

Dashboard and monitoring tools

## No Permission Required - All Public Queries

## Typical Users:
- Dashboard Developers
- Community Analytics
- Investors & Researchers

## Constructors

### Constructor

> **new AnalyticsClient**(`publicClient`, `addresses?`): `AnalyticsClient`

Defined in: [index.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/analytics/src/index.ts#L25)

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `publicClient` | [`PublicClient`](../../core/interfaces/PublicClient.md) | **`Internal`** |
| `addresses?` | \{ `gtoken?`: `` `0x${string}` ``; `registry?`: `` `0x${string}` ``; \} | - |
| `addresses.gtoken?` | `` `0x${string}` `` | - |
| `addresses.registry?` | `` `0x${string}` `` | - |

#### Returns

`AnalyticsClient`

## Methods

### getRoleEntranceCost()

> **getRoleEntranceCost**(`roleId`): `Promise`\<\{ `entryBurn`: `bigint`; `exitFee`: \{ `minFee`: `bigint`; `percent`: `number`; \}; `minStake`: `bigint`; `totalRequired`: `bigint`; \}\>

Defined in: [index.ts:124](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/analytics/src/index.ts#L124)

Get role entrance cost breakdown

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `roleId` | `` `0x${string}` `` |

#### Returns

`Promise`\<\{ `entryBurn`: `bigint`; `exitFee`: \{ `minFee`: `bigint`; `percent`: `number`; \}; `minStake`: `bigint`; `totalRequired`: `bigint`; \}\>

#### Role Required

None (public view)

***

### getSupplyMetrics()

> **getSupplyMetrics**(): `Promise`\<\{ `cap`: `bigint`; `deflationRate`: `number`; `remainingMintable`: `bigint`; `totalLifetimeBurned`: `bigint`; `totalSupply`: `bigint`; \}\>

Defined in: [index.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/analytics/src/index.ts#L42)

Get complete supply metrics

#### Returns

`Promise`\<\{ `cap`: `bigint`; `deflationRate`: `number`; `remainingMintable`: `bigint`; `totalLifetimeBurned`: `bigint`; `totalSupply`: `bigint`; \}\>

#### Role Required

None (public view)

***

### subscribeToBurnEvents()

> **subscribeToBurnEvents**(`callback`): () => `void`

Defined in: [index.ts:90](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/analytics/src/index.ts#L90)

Subscribe to real-time burn events

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `callback` | (`event`) => `void` |

#### Returns

> (): `void`

##### Returns

`void`

#### Role Required

None (public events)
