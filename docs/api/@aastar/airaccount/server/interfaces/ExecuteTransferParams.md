Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:85](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/transfer-manager.ts#L85)

## Properties

### amount

> **amount**: `string`

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:87](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/transfer-manager.ts#L87)

***

### data?

> `optional` **data**: `string`

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:88](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/transfer-manager.ts#L88)

***

### guardianSigner?

> `optional` **guardianSigner**: `GuardianSigner`

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:101](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/transfer-manager.ts#L101)

Guardian signer instance. Required for AirAccount Tier 3.

***

### p256Signature?

> `optional` **p256Signature**: `string`

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:99](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/transfer-manager.ts#L99)

P256 passkey signature (64 bytes hex). Required for AirAccount Tier 2/3.

***

### passkeyAssertion?

> `optional` **passkeyAssertion**: [`LegacyPasskeyAssertion`](LegacyPasskeyAssertion.md)

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:97](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/transfer-manager.ts#L97)

***

### paymasterAddress?

> `optional` **paymasterAddress**: `string`

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:91](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/transfer-manager.ts#L91)

***

### paymasterData?

> `optional` **paymasterData**: `string`

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:92](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/transfer-manager.ts#L92)

***

### paymasterTokenAddress?

> `optional` **paymasterTokenAddress**: `string`

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:96](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/transfer-manager.ts#L96)

ERC-20 token address for deposit-pull paymasters (e.g. PMv4) that require
 the gas token address appended to paymasterData. Used when the paymaster
 contract does not expose a public token() getter for auto-detection.

***

### to

> **to**: `string`

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:86](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/transfer-manager.ts#L86)

***

### tokenAddress?

> `optional` **tokenAddress**: `string`

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/transfer-manager.ts#L89)

***

### useAirAccountTiering?

> `optional` **useAirAccountTiering**: `boolean`

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:103](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/transfer-manager.ts#L103)

Enable AirAccount tiered signature routing. Default: false (legacy BLS-only).

***

### usePaymaster?

> `optional` **usePaymaster**: `boolean`

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:90](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/transfer-manager.ts#L90)

***

### wrapExecuteUserOp?

> `optional` **wrapExecuteUserOp**: `boolean`

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:110](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/transfer-manager.ts#L110)

Wrap the execute()/executeBatch() callData with the `executeUserOp` selector
(v0.17.2-beta.4 bundler-compat). REQUIRED for guard-enabled accounts submitted
through a standard ERC-4337 bundler; the account re-derives the signature algId
in-frame. Default: false. No-guard accounts and owner-direct calls leave it off.
