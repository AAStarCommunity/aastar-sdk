> `const` **ROLE\_COMMUNITY**: [`Hash`](https://viem.sh/docs/index.html)

Defined in: [packages/core/src/roles.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/roles.ts#L27)

Community Role

## Description

Community administrator, can issue xPNTs, configure SBT rules

## Permission

Community-level governance

## Requirement

minStake: 30 GT, ticketPrice: 3 GT (line 99)

## Exit Fee

5% (500 basis points), min 1 GT

## Lock Duration

30 days

## Source

Registry.sol line 32: ROLE_COMMUNITY = keccak256("COMMUNITY")
