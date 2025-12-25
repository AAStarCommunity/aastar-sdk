> **getRpcUrl**(`network`): `"https://rpc.sepolia.org"` \| `"http://127.0.0.1:8545"`

Defined in: [packages/core/src/networks.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/9b0a93af912c0a13b6340209fddaa3c55af271d0/packages/core/src/networks.ts#L59)

Get RPC URL for a network

## Parameters

### network

Network name

`"sepolia"` | `"anvil"`

## Returns

`"https://rpc.sepolia.org"` \| `"http://127.0.0.1:8545"`

Public RPC URL

## Example

```ts
const rpcUrl = getRpcUrl('sepolia');
```
