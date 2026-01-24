> `const` **BLSHelpers**: `object`

Defined in: [packages/core/src/crypto/blsSigner.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/crypto/blsSigner.ts#L76)

Helper functions for creating BLS proofs for Registry and BLSAggregator operations

## Type Declaration

### createReputationUpdateMessage()

> **createReputationUpdateMessage**(`users`, `scores`, `epoch`): `` `0x${string}` ``

Create message hash for reputation update

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `users` | `` `0x${string}` ``[] |
| `scores` | `bigint`[] |
| `epoch` | `bigint` |

#### Returns

`` `0x${string}` ``

### createSlashProposalMessage()

> **createSlashProposalMessage**(`proposalId`): `` `0x${string}` ``

Create message hash for slash proposal

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `proposalId` | `bigint` |

#### Returns

`` `0x${string}` ``

### encodeBLSProof()

> **encodeBLSProof**(`aggregatedPublicKey`, `aggregatedSignature`, `messageMappingG2`, `signerMask`): `` `0x${string}` ``

Encode BLS proof for Registry/Aggregator (v3 format)
Proof structure: (bytes pkG1, bytes sigG2, bytes msgG2, uint256 signerMask)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `aggregatedPublicKey` | `` `0x${string}` `` |
| `aggregatedSignature` | `` `0x${string}` `` |
| `messageMappingG2` | `` `0x${string}` `` |
| `signerMask` | `bigint` |

#### Returns

`` `0x${string}` ``

### encodeReputationProof()

> **encodeReputationProof**(`signature`, `publicKey`, `signerMask`): `` `0x${string}` ``

Encode Reputation Proof (for test compatibility)
Matches format: (signature, publicKey, signerMask)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `signature` | `` `0x${string}` `` |
| `publicKey` | `` `0x${string}` `` |
| `signerMask` | `bigint` |

#### Returns

`` `0x${string}` ``
