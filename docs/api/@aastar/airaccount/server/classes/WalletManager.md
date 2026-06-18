Defined in: [packages/airaccount/src/server/services/wallet-manager.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/wallet-manager.ts#L6)

Thin wrapper around ISignerAdapter for consistent wallet access.

## Constructors

### Constructor

> **new WalletManager**(`signer`): `WalletManager`

Defined in: [packages/airaccount/src/server/services/wallet-manager.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/wallet-manager.ts#L7)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `signer` | [`ISignerAdapter`](../interfaces/ISignerAdapter.md) |

#### Returns

`WalletManager`

## Methods

### ensureSigner()

> **ensureSigner**(`userId`): `Promise`\<\{ `address`: `` `0x${string}` ``; \}\>

Defined in: [packages/airaccount/src/server/services/wallet-manager.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/wallet-manager.ts#L21)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userId` | `string` |

#### Returns

`Promise`\<\{ `address`: `` `0x${string}` ``; \}\>

***

### getAddress()

> **getAddress**(`userId`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/airaccount/src/server/services/wallet-manager.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/wallet-manager.ts#L9)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userId` | `string` |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### signMessage()

> **signMessage**(`userId`, `message`, `ctx?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/airaccount/src/server/services/wallet-manager.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/wallet-manager.ts#L13)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userId` | `string` |
| `message` | `` `0x${string}` `` \| `Uint8Array` |
| `ctx?` | [`PasskeyAssertionContext`](../interfaces/PasskeyAssertionContext.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>
