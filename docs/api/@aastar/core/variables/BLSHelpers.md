> `const` **BLSHelpers**: `object`

Defined in: [packages/core/src/crypto/blsSigner.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/crypto/blsSigner.ts#L76)

Helper functions for creating BLS proofs for Registry and BLSAggregator operations

## Type Declaration

### createReputationUpdateMessage()

> **createReputationUpdateMessage**(`users`, `scores`, `epoch`): `` `0x${string}` ``

Create message hash for reputation update

#### Parameters

##### users

`` `0x${string}` ``[]

##### scores

`bigint`[]

##### epoch

`bigint`

#### Returns

`` `0x${string}` ``

### createSlashProposalMessage()

> **createSlashProposalMessage**(`proposalId`): `` `0x${string}` ``

Create message hash for slash proposal

#### Parameters

##### proposalId

`bigint`

#### Returns

`` `0x${string}` ``

### encodeBLSProof()

> **encodeBLSProof**(`aggregatedPublicKey`, `aggregatedSignature`, `messageMappingG2`, `signerMask`): `` `0x${string}` ``

Encode BLS proof for Registry/Aggregator (v3 format)
Proof structure: (bytes pkG1, bytes sigG2, bytes msgG2, uint256 signerMask)

#### Parameters

##### aggregatedPublicKey

`` `0x${string}` ``

##### aggregatedSignature

`` `0x${string}` ``

##### messageMappingG2

`` `0x${string}` ``

##### signerMask

`bigint`

#### Returns

`` `0x${string}` ``

### encodeReputationProof()

> **encodeReputationProof**(`signature`, `publicKey`, `signerMask`): `` `0x${string}` ``

Encode Reputation Proof (for test compatibility)
Matches format: (signature, publicKey, signerMask)

#### Parameters

##### signature

`` `0x${string}` ``

##### publicKey

`` `0x${string}` ``

##### signerMask

`bigint`

#### Returns

`` `0x${string}` ``
