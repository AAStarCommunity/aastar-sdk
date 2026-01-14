> **getRpcUrl**(`network`): `"https://rpc.sepolia.org"` \| `"http://127.0.0.1:8545"`

Defined in: [packages/core/src/networks.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/networks.ts#L59)

Get RPC URL for a network

## Parameters

### network

Network name

`"anvil"` | `"sepolia"`

## Returns

`"https://rpc.sepolia.org"` \| `"http://127.0.0.1:8545"`

Public RPC URL

## Example

```ts
const rpcUrl = getRpcUrl('sepolia');
```
