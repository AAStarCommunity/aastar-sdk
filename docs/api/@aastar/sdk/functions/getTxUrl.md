```ts
function getTxUrl(network, txHash): string;
```

Defined in: [packages/core/src/networks.ts:92](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/networks.ts#L92)

Get transaction URL on block explorer

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"anvil"` \| `"sepolia"` | Network name |
| `txHash` | `string` | Transaction hash |

## Returns

`string`

Full transaction URL

## Example

```ts
const url = getTxUrl('sepolia', '0x123...');
// 'https://sepolia.etherscan.io/tx/0x123...'
```
