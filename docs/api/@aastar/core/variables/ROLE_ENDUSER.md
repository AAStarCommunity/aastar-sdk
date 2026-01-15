```ts
const ROLE_ENDUSER: Hash;
```

Defined in: [packages/core/src/roles.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/roles.ts#L44)

End User Role

## Remarks

- **Description**: Community member, can participate and use gasless transactions
- **Permission**: Basic user level
- **Requirement**: minStake: 0.3 GT, entryBurn: 0.05 GT (line 100)
- **Additional Requirement**: Must hold MySBT from community
- **Exit Fee**: 10% (1000 basis points), min 0.05 GT
- **Lock Duration**: 7 days
- **Source**: Registry.sol line 33: ROLE_ENDUSER = keccak256("ENDUSER")
