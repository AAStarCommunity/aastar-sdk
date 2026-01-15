```ts
function getBlockExplorer(network): "" | "https://sepolia.etherscan.io";
```

Defined in: [packages/core/src/networks.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/networks.ts#L75)

Get block explorer URL

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"anvil"` \| `"sepolia"` | Network name |

## Returns

`""` \| `"https://sepolia.etherscan.io"`

Block explorer base URL

## Example

```ts
const explorer = getBlockExplorer('sepolia');
// 'https://sepolia.etherscan.io'
```
