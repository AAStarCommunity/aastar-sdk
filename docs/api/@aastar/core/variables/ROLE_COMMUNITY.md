> `const` **ROLE\_COMMUNITY**: [`Hash`](https://viem.sh/docs/index.html)

Defined in: [packages/core/src/roles.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/roles.ts#L27)

Community Role

## Description

Community administrator, can issue xPNTs, configure SBT rules

## Permission

Community-level governance

## Requirement

minStake: 30 GT, entryBurn: 3 GT (line 99)

## Exit Fee

5% (500 basis points), min 1 GT

## Lock Duration

30 days

## Source

Registry.sol line 32: ROLE_COMMUNITY = keccak256("COMMUNITY")
