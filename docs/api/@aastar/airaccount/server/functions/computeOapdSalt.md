> **computeOapdSalt**(`owner`, `dappId`): `bigint`

Defined in: [packages/airaccount/src/server/utils/oapd.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/utils/oapd.ts#L52)

Compute the numeric salt for an OAPD address.
salt = uint256(keccak256(abi.encodePacked(owner, dappId)))

## Parameters

| Parameter | Type |
| ------ | ------ |
| `owner` | `string` |
| `dappId` | `string` |

## Returns

`bigint`
