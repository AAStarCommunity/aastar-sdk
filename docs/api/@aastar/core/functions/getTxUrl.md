> **getTxUrl**(`network`, `txHash`): `string`

Defined in: [packages/core/src/networks.ts:92](https://github.com/AAStarCommunity/aastar-sdk/blob/02429a724df6d1db083144e00515cd09857c0075/packages/core/src/networks.ts#L92)

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
