Defined in: [packages/airaccount/src/server/services/guard-state-reader.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/guard-state-reader.ts#L20)

## Properties

### currentTier

> **currentTier**: `TierLevel`

Defined in: [packages/airaccount/src/server/services/guard-state-reader.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/guard-state-reader.ts#L28)

Current tier based on spent amount

***

### dailyLimit

> **dailyLimit**: `bigint`

Defined in: [packages/airaccount/src/server/services/guard-state-reader.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/guard-state-reader.ts#L22)

ETH daily limit in wei

***

### guardAddress

> **guardAddress**: `string`

Defined in: [packages/airaccount/src/server/services/guard-state-reader.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/guard-state-reader.ts#L36)

Guard contract address

***

### minDailyLimit

> **minDailyLimit**: `bigint`

Defined in: [packages/airaccount/src/server/services/guard-state-reader.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/guard-state-reader.ts#L34)

Minimum daily limit floor (cannot decrease below this)

***

### remaining

> **remaining**: `bigint`

Defined in: [packages/airaccount/src/server/services/guard-state-reader.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/guard-state-reader.ts#L26)

ETH remaining for today in wei

***

### tier1Limit

> **tier1Limit**: `bigint`

Defined in: [packages/airaccount/src/server/services/guard-state-reader.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/guard-state-reader.ts#L30)

Tier 1 max spend threshold in wei (single sig)

***

### tier2Limit

> **tier2Limit**: `bigint`

Defined in: [packages/airaccount/src/server/services/guard-state-reader.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/guard-state-reader.ts#L32)

Tier 2 max spend threshold in wei (dual sig)

***

### todaySpent

> **todaySpent**: `bigint`

Defined in: [packages/airaccount/src/server/services/guard-state-reader.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/guard-state-reader.ts#L24)

ETH already spent today in wei
