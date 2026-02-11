> **getTxUrl**(`network`, `txHash`): `string`

Defined in: [packages/core/src/networks.ts:114](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/core/src/networks.ts#L114)

Get transaction URL on block explorer

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"anvil"` \| `"sepolia"` \| `"op-sepolia"` \| `"optimism"` | Network name |
| `txHash` | `string` | Transaction hash |

## Returns

`string`

Full transaction URL

## Example

```ts
const url = getTxUrl('sepolia', '0x123...');
// 'https://sepolia.etherscan.io/tx/0x123...'
```
