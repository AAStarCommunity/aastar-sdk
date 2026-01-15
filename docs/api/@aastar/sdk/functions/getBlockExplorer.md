```ts
function getBlockExplorer(network): "" | "https://sepolia.etherscan.io";
```

Defined in: [packages/core/src/networks.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/networks.ts#L75)

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
