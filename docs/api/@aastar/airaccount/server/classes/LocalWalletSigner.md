Defined in: [packages/airaccount/src/server/adapters/local-wallet-signer.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/adapters/local-wallet-signer.ts#L11)

Local wallet signer — backs all users with a single private key.
Suitable for testing, demos, and single-tenant server setups.

For multi-tenant production use, implement ISignerAdapter with
per-user key management (e.g., KMS, HSM, or encrypted database).

## Implements

- [`ISignerAdapter`](../interfaces/ISignerAdapter.md)

## Constructors

### Constructor

> **new LocalWalletSigner**(`privateKey`): `LocalWalletSigner`

Defined in: [packages/airaccount/src/server/adapters/local-wallet-signer.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/adapters/local-wallet-signer.ts#L14)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `privateKey` | `string` |

#### Returns

`LocalWalletSigner`

## Methods

### ensureSigner()

> **ensureSigner**(`_userId`): `Promise`\<\{ `address`: `` `0x${string}` ``; \}\>

Defined in: [packages/airaccount/src/server/adapters/local-wallet-signer.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/adapters/local-wallet-signer.ts#L33)

Ensure a signer exists for the user (create on demand if needed).
Returns the signer's address.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `_userId` | `string` |

#### Returns

`Promise`\<\{ `address`: `` `0x${string}` ``; \}\>

#### Implementation of

[`ISignerAdapter`](../interfaces/ISignerAdapter.md).[`ensureSigner`](../interfaces/ISignerAdapter.md#ensuresigner)

***

### getAddress()

> **getAddress**(`_userId`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/airaccount/src/server/adapters/local-wallet-signer.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/adapters/local-wallet-signer.ts#L18)

Get the EOA address for a given user.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `_userId` | `string` |

#### Returns

`Promise`\<`` `0x${string}` ``\>

#### Implementation of

[`ISignerAdapter`](../interfaces/ISignerAdapter.md).[`getAddress`](../interfaces/ISignerAdapter.md#getaddress)

***

### signMessage()

> **signMessage**(`_userId`, `message`, `_ctx?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/airaccount/src/server/adapters/local-wallet-signer.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/adapters/local-wallet-signer.ts#L22)

Sign a message for a given user, applying EIP-191 personal-sign semantics
(equivalent to ethers `signer.signMessage(bytes)` / viem
`account.signMessage({ raw: bytes })`). A `Uint8Array` (or raw `0x` hex) is
signed as raw bytes — callers pass a 32-byte digest, NOT UTF-8 text.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `_userId` | `string` | - |
| `message` | `` `0x${string}` `` \| `Uint8Array` | - |
| `_ctx?` | [`PasskeyAssertionContext`](../interfaces/PasskeyAssertionContext.md) | optional Passkey assertion context for KMS-backed signers. |

#### Returns

`Promise`\<`` `0x${string}` ``\>

#### Implementation of

[`ISignerAdapter`](../interfaces/ISignerAdapter.md).[`signMessage`](../interfaces/ISignerAdapter.md#signmessage)
