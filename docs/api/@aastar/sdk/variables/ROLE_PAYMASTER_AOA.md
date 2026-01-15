```ts
const ROLE_PAYMASTER_AOA: Hash;
```

Defined in: [packages/core/src/roles.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/roles.ts#L56)

Paymaster AOA Role (Account Ownership Authentication)

## Remarks

- **Description**: Basic Paymaster node operator with account-based auth
- **Permission**: Infrastructure operator
- **Requirement**: minStake: 30 GT, entryBurn: 3 GT (line 92)
- **Exit Fee**: 10% (1000 basis points), min 1 GT
- **Lock Duration**: 30 days
- **Source**: Registry.sol line 34: ROLE_PAYMASTER_AOA = keccak256("PAYMASTER_AOA")
