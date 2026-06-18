> **OperatorMode** = `"AOA"` \| `"AOA+"`

Defined in: [packages/core/src/requirementChecker.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/requirementChecker.ts#L20)

Operator onboarding mode (matches the codebase's paymaster model).
- `AOA`  — an INDEPENDENT paymaster operator running their own PaymasterV4
  (role `ROLE_PAYMASTER_AOA`). Readiness = that role + a GToken role stake.
- `AOA+` — a SHARED SuperPaymaster operator (role `ROLE_PAYMASTER_SUPER`).
  Readiness = that role + a GToken role stake + a community-issued SBT.

In both modes the "stake" is the on-chain `getRoleStake(roleId, operator)`
recorded by the Registry — NOT the operator's plain GToken wallet balance.
