> `const` **ROLE\_KMS**: [`Hash`](https://viem.sh/docs/index.html)

Defined in: [packages/core/src/roles.ts:95](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/roles.ts#L95)

KMS Role (Key Management Service)

## Description

KMS operator for secure key storage and management

## Permission

Infrastructure operator (highest stake)

## Requirement

minStake: 100 GT, entryBurn: 10 GT (line 98)

## Exit Fee

10% (1000 basis points), min 5 GT

## Lock Duration

30 days

## Source

Registry.sol line 38: ROLE_KMS = keccak256("KMS")
