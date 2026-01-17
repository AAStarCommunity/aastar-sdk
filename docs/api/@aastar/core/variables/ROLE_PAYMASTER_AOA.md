> `const` **ROLE\_PAYMASTER\_AOA**: [`Hash`](https://viem.sh/docs/index.html)

Defined in: [packages/core/src/roles.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/roles.ts#L50)

Paymaster AOA Role (Account Ownership Authentication)

## Description

Basic Paymaster node operator with account-based auth

## Permission

Infrastructure operator

## Requirement

minStake: 30 GT, entryBurn: 3 GT (line 92)

## Exit Fee

10% (1000 basis points), min 1 GT

## Lock Duration

30 days

## Source

Registry.sol line 34: ROLE_PAYMASTER_AOA = keccak256("PAYMASTER_AOA")
