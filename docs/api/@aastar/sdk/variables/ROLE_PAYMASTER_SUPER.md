```ts
const ROLE_PAYMASTER_SUPER: Hash;
```

Defined in: [packages/core/src/roles.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/roles.ts#L69)

Paymaster Super Role

## Remarks

- **Description**: Advanced Paymaster operator, can use SuperPaymaster with aPNTs collateral
- **Permission**: Infrastructure operator (higher tier)
- **Requirement**: minStake: 50 GT, entryBurn: 5 GT (line 93)
- **Additional Requirement**: aPNTs collateral in SuperPaymaster contract
- **Exit Fee**: 10% (1000 basis points), min 2 GT
- **Lock Duration**: 30 days
- **Source**: Registry.sol line 35: ROLE_PAYMASTER_SUPER = keccak256("PAYMASTER_SUPER")
