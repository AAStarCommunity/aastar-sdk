```ts
function getChainId(network): number;
```

Defined in: [packages/core/src/networks.ts:125](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/networks.ts#L125)

Get chain ID for a network

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"anvil"` \| `"sepolia"` | Network name |

## Returns

`number`

Chain ID number

## Example

```ts
const chainId = getChainId('sepolia');
// 11155111
```
