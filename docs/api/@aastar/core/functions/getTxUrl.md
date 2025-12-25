> **getTxUrl**(`network`, `txHash`): `string`

Defined in: [packages/core/src/networks.ts:92](https://github.com/AAStarCommunity/aastar-sdk/blob/9b0a93af912c0a13b6340209fddaa3c55af271d0/packages/core/src/networks.ts#L92)

Get transaction URL on block explorer

## Parameters

### network

Network name

`"sepolia"` | `"anvil"`

### txHash

`string`

Transaction hash

## Returns

`string`

Full transaction URL

## Example

```ts
const url = getTxUrl('sepolia', '0x123...');
// 'https://sepolia.etherscan.io/tx/0x123...'
```
