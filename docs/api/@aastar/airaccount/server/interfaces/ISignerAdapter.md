Defined in: [packages/airaccount/src/server/interfaces/signer-adapter.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/interfaces/signer-adapter.ts#L19)

Pluggable signer adapter — replaces NestJS AuthService wallet management.
Implement this to provide signing capabilities from your key management system.

Narrow by design: the only operations the SDK performs are EOA address
lookup and EIP-191 personal-sign over a digest. There is no transaction
signing / provider connection — that lives in the bundler/UserOp path.

## Methods

### ensureSigner()

> **ensureSigner**(`userId`): `Promise`\<\{ `address`: `` `0x${string}` ``; \}\>

Defined in: [packages/airaccount/src/server/interfaces/signer-adapter.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/interfaces/signer-adapter.ts#L41)

Ensure a signer exists for the user (create on demand if needed).
Returns the signer's address.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userId` | `string` |

#### Returns

`Promise`\<\{ `address`: `` `0x${string}` ``; \}\>

***

### getAddress()

> **getAddress**(`userId`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/airaccount/src/server/interfaces/signer-adapter.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/interfaces/signer-adapter.ts#L21)

Get the EOA address for a given user.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userId` | `string` |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### signMessage()

> **signMessage**(`userId`, `message`, `ctx?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/airaccount/src/server/interfaces/signer-adapter.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/interfaces/signer-adapter.ts#L31)

Sign a message for a given user, applying EIP-191 personal-sign semantics
(equivalent to ethers `signer.signMessage(bytes)` / viem
`account.signMessage({ raw: bytes })`). A `Uint8Array` (or raw `0x` hex) is
signed as raw bytes — callers pass a 32-byte digest, NOT UTF-8 text.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `userId` | `string` | - |
| `message` | `` `0x${string}` `` \| `Uint8Array` | - |
| `ctx?` | [`PasskeyAssertionContext`](PasskeyAssertionContext.md) | optional Passkey assertion context for KMS-backed signers. |

#### Returns

`Promise`\<`` `0x${string}` ``\>
