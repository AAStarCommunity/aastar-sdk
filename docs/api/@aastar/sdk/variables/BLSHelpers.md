> `const` **BLSHelpers**: `object`

Defined in: [packages/core/src/crypto/blsSigner.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/crypto/blsSigner.ts#L76)

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

### ~~encodeDVTProof()~~

> **encodeDVTProof**(`signerMask`, `aggregatedSignature`): `` `0x${string}` ``

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `signerMask` | `bigint` | Bitmask of contributing slots (see [slotsToSignerMask](#slotstosignermask)). |
| `aggregatedSignature` | `` `0x${string}` `` | The BLS12-381 aggregated G2 signature (`sigG2`). |

#### Returns

`` `0x${string}` ``

#### Deprecated

SUPERSEDED by the explicit-`nodeIds` DVT wire (airaccount-contract
#110, LIVE-verified). The DEPLOYED verifier decodes an explicit `nodeIds` list +
256-byte `blsSig`, NOT this `(signerMask, sigG2)` ABI tuple. Use
import('./dvtWire').encodeDVTVerifierProof (verifier-level) or
import('./dvtWire').encodeDVTAccountSignature (account-level) instead.
Retained for backward compatibility only.

Encode a DVT co-sign proof (early `signerMask` design, hub #42, decision B).

Under decision B the on-chain verifier recomputes `msgG2 = hashToG2(userOpHash)`
itself and rebuilds the aggregate public key from `signerMask` → registered
keys, so the proof carries ONLY `(signerMask, sigG2)`. pkG1 and msgG2 are NOT
included — this is intentionally narrower than the v3 [encodeBLSProof](#encodeblsproof)
still used by the slash/reputation path.

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

### ~~slotsToSignerMask()~~

> **slotsToSignerMask**(`slots`): `bigint`

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `slots` | `number`[] | Registration slots (1-indexed, `>= 1`) of the contributing signers. |

#### Returns

`bigint`

The uint256 signerMask.

#### Deprecated

SUPERSEDED by the explicit-`nodeIds` DVT wire (airaccount-contract
#110, LIVE-verified). The DEPLOYED `AAStarBLSAlgorithm` verifier takes an explicit
list of `bytes32` `nodeId`s, NOT a `signerMask` bitmask — `signerMask` was an early
design that the landed contract did not adopt. Use
import('./dvtWire').encodeDVTAccountSignature /
import('./dvtWire').encodeDVTVerifierProof instead. Retained for backward
compatibility with the legacy aggregator path only.

Build a DVT co-sign `signerMask` from registration slots (frozen DVT program
spec, hub YetAnotherAA-Validator#42).

The on-chain BLSAggregator addresses signers by REGISTRATION SLOT, not by
key-array index: bit `i` (LSB = 0) corresponds to slot `i + 1` (1-indexed) →
`validatorAtSlot[i + 1]`. So a validator registered at slot `s` sets bit `s - 1`.
Using a 0-indexed array position instead makes the contract rebuild the WRONG
aggregate public key → verification always fails.
