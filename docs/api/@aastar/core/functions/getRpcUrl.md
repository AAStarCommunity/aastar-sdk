> **getRpcUrl**(`network`): `"https://rpc.sepolia.org"` \| `"http://127.0.0.1:8545"`

Defined in: [packages/core/src/networks.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/networks.ts#L59)

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
