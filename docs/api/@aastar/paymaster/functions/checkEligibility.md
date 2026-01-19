> **checkEligibility**(`client`, `paymaster`, `user`, `operator`): `Promise`\<\{ `credit?`: `bigint`; `eligible`: `boolean`; `token?`: `` `0x${string}` ``; \}\>

Defined in: [SuperPaymaster/index.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/paymaster/src/SuperPaymaster/index.ts#L49)

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
