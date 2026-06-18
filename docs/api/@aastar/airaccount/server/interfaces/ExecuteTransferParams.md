Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/transfer-manager.ts#L84)

## Properties

### amount

> **amount**: `string`

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:86](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/transfer-manager.ts#L86)

***

### data?

> `optional` **data**: `string`

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:87](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/transfer-manager.ts#L87)

***

### guardianSigner?

> `optional` **guardianSigner**: `GuardianSigner`

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:100](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/transfer-manager.ts#L100)

Guardian signer instance. Required for AirAccount Tier 3.

***

### p256Signature?

> `optional` **p256Signature**: `string`

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:98](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/transfer-manager.ts#L98)

P256 passkey signature (64 bytes hex). Required for AirAccount Tier 2/3.

***

### passkeyAssertion?

> `optional` **passkeyAssertion**: [`LegacyPasskeyAssertion`](LegacyPasskeyAssertion.md)

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:96](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/transfer-manager.ts#L96)

***

### paymasterAddress?

> `optional` **paymasterAddress**: `string`

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:90](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/transfer-manager.ts#L90)

***

### paymasterData?

> `optional` **paymasterData**: `string`

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:91](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/transfer-manager.ts#L91)

***

### paymasterTokenAddress?

> `optional` **paymasterTokenAddress**: `string`

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:95](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/transfer-manager.ts#L95)

ERC-20 token address for deposit-pull paymasters (e.g. PMv4) that require
 the gas token address appended to paymasterData. Used when the paymaster
 contract does not expose a public token() getter for auto-detection.

***

### to

> **to**: `string`

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:85](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/transfer-manager.ts#L85)

***

### tokenAddress?

> `optional` **tokenAddress**: `string`

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:88](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/transfer-manager.ts#L88)

***

### useAirAccountTiering?

> `optional` **useAirAccountTiering**: `boolean`

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:102](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/transfer-manager.ts#L102)

Enable AirAccount tiered signature routing. Default: false (legacy BLS-only).

***

### usePaymaster?

> `optional` **usePaymaster**: `boolean`

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/transfer-manager.ts#L89)

***

### wrapExecuteUserOp?

> `optional` **wrapExecuteUserOp**: `boolean`

Defined in: [packages/airaccount/src/server/services/transfer-manager.ts:109](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/transfer-manager.ts#L109)

Wrap the execute()/executeBatch() callData with the `executeUserOp` selector
(v0.17.2-beta.4 bundler-compat). REQUIRED for guard-enabled accounts submitted
through a standard ERC-4337 bundler; the account re-derives the signature algId
in-frame. Default: false. No-guard accounts and owner-direct calls leave it off.
