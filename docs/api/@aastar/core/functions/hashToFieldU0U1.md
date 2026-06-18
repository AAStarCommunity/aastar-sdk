> **hashToFieldU0U1**(`message`): [`HashToFieldU0U1`](../interfaces/HashToFieldU0U1.md)

Defined in: [packages/core/src/crypto/hashToField.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/crypto/hashToField.ts#L73)

Compute `hash_to_field(message, DST=BLS_POP_DST, count=2)` for BLS12-381 G2
and serialize the resulting two Fp2 elements (u0, u1) into SuperPaymaster's
EIP-2537 split-bytes32 layout.

This is the authoritative cross-repo golden surface for DVT: the node, the
SDK, and the on-chain verifier must all agree byte-for-byte on (u0, u1).
Full hash-to-curve (map_to_curve + clear_cofactor) is intentionally NOT
computed here because it needs EIP-2537 precompiles absent on cancun; the
contract only verifies the `hash_to_field` intermediate.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `message` | `` `0x${string}` `` | The message to hash (arbitrary-length bytes, as Hex). |

## Returns

[`HashToFieldU0U1`](../interfaces/HashToFieldU0U1.md)

The 8 bytes32 values (u0/u1 × c0/c1 × a/b).
