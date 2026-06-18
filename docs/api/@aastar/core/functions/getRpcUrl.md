> **getRpcUrl**(`network`): `"https://rpc.sepolia.org"` \| `"http://127.0.0.1:8545"` \| `"https://mainnet.optimism.io"` \| `"https://sepolia.optimism.io"`

Defined in: [packages/core/src/networks.ts:81](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/networks.ts#L81)

Get RPC URL for a network

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"anvil"` \| `"optimism"` \| `"sepolia"` \| `"op-sepolia"` | Network name |

## Returns

`"https://rpc.sepolia.org"` \| `"http://127.0.0.1:8545"` \| `"https://mainnet.optimism.io"` \| `"https://sepolia.optimism.io"`

Public RPC URL

## Example

```ts
const rpcUrl = getRpcUrl('sepolia');
```
