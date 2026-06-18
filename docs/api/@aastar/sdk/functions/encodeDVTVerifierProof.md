> **encodeDVTVerifierProof**(`nodeIds`, `blsSig`): `` `0x${string}` ``

Defined in: [packages/core/src/crypto/dvtWire.ts:155](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/crypto/dvtWire.ts#L155)

Encode the VERIFIER-LEVEL proof passed to `AAStarBLSAlgorithm.validate`:
`[nodeId_1(32)…nodeId_N(32)][blsSig(256)]` — NO `nodeIdsLength` prefix (the contract
derives `nodeCount = (sig.length - 256) / 32`).

`nodeIds` order MUST equal the nodes' signing/aggregation order.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `nodeIds` | `` `0x${string}` ``[] | Explicit `bytes32` node IDs of the contributing signers, in order. |
| `blsSig` | `Uint8Array` \| `` `0x${string}` `` | The aggregate BLS G2 signature (256-byte EIP-2537, or 96/192-byte zkcrypto). |

## Returns

`` `0x${string}` ``
