> `const` **BLSHelpers**: `object`

Defined in: [packages/core/src/crypto/blsSigner.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/crypto/blsSigner.ts#L76)

Helper functions for creating BLS proofs for Registry operations

## Type Declaration

### createReputationUpdateMessage()

> **createReputationUpdateMessage**(`users`, `scores`, `epoch`): `` `0x${string}` ``

Create message hash for reputation update

#### Parameters

##### users

`` `0x${string}` ``[]

Array of user addresses

##### scores

`bigint`[]

Array of reputation scores

##### epoch

`bigint`

Epoch number

#### Returns

`` `0x${string}` ``

Message hash to sign

### createSlashProposalMessage()

> **createSlashProposalMessage**(`proposalId`): `` `0x${string}` ``

Create message hash for slash proposal

#### Parameters

##### proposalId

`bigint`

Slash proposal ID

#### Returns

`` `0x${string}` ``

Message hash to sign

### encodeReputationProof()

> **encodeReputationProof**(`aggregatedSignature`, `aggregatedPublicKey`, `bitmap`): `` `0x${string}` ``

Encode BLS proof for Registry.batchUpdateGlobalReputation

#### Parameters

##### aggregatedSignature

`` `0x${string}` ``

Aggregated BLS signature

##### aggregatedPublicKey

`` `0x${string}` ``

Aggregated BLS public key

##### bitmap

`bigint`

Validator participation bitmap

#### Returns

`` `0x${string}` ``

Encoded proof bytes
