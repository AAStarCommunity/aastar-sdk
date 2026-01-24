> **getMySBTId**(`client`, `sbtAddress`, `user`): `Promise`\<`bigint` \| `null`\>

Defined in: [mysbt.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/identity/src/mysbt.ts#L35)

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
