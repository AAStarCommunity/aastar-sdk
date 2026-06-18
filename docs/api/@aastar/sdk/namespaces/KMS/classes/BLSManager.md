Defined in: [packages/airaccount/src/core/bls/bls.manager.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/core/bls/bls.manager.ts#L16)

## Constructors

### Constructor

> **new BLSManager**(`config`): `BLSManager`

Defined in: [packages/airaccount/src/core/bls/bls.manager.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/core/bls/bls.manager.ts#L19)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`BLSConfig`](../interfaces/BLSConfig.md) |

#### Returns

`BLSManager`

## Methods

### aggregateSignatures()

> **aggregateSignatures**(`node`, `signatures`): `Promise`\<`string`\>

Defined in: [packages/airaccount/src/core/bls/bls.manager.ts:131](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/core/bls/bls.manager.ts#L131)

Request aggregation from a node

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `node` | [`BLSNode`](../interfaces/BLSNode.md) |
| `signatures` | `string`[] |

#### Returns

`Promise`\<`string`\>

***

### generateMessagePoint()

> **generateMessagePoint**(`message`): `Promise`\<`string`\>

Defined in: [packages/airaccount/src/core/bls/bls.manager.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/core/bls/bls.manager.ts#L74)

Calculate the MessagePoint G2 point for a given message (UserOpHash)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `string` \| `Uint8Array` |

#### Returns

`Promise`\<`string`\>

***

### getAvailableNodes()

> **getAvailableNodes**(): `Promise`\<[`BLSNode`](../interfaces/BLSNode.md)[]\>

Defined in: [packages/airaccount/src/core/bls/bls.manager.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/core/bls/bls.manager.ts#L26)

Discover available BLS nodes from seed nodes (Gossip network)

#### Returns

`Promise`\<[`BLSNode`](../interfaces/BLSNode.md)[]\>

***

### packCumulativeT2Signature()

> **packCumulativeT2Signature**(`data`): `string`

Defined in: [packages/airaccount/src/core/bls/bls.manager.ts:88](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/core/bls/bls.manager.ts#L88)

Pack cumulative Tier 2 signature (algId 0x04): P256 + BLS.

Format:
  [algId=0x04 (1)] [P256 r (32)] [P256 s (32)]
  [nodeIdsLength (32)] [nodeIds (N×32)]
  [blsAggregateSig (256)] [messagePoint (256)]
  [messagePointECDSA (65)]

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `data` | [`CumulativeT2SignatureData`](../interfaces/CumulativeT2SignatureData.md) |

#### Returns

`string`

***

### packCumulativeT3Signature()

> **packCumulativeT3Signature**(`data`): `string`

Defined in: [packages/airaccount/src/core/bls/bls.manager.ts:102](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/core/bls/bls.manager.ts#L102)

Pack cumulative Tier 3 signature (algId 0x05): P256 + BLS + Guardian.

Format:
  [algId=0x05 (1)] [P256 r (32)] [P256 s (32)]
  [nodeIdsLength (32)] [nodeIds (N×32)]
  [blsAggregateSig (256)] [messagePoint (256)]
  [messagePointECDSA (65)] [guardianECDSA (65)]

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `data` | [`CumulativeT3SignatureData`](../interfaces/CumulativeT3SignatureData.md) |

#### Returns

`string`

***

### packSignature()

> **packSignature**(`data`): `string`

Defined in: [packages/airaccount/src/core/bls/bls.manager.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/core/bls/bls.manager.ts#L66)

Helper to pack the full signature for ERC-4337 UserOp
Format: [nodeIdsLength][nodeIds...][blsSignature][messagePoint][aaSignature][messagePointSignature]

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `data` | [`BLSSignatureData`](../interfaces/BLSSignatureData.md) |

#### Returns

`string`

***

### requestNodeSignature()

> **requestNodeSignature**(`node`, `message`): `Promise`\<\{ `publicKey`: `string`; `signature`: `string`; \}\>

Defined in: [packages/airaccount/src/core/bls/bls.manager.ts:110](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/core/bls/bls.manager.ts#L110)

Request signature from a single node

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `node` | [`BLSNode`](../interfaces/BLSNode.md) |
| `message` | `string` |

#### Returns

`Promise`\<\{ `publicKey`: `string`; `signature`: `string`; \}\>
