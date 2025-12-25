> **getBlockExplorer**(`network`): `""` \| `"https://sepolia.etherscan.io"`

Defined in: [packages/core/src/networks.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/02429a724df6d1db083144e00515cd09857c0075/packages/core/src/networks.ts#L75)

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
