```ts
function getRpcUrl(network): "https://rpc.sepolia.org" | "http://127.0.0.1:8545";
```

Defined in: [packages/core/src/networks.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/networks.ts#L59)

Get RPC URL for a network

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"anvil"` \| `"sepolia"` | Network name |

## Returns

`"https://rpc.sepolia.org"` \| `"http://127.0.0.1:8545"`

Public RPC URL

## Example

```ts
const rpcUrl = getRpcUrl('sepolia');
```
