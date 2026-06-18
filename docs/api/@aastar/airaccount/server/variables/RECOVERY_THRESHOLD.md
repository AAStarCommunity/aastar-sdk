> `const` **RECOVERY\_THRESHOLD**: `2` = `2`

Defined in: [packages/airaccount/src/server/services/recovery-service.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/recovery-service.ts#L30)

RECOVERY_THRESHOLD — number of distinct guardian approvals required to recover
(or to cancel a recovery). The contract hard-codes `RECOVERY_THRESHOLD = 2`
against a maximum of 3 guardians, i.e. a 2-of-3 social-recovery scheme.

Source of truth: `AAStarAirAccountBase.RECOVERY_THRESHOLD` (internal constant).
