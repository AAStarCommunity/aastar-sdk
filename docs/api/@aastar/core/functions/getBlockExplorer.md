> **getBlockExplorer**(`network`): `""` \| `"https://sepolia.etherscan.io"` \| `"https://optimistic.etherscan.io"` \| `"https://optimism-sepolia.blockscout.com"`

Defined in: [packages/core/src/networks.ts:97](https://github.com/AAStarCommunity/aastar-sdk/blob/9c654bccf291bedf59c180131227065a5460e904/packages/core/src/networks.ts#L97)

Get block explorer URL

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"anvil"` \| `"optimism"` \| `"sepolia"` \| `"op-sepolia"` | Network name |

## Returns

`""` \| `"https://sepolia.etherscan.io"` \| `"https://optimistic.etherscan.io"` \| `"https://optimism-sepolia.blockscout.com"`

Block explorer base URL

## Example

```ts
const explorer = getBlockExplorer('sepolia');
// 'https://sepolia.etherscan.io'
```
