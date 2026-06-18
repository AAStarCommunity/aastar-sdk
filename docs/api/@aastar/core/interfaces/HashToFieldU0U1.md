Defined in: [packages/core/src/crypto/hashToField.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/crypto/hashToField.ts#L29)

The two Fp2 field elements (u0, u1) produced by `hash_to_field(msg, DST, 2)`,
each serialized in EIP-2537 split form to mirror SuperPaymaster's on-chain
`BLS.G2Point` X-coordinate layout.

Each Fp2 element has two coordinates (c0, c1). Each Fp (a BLS12-381 base-field
element, 48 bytes) is serialized EIP-2537-style as 64 bytes
(16 zero bytes + 48-byte big-endian) and split into two bytes32:
  - `a` = high 32 bytes (16 zero bytes + top 16 bytes of the field element)
  - `b` = low 32 bytes  (bottom 32 bytes of the field element)

## Properties

### u0c0a

> **u0c0a**: `` `0x${string}` ``

Defined in: [packages/core/src/crypto/hashToField.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/crypto/hashToField.ts#L31)

***

### u0c0b

> **u0c0b**: `` `0x${string}` ``

Defined in: [packages/core/src/crypto/hashToField.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/crypto/hashToField.ts#L32)

***

### u0c1a

> **u0c1a**: `` `0x${string}` ``

Defined in: [packages/core/src/crypto/hashToField.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/crypto/hashToField.ts#L33)

***

### u0c1b

> **u0c1b**: `` `0x${string}` ``

Defined in: [packages/core/src/crypto/hashToField.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/crypto/hashToField.ts#L34)

***

### u1c0a

> **u1c0a**: `` `0x${string}` ``

Defined in: [packages/core/src/crypto/hashToField.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/crypto/hashToField.ts#L36)

***

### u1c0b

> **u1c0b**: `` `0x${string}` ``

Defined in: [packages/core/src/crypto/hashToField.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/crypto/hashToField.ts#L37)

***

### u1c1a

> **u1c1a**: `` `0x${string}` ``

Defined in: [packages/core/src/crypto/hashToField.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/crypto/hashToField.ts#L38)

***

### u1c1b

> **u1c1b**: `` `0x${string}` ``

Defined in: [packages/core/src/crypto/hashToField.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/crypto/hashToField.ts#L39)
