```ts
const ROLE_ANODE: Hash;
```

Defined in: [packages/core/src/roles.ts:93](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/roles.ts#L93)

ANODE Role (Anonymous Node)

## Remarks

- **Description**: Anonymous infrastructure node operator
- **Permission**: Infrastructure operator
- **Requirement**: minStake: 20 GT, entryBurn: 2 GT (line 95)
- **Exit Fee**: 10% (1000 basis points), min 1 GT
- **Lock Duration**: 30 days
- **Source**: Registry.sol line 37: ROLE_ANODE = keccak256("ANODE")
