Defined in: [packages/airaccount/src/server/services/erc8004-service.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/erc8004-service.ts#L63)

## Properties

### agentId

> **agentId**: `bigint`

Defined in: [packages/airaccount/src/server/services/erc8004-service.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/erc8004-service.ts#L66)

***

### agentWallet

> **agentWallet**: `string`

Defined in: [packages/airaccount/src/server/services/erc8004-service.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/erc8004-service.ts#L67)

***

### deadline

> **deadline**: `bigint`

Defined in: [packages/airaccount/src/server/services/erc8004-service.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/erc8004-service.ts#L69)

Unix timestamp — signature becomes invalid after this deadline

***

### identityRegistry

> **identityRegistry**: `string`

Defined in: [packages/airaccount/src/server/services/erc8004-service.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/erc8004-service.ts#L65)

Must be the official ERC-8004 identity registry for this chain

***

### signature

> **signature**: `string`

Defined in: [packages/airaccount/src/server/services/erc8004-service.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/erc8004-service.ts#L71)

Signature authorising the wallet binding, signed by the identity registry's expected signer
