> **encodeG2Point**(`blsSig`): `` `0x${string}` ``

Defined in: [packages/core/src/crypto/dvtWire.ts:94](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/crypto/dvtWire.ts#L94)

Produce the canonical 256-byte EIP-2537 G2 layout for a BLS aggregate signature,
byte-identical to the DVT node's `encodeG2Point` (YetAnotherAA-Validator
`src/utils/bls.util.ts`) and to what the contract pairs over.

Layout: `x.c0 @ 16 / x.c1 @ 80 / y.c0 @ 144 / y.c1 @ 208`, each Fp a 48-byte
big-endian value right-aligned in its 64-byte slot (16 leading zero bytes).

Accepts the signature in three forms:
- **256-byte EIP-2537** (what the node already emits): validated and passed through.
- **96-byte compressed** / **192-byte uncompressed** zkcrypto G2: re-packed via
  `@noble/curves` (parse → affine → EIP-2537 slots).

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `blsSig` | `Uint8Array` \| `` `0x${string}` `` | The aggregate BLS G2 signature (hex or bytes). |

## Returns

`` `0x${string}` ``

The 256-byte EIP-2537 G2 point as hex.
