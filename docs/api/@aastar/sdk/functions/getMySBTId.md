> **getMySBTId**(`client`, `sbtAddress`, `user`): `Promise`\<`bigint` \| `null`\>

Defined in: [packages/identity/src/mysbt.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/identity/src/mysbt.ts#L39)

Fetch MySBT token ID for a specific user.
MySBT exposes `getUserSBT(address) -> uint256` (alias of the `userToSBT`
mapping), which returns the user's tokenId or 0 when they hold no SBT.

Returns the tokenId, or `null` ONLY for the genuine "no SBT" sentinel (id == 0).
Read errors are NOT swallowed (see [checkMySBT](checkMySBT.md)): a transient RPC failure
must not be reported as "no SBT" (a false negative for eligibility). The error
propagates to the caller.

## Parameters

| Parameter | Type |
| ------ | ------ |
| `client` | `any` |
| `sbtAddress` | `` `0x${string}` `` |
| `user` | `` `0x${string}` `` |

## Returns

`Promise`\<`bigint` \| `null`\>
