> `const` **ROLE\_COMMUNITY**: [`Hash`](https://viem.sh/docs/index.html)

Defined in: [packages/core/src/roles.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/ee2dd989851034f323f1aad02b8ecb5fe586602a/packages/core/src/roles.ts#L31)

Community Role

## Remarks

- **Description**: Community administrator, can issue xPNTs, configure SBT rules
- **Permission**: Community-level governance
- **Requirement**: minStake: 30 GT, entryBurn: 3 GT (line 99)
- **Exit Fee**: 5% (500 basis points), min 1 GT
- **Lock Duration**: 30 days
- **Source**: Registry.sol line 32: ROLE_COMMUNITY = keccak256("COMMUNITY")
