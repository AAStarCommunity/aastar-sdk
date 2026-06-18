Defined in: [packages/airaccount/src/server/services/kms-signer.ts:775](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-signer.ts#L775)

KMS-backed signer with Passkey assertion.

Each signing operation calls the `assertionProvider` to obtain a Legacy
Passkey assertion, which is then passed to KMS SignHash. The Legacy format
is reusable (no challenge consumption), enabling BLS dual-signing.

Narrowed during the ethers -> viem migration: only the EIP-191 personal-sign
and address-read behaviour is actually consumed by the SDK, so the former
ethers.AbstractSigner surface (signTransaction / signTypedData / connect /
provider) has been dropped.

## Constructors

### Constructor

> **new KmsSigner**(`keyId`, `_address`, `kmsManager`, `assertionProvider`): `KmsSigner`

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:776](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-signer.ts#L776)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `keyId` | `string` |
| `_address` | `string` |
| `kmsManager` | [`KmsManager`](KmsManager.md) |
| `assertionProvider` | () => `Promise`\<[`LegacyPasskeyAssertion`](../interfaces/LegacyPasskeyAssertion.md)\> |

#### Returns

`KmsSigner`

## Methods

### getAddress()

> **getAddress**(): `Promise`\<`string`\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:783](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-signer.ts#L783)

#### Returns

`Promise`\<`string`\>

***

### signMessage()

> **signMessage**(`message`): `Promise`\<`string`\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:787](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-signer.ts#L787)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `string` \| `Uint8Array` |

#### Returns

`Promise`\<`string`\>
