Defined in: [packages/airaccount/src/server/services/agent-registry-service.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/agent-registry-service.ts#L46)

## Properties

### agentId

> **agentId**: `string`

Defined in: [packages/airaccount/src/server/services/agent-registry-service.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/agent-registry-service.ts#L50)

ERC-8004-style agent identifier (bytes32) binding this account to an off-chain identity.

***

### agentKey

> **agentKey**: `string`

Defined in: [packages/airaccount/src/server/services/agent-registry-service.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/agent-registry-service.ts#L48)

The agent's own signing key (EOA controlled by the agent runtime / KMS).

***

### agentKeySig

> **agentKeySig**: `string`

Defined in: [packages/airaccount/src/server/services/agent-registry-service.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/agent-registry-service.ts#L56)

The agent key's acceptance signature over the creation hash (EIP-191).

***

### dailyLimit

> **dailyLimit**: `bigint`

Defined in: [packages/airaccount/src/server/services/agent-registry-service.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/agent-registry-service.ts#L60)

Daily transfer limit in wei (on-chain guard enforcement; V7 requires > 0).

***

### deadline

> **deadline**: `number` \| `bigint`

Defined in: [packages/airaccount/src/server/services/agent-registry-service.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/agent-registry-service.ts#L58)

Unix timestamp (uint48) after which the signatures are rejected.

***

### guardian2

> **guardian2**: `string`

Defined in: [packages/airaccount/src/server/services/agent-registry-service.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/agent-registry-service.ts#L52)

The human guardian (guardian2) co-owning the agent account for recovery.

***

### guardian2Sig

> **guardian2Sig**: `string`

Defined in: [packages/airaccount/src/server/services/agent-registry-service.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/agent-registry-service.ts#L54)

Guardian2's acceptance signature over the creation hash (EIP-191).
