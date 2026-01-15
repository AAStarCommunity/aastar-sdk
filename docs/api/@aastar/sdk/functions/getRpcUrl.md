> **getRpcUrl**(`network`): `"https://rpc.sepolia.org"` \| `"http://127.0.0.1:8545"`

Defined in: [packages/core/src/networks.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/networks.ts#L59)

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
