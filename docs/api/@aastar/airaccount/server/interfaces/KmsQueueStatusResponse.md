Defined in: [packages/airaccount/src/server/services/kms-monitor-service.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-monitor-service.ts#L35)

KMS request-queue health, including circuit-breaker state. Useful for
back-pressure decisions before submitting signing operations.

## Properties

### circuit\_breaker\_open

> **circuit\_breaker\_open**: `boolean`

Defined in: [packages/airaccount/src/server/services/kms-monitor-service.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-monitor-service.ts#L38)

***

### consecutive\_failures

> **consecutive\_failures**: `number`

Defined in: [packages/airaccount/src/server/services/kms-monitor-service.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-monitor-service.ts#L39)

***

### estimated\_wait\_seconds

> **estimated\_wait\_seconds**: `number`

Defined in: [packages/airaccount/src/server/services/kms-monitor-service.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-monitor-service.ts#L37)

***

### queue\_depth

> **queue\_depth**: `number`

Defined in: [packages/airaccount/src/server/services/kms-monitor-service.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-monitor-service.ts#L36)
