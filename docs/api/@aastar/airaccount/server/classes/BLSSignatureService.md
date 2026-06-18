Defined in: [packages/airaccount/src/server/services/bls-signature-service.ts:70](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/bls-signature-service.ts#L70)

BLS signature service — extracted from NestJS BlsService.
Uses lazy initialization instead of onModuleInit.

## Constructors

### Constructor

> **new BLSSignatureService**(`config`, `ethereum`, `storage`, `signer`, `logger?`): `BLSSignatureService`

Defined in: [packages/airaccount/src/server/services/bls-signature-service.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/bls-signature-service.ts#L74)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`ServerConfig`](../interfaces/ServerConfig.md) |
| `ethereum` | [`EthereumProvider`](EthereumProvider.md) |
| `storage` | [`IStorageAdapter`](../interfaces/IStorageAdapter.md) |
| `signer` | [`ISignerAdapter`](../interfaces/ISignerAdapter.md) |
| `logger?` | [`ILogger`](../interfaces/ILogger.md) |

#### Returns

`BLSSignatureService`

## Methods

### generateBLSSignature()

> **generateBLSSignature**(`userId`, `userOpHash`, `ctx?`): `Promise`\<[`BLSSignatureData`](../../interfaces/BLSSignatureData.md)\>

Defined in: [packages/airaccount/src/server/services/bls-signature-service.ts:115](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/bls-signature-service.ts#L115)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userId` | `string` |
| `userOpHash` | `string` |
| `ctx?` | [`PasskeyAssertionContext`](../interfaces/PasskeyAssertionContext.md) |

#### Returns

`Promise`\<[`BLSSignatureData`](../../interfaces/BLSSignatureData.md)\>

***

### generateTieredSignature()

> **generateTieredSignature**(`params`): `Promise`\<`string`\>

Defined in: [packages/airaccount/src/server/services/bls-signature-service.ts:250](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/bls-signature-service.ts#L250)

Generate a tiered signature based on the required tier level.

- Tier 1: raw 65-byte ECDSA (no algId prefix, backwards-compat)
- Tier 2: algId 0x04 — P256 + BLS aggregate + messagePoint ECDSA
- Tier 3: algId 0x05 — P256 + BLS + messagePoint ECDSA + Guardian ECDSA

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | \{ `ctx?`: [`PasskeyAssertionContext`](../interfaces/PasskeyAssertionContext.md); `guardianSigner?`: `GuardianSigner`; `p256Signature?`: `string`; `tier`: [`TierLevel`](../../type-aliases/TierLevel.md); `userId`: `string`; `userOpHash`: `string`; \} |
| `params.ctx?` | [`PasskeyAssertionContext`](../interfaces/PasskeyAssertionContext.md) |
| `params.guardianSigner?` | `GuardianSigner` |
| `params.p256Signature?` | `string` |
| `params.tier` | [`TierLevel`](../../type-aliases/TierLevel.md) |
| `params.userId` | `string` |
| `params.userOpHash` | `string` |

#### Returns

`Promise`\<`string`\>

***

### getActiveSignerNodes()

> **getActiveSignerNodes**(): `Promise`\<`unknown`[]\>

Defined in: [packages/airaccount/src/server/services/bls-signature-service.ts:100](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/bls-signature-service.ts#L100)

#### Returns

`Promise`\<`unknown`[]\>

***

### packSignature()

> **packSignature**(`blsData`): `Promise`\<`string`\>

Defined in: [packages/airaccount/src/server/services/bls-signature-service.ts:229](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/bls-signature-service.ts#L229)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `blsData` | [`BLSSignatureData`](../../interfaces/BLSSignatureData.md) |

#### Returns

`Promise`\<`string`\>
