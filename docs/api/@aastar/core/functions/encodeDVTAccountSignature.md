> **encodeDVTAccountSignature**(`params`): `` `0x${string}` ``

Defined in: [packages/core/src/crypto/dvtWire.ts:201](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/crypto/dvtWire.ts#L201)

Encode the ACCOUNT-LEVEL combined signature that goes into
`PackedUserOperation.signature`, per airaccount-contract #110:
```
T2: [0x04][P256(64)][nodeIdsLength(32)][nodeIds(N×32)][blsSig(256)]
T3: [0x05][P256(64)][nodeIdsLength(32)][nodeIds(N×32)][blsSig(256)][guardianECDSA(65)]
```
`nodeIdsLength` is a 32-byte big-endian `uint256` count of `nodeIds`.

## Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`DVTAccountSignatureParams`](../interfaces/DVTAccountSignatureParams.md) |

## Returns

`` `0x${string}` ``
