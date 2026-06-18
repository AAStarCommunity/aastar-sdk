> `const` **ROLE\_ANODE**: [`Hash`](https://viem.sh/docs/index.html)

Defined in: [packages/core/src/roles.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/roles.ts#L84)

ANODE Role (Anonymous Node)

## Description

Anonymous infrastructure node operator

## Permission

Infrastructure operator

## Requirement

minStake: 20 GT, ticketPrice: 2 GT (line 95)

## Exit Fee

10% (1000 basis points), min 1 GT

## Lock Duration

30 days

## Source

Registry.sol line 37: ROLE_ANODE = keccak256("ANODE")
