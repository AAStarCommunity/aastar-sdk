> **checkEligibility**(`client`, `paymaster`, `user`, `operator`): `Promise`\<\{ `credit?`: `bigint`; `eligible`: `boolean`; `token?`: `` `0x${string}` ``; \}\>

Defined in: [packages/paymaster/src/AOA-Plus/index.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/4d5be576edce490d7405a108d648a390d96f3eb5/packages/paymaster/src/AOA-Plus/index.ts#L47)

Enhanced eligibility check for SuperPaymaster V3.
Validates that user has sufficient credit with the given operator.

## Parameters

### client

`any`

### paymaster

`` `0x${string}` ``

### user

`` `0x${string}` ``

### operator

`` `0x${string}` ``

## Returns

`Promise`\<\{ `credit?`: `bigint`; `eligible`: `boolean`; `token?`: `` `0x${string}` ``; \}\>
