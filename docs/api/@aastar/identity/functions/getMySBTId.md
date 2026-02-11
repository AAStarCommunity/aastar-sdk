> **getMySBTId**(`client`, `sbtAddress`, `user`): `Promise`\<`bigint` \| `null`\>

Defined in: [mysbt.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/identity/src/mysbt.ts#L35)

Fetch MySBT token ID for a specific user (if unique/SBT).
Note: Depends on whether the contract supports getTokenId or similar.

## Parameters

| Parameter | Type |
| ------ | ------ |
| `client` | `any` |
| `sbtAddress` | `` `0x${string}` `` |
| `user` | `` `0x${string}` `` |

## Returns

`Promise`\<`bigint` \| `null`\>
