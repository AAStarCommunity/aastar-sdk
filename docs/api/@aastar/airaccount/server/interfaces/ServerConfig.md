Defined in: [packages/airaccount/src/server/config.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/config.ts#L18)

Server SDK configuration — replaces NestJS ConfigService.

## Properties

### blsDiscoveryTimeout?

> `optional` **blsDiscoveryTimeout**: `number`

Defined in: [packages/airaccount/src/server/config.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/config.ts#L39)

Timeout for BLS node discovery in ms.

***

### blsSeedNodes?

> `optional` **blsSeedNodes**: `string`[]

Defined in: [packages/airaccount/src/server/config.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/config.ts#L37)

BLS signer seed nodes for gossip discovery.

***

### bundlerRpcUrl

> **bundlerRpcUrl**: `string`

Defined in: [packages/airaccount/src/server/config.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/config.ts#L22)

Bundler RPC URL (e.g. Pimlico, StackUp).

***

### chainId

> **chainId**: `number`

Defined in: [packages/airaccount/src/server/config.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/config.ts#L24)

Chain ID of the target network.

***

### defaultVersion?

> `optional` **defaultVersion**: `"0.6"` \| `"0.7"` \| `"0.8"`

Defined in: [packages/airaccount/src/server/config.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/config.ts#L34)

Default EntryPoint version to use when not specified.

***

### entryPoints

> **entryPoints**: `object`

Defined in: [packages/airaccount/src/server/config.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/config.ts#L27)

EntryPoint configurations — at least one version must be provided.

#### v06?

> `optional` **v06**: [`EntryPointVersionConfig`](EntryPointVersionConfig.md)

#### v07?

> `optional` **v07**: [`EntryPointVersionConfig`](EntryPointVersionConfig.md)

#### v08?

> `optional` **v08**: [`EntryPointVersionConfig`](EntryPointVersionConfig.md)

***

### kmsApiKey?

> `optional` **kmsApiKey**: `string`

Defined in: [packages/airaccount/src/server/config.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/config.ts#L46)

KMS API key for authenticated requests.

***

### kmsEnabled?

> `optional` **kmsEnabled**: `boolean`

Defined in: [packages/airaccount/src/server/config.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/config.ts#L44)

Whether KMS signing is enabled.

***

### kmsEndpoint?

> `optional` **kmsEndpoint**: `string`

Defined in: [packages/airaccount/src/server/config.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/config.ts#L42)

KMS endpoint URL (optional, for KMS-based signing).

***

### logger?

> `optional` **logger**: [`ILogger`](ILogger.md)

Defined in: [packages/airaccount/src/server/config.ts:53](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/config.ts#L53)

Logger (optional, defaults to ConsoleLogger).

***

### rpcUrl

> **rpcUrl**: `string`

Defined in: [packages/airaccount/src/server/config.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/config.ts#L20)

Main network RPC URL.

***

### signer

> **signer**: [`ISignerAdapter`](ISignerAdapter.md)

Defined in: [packages/airaccount/src/server/config.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/config.ts#L51)

Signer adapter (required).

***

### storage

> **storage**: [`IStorageAdapter`](IStorageAdapter.md)

Defined in: [packages/airaccount/src/server/config.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/config.ts#L49)

Storage adapter (required).
