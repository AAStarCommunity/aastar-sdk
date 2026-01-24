> `const` **ROLE\_ENDUSER**: [`Hash`](https://viem.sh/docs/index.html)

Defined in: [packages/core/src/roles.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/roles.ts#L39)

End User Role

## Description

Community member, can participate and use gasless transactions

## Permission

Basic user level

## Requirement

minStake: 0.3 GT, entryBurn: 0.05 GT (line 100)

## Additional Requirement

Must hold MySBT from community

## Exit Fee

10% (1000 basis points), min 0.05 GT

## Lock Duration

7 days

## Source

Registry.sol line 33: ROLE_ENDUSER = keccak256("ENDUSER")
