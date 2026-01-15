```ts
function getAddressUrl(network, address): string;
```

Defined in: [packages/core/src/networks.ts:109](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/networks.ts#L109)

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
