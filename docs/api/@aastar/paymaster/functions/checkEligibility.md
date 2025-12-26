> **checkEligibility**(`client`, `paymaster`, `user`, `operator`): `Promise`\<\{ `credit?`: `bigint`; `eligible`: `boolean`; `token?`: `` `0x${string}` ``; \}\>

Defined in: [SuperPaymaster/index.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/paymaster/src/SuperPaymaster/index.ts#L47)

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
