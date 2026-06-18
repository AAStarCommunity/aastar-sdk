> **PackedUserOperation** = `object`

Defined in: [packages/core/src/actions/superPaymaster.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/superPaymaster.ts#L11)

ERC-4337 v0.7 PackedUserOperation tuple, matching the `struct PackedUserOperation`
input of `dryRunValidation` / `validatePaymasterUserOp` in the SuperPaymaster ABI.
Field order is load-bearing: viem encodes the tuple positionally from this shape.

## Properties

### accountGasLimits

> **accountGasLimits**: [`Hex`](https://viem.sh/docs/index.html)

Defined in: [packages/core/src/actions/superPaymaster.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/superPaymaster.ts#L16)

***

### callData

> **callData**: [`Hex`](https://viem.sh/docs/index.html)

Defined in: [packages/core/src/actions/superPaymaster.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/superPaymaster.ts#L15)

***

### gasFees

> **gasFees**: [`Hex`](https://viem.sh/docs/index.html)

Defined in: [packages/core/src/actions/superPaymaster.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/superPaymaster.ts#L18)

***

### initCode

> **initCode**: [`Hex`](https://viem.sh/docs/index.html)

Defined in: [packages/core/src/actions/superPaymaster.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/superPaymaster.ts#L14)

***

### nonce

> **nonce**: `bigint`

Defined in: [packages/core/src/actions/superPaymaster.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/superPaymaster.ts#L13)

***

### paymasterAndData

> **paymasterAndData**: [`Hex`](https://viem.sh/docs/index.html)

Defined in: [packages/core/src/actions/superPaymaster.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/superPaymaster.ts#L19)

***

### preVerificationGas

> **preVerificationGas**: `bigint`

Defined in: [packages/core/src/actions/superPaymaster.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/superPaymaster.ts#L17)

***

### sender

> **sender**: `Address`

Defined in: [packages/core/src/actions/superPaymaster.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/superPaymaster.ts#L12)

***

### signature

> **signature**: [`Hex`](https://viem.sh/docs/index.html)

Defined in: [packages/core/src/actions/superPaymaster.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/superPaymaster.ts#L20)
