> **getBlockExplorer**(`network`): `""` \| `"https://sepolia.etherscan.io"`

Defined in: [packages/core/src/networks.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/networks.ts#L75)

Get block explorer URL

## Parameters

### network

Network name

`"anvil"` | `"sepolia"`

## Returns

`""` \| `"https://sepolia.etherscan.io"`

Block explorer base URL

## Example

```ts
const explorer = getBlockExplorer('sepolia');
// 'https://sepolia.etherscan.io'
```
