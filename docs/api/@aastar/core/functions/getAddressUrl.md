> **getAddressUrl**(`network`, `address`): `string`

Defined in: [packages/core/src/networks.ts:109](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/networks.ts#L109)

Get address URL on block explorer

## Parameters

### network

Network name

`"sepolia"` | `"anvil"`

### address

`string`

Contract or wallet address

## Returns

`string`

Full address URL

## Example

```ts
const url = getAddressUrl('sepolia', '0xabc...');
// 'https://sepolia.etherscan.io/address/0xabc...'
```
