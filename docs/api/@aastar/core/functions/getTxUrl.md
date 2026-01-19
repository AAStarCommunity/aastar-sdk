> **getTxUrl**(`network`, `txHash`): `string`

Defined in: [packages/core/src/networks.ts:92](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/networks.ts#L92)

Get transaction URL on block explorer

## Parameters

### network

Network name

`"anvil"` | `"sepolia"`

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
