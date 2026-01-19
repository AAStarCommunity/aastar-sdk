> `const` **ROLE\_DVT**: [`Hash`](https://viem.sh/docs/index.html)

Defined in: [packages/core/src/roles.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/roles.ts#L73)

DVT Role (Distributed Validator Technology)

## Description

DVT node operator for consensus validation

## Permission

Infrastructure operator

## Requirement

minStake: 30 GT, entryBurn: 3 GT (line 94)

## Exit Fee

10% (1000 basis points), min 1 GT

## Lock Duration

30 days

## Source

Registry.sol line 36: ROLE_DVT = keccak256("DVT")
