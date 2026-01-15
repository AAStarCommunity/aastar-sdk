```ts
function getCommunities(network): object;
```

Defined in: [packages/core/src/contracts.ts:395](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contracts.ts#L395)

Get registered communities

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"sepolia"` | Network name |

## Returns

Communities object

| Name | Type | Default value | Description | Defined in |
| ------ | ------ | ------ | ------ | ------ |
| `aastar` | `object` | - | AAStar Community - Test community for development (registered: 2025-11-01) | [packages/core/src/contracts.ts:79](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contracts.ts#L79) |
| `aastar.ensName` | `"aastar.eth"` | `'aastar.eth'` | - | [packages/core/src/contracts.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contracts.ts#L82) |
| `aastar.gasToken` | `` `0x${string}` `` | `TEST_TOKEN_ADDRESSES.apnts` | - | [packages/core/src/contracts.ts:81](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contracts.ts#L81) |
| `aastar.name` | `"AAStar"` | `'AAStar'` | - | [packages/core/src/contracts.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contracts.ts#L83) |
| `aastar.owner` | `"0x411BD567E46C0781248dbB6a9211891C032885e5"` | `COMMUNITY_OWNERS.aastarOwner` | - | [packages/core/src/contracts.ts:80](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contracts.ts#L80) |
| `aastar.stake` | `"50"` | `'50'` | - | [packages/core/src/contracts.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contracts.ts#L84) |
| `breadCommunity` | `object` | - | BreadCommunity - Test community for development (registered: 2025-11-03) | [packages/core/src/contracts.ts:88](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contracts.ts#L88) |
| `breadCommunity.ensName` | `"bread.eth"` | `'bread.eth'` | - | [packages/core/src/contracts.ts:91](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contracts.ts#L91) |
| `breadCommunity.gasToken` | `` `0x${string}` `` | `TEST_TOKEN_ADDRESSES.bpnts` | - | [packages/core/src/contracts.ts:90](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contracts.ts#L90) |
| `breadCommunity.name` | `"BreadCommunity"` | `'BreadCommunity'` | - | [packages/core/src/contracts.ts:92](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contracts.ts#L92) |
| `breadCommunity.owner` | `"0xe24b6f321B0140716a2b671ed0D983bb64E7DaFA"` | `COMMUNITY_OWNERS.breadCommunityOwner` | - | [packages/core/src/contracts.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contracts.ts#L89) |
| `breadCommunity.stake` | `"50"` | `'50'` | - | [packages/core/src/contracts.ts:93](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contracts.ts#L93) |

## Example

```ts
const communities = getCommunities('sepolia');
console.log(communities.aastar.owner);
```
