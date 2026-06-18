Defined in: [PaymasterManager.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/paymaster/src/PaymasterManager.ts#L22)

Unified parameters for building `paymasterAndData`.

The byte layout differs by paymaster type; this shape carries the union of
both packers' inputs. `buildPaymasterData` validates that the fields required
for the resolved type are present, and dispatches to the correct existing
packer. Callers no longer need to know which format a given paymaster uses.

## Properties

### maxRate?

> `optional` **maxRate**: `bigint`

Defined in: [PaymasterManager.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/paymaster/src/PaymasterManager.ts#L46)

Optional max rate commitment (rug-pull protection). 'super' only.

***

### operator?

> `optional` **operator**: `` `0x${string}` ``

Defined in: [PaymasterManager.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/paymaster/src/PaymasterManager.ts#L44)

Operator address. Required for type 'super'.

***

### paymasterAddress

> **paymasterAddress**: `` `0x${string}` ``

Defined in: [PaymasterManager.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/paymaster/src/PaymasterManager.ts#L30)

Paymaster contract address (first 20 bytes of the layout).

***

### postOpGasLimit?

> `optional` **postOpGasLimit**: `bigint`

Defined in: [PaymasterManager.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/paymaster/src/PaymasterManager.ts#L34)

Paymaster postOp gas limit (16-byte field, both layouts).

***

### token?

> `optional` **token**: `` `0x${string}` ``

Defined in: [PaymasterManager.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/paymaster/src/PaymasterManager.ts#L38)

Gas token address. Required for type 'v4'.

***

### type?

> `optional` **type**: [`PaymasterType`](../type-aliases/PaymasterType.md)

Defined in: [PaymasterManager.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/paymaster/src/PaymasterManager.ts#L28)

Explicit paymaster type. Preferred over address-based heuristics.
If omitted, the type is resolved from `paymasterAddress` against the
manager's registered known-paymaster map (throws if unresolved).

***

### validityWindow?

> `optional` **validityWindow**: `number`

Defined in: [PaymasterManager.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/paymaster/src/PaymasterManager.ts#L40)

Validity window in seconds (used to compute validUntil/validAfter). 'v4' only.

***

### verificationGasLimit?

> `optional` **verificationGasLimit**: `bigint`

Defined in: [PaymasterManager.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/paymaster/src/PaymasterManager.ts#L32)

Paymaster verification gas limit (16-byte field, both layouts).
