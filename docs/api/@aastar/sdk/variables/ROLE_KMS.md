```ts
const ROLE_KMS: Hash;
```

Defined in: [packages/core/src/roles.ts:105](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/roles.ts#L105)

KMS Role (Key Management Service)

## Remarks

- **Description**: KMS operator for secure key storage and management
- **Permission**: Infrastructure operator (highest stake)
- **Requirement**: minStake: 100 GT, entryBurn: 10 GT (line 98)
- **Exit Fee**: 10% (1000 basis points), min 5 GT
- **Lock Duration**: 30 days
- **Source**: Registry.sol line 38: ROLE_KMS = keccak256("KMS")
