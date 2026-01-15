```ts
const BLSHelpers: object;
```

Defined in: [packages/core/src/crypto/blsSigner.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/crypto/blsSigner.ts#L76)

Helper functions for creating BLS proofs for Registry and BLSAggregator operations

## Type Declaration

| Name | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| `createReputationUpdateMessage()` | ( `users`, `scores`, `epoch`) => `` `0x${string}` `` | Create message hash for reputation update | [packages/core/src/crypto/blsSigner.ts:87](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/crypto/blsSigner.ts#L87) |
| `createSlashProposalMessage()` | (`proposalId`) => `` `0x${string}` `` | Create message hash for slash proposal | [packages/core/src/crypto/blsSigner.ts:80](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/crypto/blsSigner.ts#L80) |
| `encodeBLSProof()` | ( `aggregatedPublicKey`, `aggregatedSignature`, `messageMappingG2`, `signerMask`) => `` `0x${string}` `` | Encode BLS proof for Registry/Aggregator (v3 format) Proof structure: (bytes pkG1, bytes sigG2, bytes msgG2, uint256 signerMask) | [packages/core/src/crypto/blsSigner.ts:98](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/crypto/blsSigner.ts#L98) |
| `encodeReputationProof()` | ( `signature`, `publicKey`, `signerMask`) => `` `0x${string}` `` | Encode Reputation Proof (for test compatibility) Matches format: (signature, publicKey, signerMask) | [packages/core/src/crypto/blsSigner.ts:114](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/crypto/blsSigner.ts#L114) |
