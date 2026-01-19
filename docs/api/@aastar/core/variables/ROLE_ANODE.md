> `const` **ROLE\_ANODE**: [`Hash`](https://viem.sh/docs/index.html)

Defined in: [packages/core/src/roles.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/roles.ts#L84)

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
