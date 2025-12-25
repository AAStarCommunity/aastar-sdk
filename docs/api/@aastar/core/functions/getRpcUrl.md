> **getRpcUrl**(`network`): `"https://rpc.sepolia.org"` \| `"http://127.0.0.1:8545"`

Defined in: [packages/core/src/networks.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/401447c149b116a7176de09bdf973a40913dd2f1/packages/core/src/networks.ts#L59)

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
