Defined in: [packages/core/src/crypto/blsSigner.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/crypto/blsSigner.ts#L9)

BLS Signer for Registry reputation updates and DVT operations

Uses BLS12-381 curve for signature aggregation

## Constructors

### Constructor

> **new BLSSigner**(`privateKeyHex`): `BLSSigner`

Defined in: [packages/core/src/crypto/blsSigner.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/crypto/blsSigner.ts#L12)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `privateKeyHex` | `` `0x${string}` `` |

#### Returns

`BLSSigner`

## Methods

### getPublicKey()

> **getPublicKey**(): `` `0x${string}` ``

Defined in: [packages/core/src/crypto/blsSigner.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/crypto/blsSigner.ts#L31)

Get BLS public key

#### Returns

`` `0x${string}` ``

Public key as hex string

***

### sign()

> **sign**(`message`): `` `0x${string}` ``

Defined in: [packages/core/src/crypto/blsSigner.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/crypto/blsSigner.ts#L21)

Sign a message with BLS private key

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `message` | `` `0x${string}` `` | Message hash to sign |

#### Returns

`` `0x${string}` ``

BLS signature as hex string

***

### aggregatePublicKeys()

> `static` **aggregatePublicKeys**(`pubKeys`): `` `0x${string}` ``

Defined in: [packages/core/src/crypto/blsSigner.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/crypto/blsSigner.ts#L52)

Aggregate multiple BLS public keys

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `pubKeys` | `` `0x${string}` ``[] | Array of BLS public keys |

#### Returns

`` `0x${string}` ``

Aggregated public key (uncompressed G1 - 96 bytes for EVM)

***

### aggregateSignatures()

> `static` **aggregateSignatures**(`signatures`): `` `0x${string}` ``

Defined in: [packages/core/src/crypto/blsSigner.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/crypto/blsSigner.ts#L41)

Aggregate multiple BLS signatures

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `signatures` | `` `0x${string}` ``[] | Array of BLS signatures |

#### Returns

`` `0x${string}` ``

Aggregated signature

***

### verify()

> `static` **verify**(`message`, `signature`, `publicKey`): `boolean`

Defined in: [packages/core/src/crypto/blsSigner.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/crypto/blsSigner.ts#L65)

Verify a BLS signature

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `message` | `` `0x${string}` `` | Message hash |
| `signature` | `` `0x${string}` `` | BLS signature |
| `publicKey` | `` `0x${string}` `` | BLS public key |

#### Returns

`boolean`

True if signature is valid
