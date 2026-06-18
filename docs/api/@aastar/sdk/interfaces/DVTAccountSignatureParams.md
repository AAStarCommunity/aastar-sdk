Defined in: [packages/core/src/crypto/dvtWire.ts:179](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/crypto/dvtWire.ts#L179)

Parameters for [encodeDVTAccountSignature](../functions/encodeDVTAccountSignature.md).

## Properties

### blsSig

> **blsSig**: `Uint8Array` \| `` `0x${string}` ``

Defined in: [packages/core/src/crypto/dvtWire.ts:187](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/crypto/dvtWire.ts#L187)

Aggregate BLS G2 signature (256-byte EIP-2537, or 96/192-byte zkcrypto).

***

### guardianSig?

> `optional` **guardianSig**: `` `0x${string}` ``

Defined in: [packages/core/src/crypto/dvtWire.ts:189](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/crypto/dvtWire.ts#L189)

REQUIRED for T3 (0x05): the trailing 65-byte guardian ECDSA signature. Forbidden for T2.

***

### nodeIds

> **nodeIds**: `` `0x${string}` ``[]

Defined in: [packages/core/src/crypto/dvtWire.ts:185](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/crypto/dvtWire.ts#L185)

Explicit `bytes32` node IDs of the contributing signers, in signing/aggregation order.

***

### p256

> **p256**: `` `0x${string}` `` \| \{ `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; \}

Defined in: [packages/core/src/crypto/dvtWire.ts:183](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/crypto/dvtWire.ts#L183)

P256 primary signature, as `{ r, s }` (each 32 bytes) or a 64-byte `r‖s` hex value.

***

### tier

> **tier**: [`DVTTier`](../type-aliases/DVTTier.md)

Defined in: [packages/core/src/crypto/dvtWire.ts:181](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/crypto/dvtWire.ts#L181)

Tier byte: [DVT\_TIER\_T2](../variables/DVT_TIER_T2.md) (0x04) or [DVT\_TIER\_T3](../variables/DVT_TIER_T3.md) (0x05).
