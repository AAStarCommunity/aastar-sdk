Defined in: [packages/core/src/transports/helios.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/transports/helios.ts#L31)

## Properties

### consensusRpcUrl

> **consensusRpcUrl**: `string`

Defined in: [packages/core/src/transports/helios.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/transports/helios.ts#L42)

Consensus-layer REST beacon URL (used for light client sync).
Example: "https://www.lightclientdata.org"

***

### executionRpcUrl

> **executionRpcUrl**: `string`

Defined in: [packages/core/src/transports/helios.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/transports/helios.ts#L36)

Execution-layer JSON-RPC URL (used for historical state, mempool).
Example: "https://eth.llamarpc.com"

***

### network?

> `optional` **network**: `"mainnet"` \| `"sepolia"`

Defined in: [packages/core/src/transports/helios.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/transports/helios.ts#L47)

Network name. Defaults to "mainnet". Also accepts "sepolia".

***

### transportConfig?

> `optional` **transportConfig**: [`CustomTransportConfig`](https://viem.sh/docs/index.html)

Defined in: [packages/core/src/transports/helios.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/transports/helios.ts#L52)

Options forwarded to viem's custom() transport (timeout, retryCount, etc.)
