> `const` **ROLE\_ANODE**: [`Hash`](https://viem.sh/docs/index.html)

Defined in: [packages/core/src/roles.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/roles.ts#L84)

ANODE Role (Anonymous Node)

## Description

Anonymous infrastructure node operator

## Permission

Infrastructure operator

## Requirement

minStake: 20 GT, entryBurn: 2 GT (line 95)

## Exit Fee

10% (1000 basis points), min 1 GT

## Lock Duration

30 days

## Source

Registry.sol line 37: ROLE_ANODE = keccak256("ANODE")
