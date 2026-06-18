> **getBlockExplorer**(`network`): `""` \| `"https://sepolia.etherscan.io"` \| `"https://optimistic.etherscan.io"` \| `"https://sepolia-optimism.etherscan.io"`

Defined in: [packages/core/src/networks.ts:97](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/networks.ts#L97)

Get block explorer URL

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"anvil"` \| `"optimism"` \| `"sepolia"` \| `"op-sepolia"` | Network name |

## Returns

`""` \| `"https://sepolia.etherscan.io"` \| `"https://optimistic.etherscan.io"` \| `"https://sepolia-optimism.etherscan.io"`

Block explorer base URL

## Example

```ts
const explorer = getBlockExplorer('sepolia');
// 'https://sepolia.etherscan.io'
```
