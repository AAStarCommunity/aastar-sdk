```ts
function getAddressUrl(network, address): string;
```

Defined in: [packages/core/src/networks.ts:109](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/networks.ts#L109)

Get address URL on block explorer

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"anvil"` \| `"sepolia"` | Network name |
| `address` | `string` | Contract or wallet address |

## Returns

`string`

Full address URL

## Example

```ts
const url = getAddressUrl('sepolia', '0xabc...');
// 'https://sepolia.etherscan.io/address/0xabc...'
```
