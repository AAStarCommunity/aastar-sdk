> **getAddressUrl**(`network`, `address`): `string`

Defined in: [packages/core/src/networks.ts:131](https://github.com/AAStarCommunity/aastar-sdk/blob/4bacc9848314b5f1ceb630b367762bab288eaa90/packages/core/src/networks.ts#L131)

Get address URL on block explorer

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"anvil"` \| `"sepolia"` \| `"op-sepolia"` \| `"optimism"` | Network name |
| `address` | `string` | Contract or wallet address |

## Returns

`string`

Full address URL

## Example

```ts
const url = getAddressUrl('sepolia', '0xabc...');
// 'https://sepolia.etherscan.io/address/0xabc...'
```
