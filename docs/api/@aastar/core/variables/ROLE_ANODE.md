```ts
const ROLE_ANODE: Hash;
```

Defined in: [packages/core/src/roles.ts:93](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/roles.ts#L93)

ANODE Role (Anonymous Node)

## Remarks

- **Description**: Anonymous infrastructure node operator
- **Permission**: Infrastructure operator
- **Requirement**: minStake: 20 GT, entryBurn: 2 GT (line 95)
- **Exit Fee**: 10% (1000 basis points), min 1 GT
- **Lock Duration**: 30 days
- **Source**: Registry.sol line 37: ROLE_ANODE = keccak256("ANODE")
