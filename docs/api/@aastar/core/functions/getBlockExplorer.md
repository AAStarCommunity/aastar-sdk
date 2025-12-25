> **getBlockExplorer**(`network`): `""` \| `"https://sepolia.etherscan.io"`

Defined in: [packages/core/src/networks.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/4d5be576edce490d7405a108d648a390d96f3eb5/packages/core/src/networks.ts#L75)

Get block explorer URL

## Parameters

### network

Network name

`"sepolia"` | `"anvil"`

## Returns

`""` \| `"https://sepolia.etherscan.io"`

Block explorer base URL

## Example

```ts
const explorer = getBlockExplorer('sepolia');
// 'https://sepolia.etherscan.io'
```
