> **checkEligibility**(`client`, `paymaster`, `user`, `operator`): `Promise`\<\{ `credit?`: `bigint`; `eligible`: `boolean`; `token?`: `` `0x${string}` ``; \}\>

Defined in: [packages/paymaster/src/SuperPaymaster/index.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/paymaster/src/SuperPaymaster/index.ts#L49)

Enhanced eligibility check for SuperPaymaster V3.
Validates that user has sufficient credit with the given operator.

## Parameters

| Parameter | Type |
| ------ | ------ |
| `client` | `any` |
| `paymaster` | `` `0x${string}` `` |
| `user` | `` `0x${string}` `` |
| `operator` | `` `0x${string}` `` |

## Returns

`Promise`\<\{ `credit?`: `bigint`; `eligible`: `boolean`; `token?`: `` `0x${string}` ``; \}\>
