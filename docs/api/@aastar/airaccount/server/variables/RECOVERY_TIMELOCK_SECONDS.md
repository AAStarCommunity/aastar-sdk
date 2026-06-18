> `const` **RECOVERY\_TIMELOCK\_SECONDS**: `bigint`

Defined in: [packages/airaccount/src/server/services/recovery-service.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/recovery-service.ts#L48)

RECOVERY_TIMELOCK_SECONDS — delay between `proposeRecovery` and the earliest
`executeRecovery`. The contract hard-codes `RECOVERY_TIMELOCK = 2 days`
(172800 seconds).

NOTE: the prose in `docs/abi/capabilities.md` says "72h"; the deployed
contract uses 2 days (48h). The on-chain constant is authoritative.

Source of truth: `AAStarAirAccountBase.RECOVERY_TIMELOCK` (internal constant).
