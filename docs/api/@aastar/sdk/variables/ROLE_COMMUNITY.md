```ts
const ROLE_COMMUNITY: Hash;
```

Defined in: [packages/core/src/roles.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/roles.ts#L31)

Community Role

## Remarks

- **Description**: Community administrator, can issue xPNTs, configure SBT rules
- **Permission**: Community-level governance
- **Requirement**: minStake: 30 GT, entryBurn: 3 GT (line 99)
- **Exit Fee**: 5% (500 basis points), min 1 GT
- **Lock Duration**: 30 days
- **Source**: Registry.sol line 32: ROLE_COMMUNITY = keccak256("COMMUNITY")
