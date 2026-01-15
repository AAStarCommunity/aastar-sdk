> `const` **ROLE\_DVT**: [`Hash`](https://viem.sh/docs/index.html)

Defined in: [packages/core/src/roles.ts:81](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/roles.ts#L81)

DVT Role (Distributed Validator Technology)

## Remarks

- **Description**: DVT node operator for consensus validation
- **Permission**: Infrastructure operator
- **Requirement**: minStake: 30 GT, entryBurn: 3 GT (line 94)
- **Exit Fee**: 10% (1000 basis points), min 1 GT
- **Lock Duration**: 30 days
- **Source**: Registry.sol line 36: ROLE_DVT = keccak256("DVT")
