> **getCommunities**(`network`): `object`

Defined in: [packages/core/src/contracts.ts:395](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/contracts.ts#L395)

Get registered communities

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"sepolia"` | Network name |

## Returns

Communities object

### aastar

> `readonly` **aastar**: `object`

AAStar Community - Test community for development (registered: 2025-11-01)

#### aastar.ensName

> `readonly` **ensName**: `"aastar.eth"` = `'aastar.eth'`

#### aastar.gasToken

> `readonly` **gasToken**: `` `0x${string}` `` = `TEST_TOKEN_ADDRESSES.aPNTs`

#### aastar.name

> `readonly` **name**: `"AAStar"` = `'AAStar'`

#### aastar.owner

> `readonly` **owner**: `"0x411BD567E46C0781248dbB6a9211891C032885e5"` = `COMMUNITY_OWNERS.aastarOwner`

#### aastar.stake

> `readonly` **stake**: `"50"` = `'50'`

### breadCommunity

> `readonly` **breadCommunity**: `object`

BreadCommunity - Test community for development (registered: 2025-11-03)

#### breadCommunity.ensName

> `readonly` **ensName**: `"bread.eth"` = `'bread.eth'`

#### breadCommunity.gasToken

> `readonly` **gasToken**: `` `0x${string}` `` = `TEST_TOKEN_ADDRESSES.bPNTs`

#### breadCommunity.name

> `readonly` **name**: `"BreadCommunity"` = `'BreadCommunity'`

#### breadCommunity.owner

> `readonly` **owner**: `"0xe24b6f321B0140716a2b671ed0D983bb64E7DaFA"` = `COMMUNITY_OWNERS.breadCommunityOwner`

#### breadCommunity.stake

> `readonly` **stake**: `"50"` = `'50'`

## Example

```ts
const communities = getCommunities('sepolia');
console.log(communities.aastar.owner);
```
