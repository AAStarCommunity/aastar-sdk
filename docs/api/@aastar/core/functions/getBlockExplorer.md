> **getBlockExplorer**(`network`): `""` \| `"https://sepolia.etherscan.io"`

Defined in: [packages/core/src/networks.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/networks.ts#L75)

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
