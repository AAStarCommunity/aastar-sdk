Defined in: [packages/airaccount/src/server/services/eip7702-delegate-service.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/eip7702-delegate-service.ts#L51)

## Properties

### address

> **address**: `string`

Defined in: [packages/airaccount/src/server/services/eip7702-delegate-service.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/eip7702-delegate-service.ts#L55)

The delegation target — AirAccountDelegate singleton address

***

### chainId

> **chainId**: `number`

Defined in: [packages/airaccount/src/server/services/eip7702-delegate-service.ts:53](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/eip7702-delegate-service.ts#L53)

Chain ID (e.g. 11155111 for Sepolia)

***

### nonce

> **nonce**: `bigint`

Defined in: [packages/airaccount/src/server/services/eip7702-delegate-service.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/eip7702-delegate-service.ts#L57)

EOA nonce at time of signing

***

### signature

> **signature**: `string`

Defined in: [packages/airaccount/src/server/services/eip7702-delegate-service.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/eip7702-delegate-service.ts#L59)

Signature over the EIP-7702 authorization hash (65 bytes, R||S||V)
