> **getAddressUrl**(`network`, `address`): `string`

Defined in: [packages/core/src/networks.ts:109](https://github.com/AAStarCommunity/aastar-sdk/blob/02429a724df6d1db083144e00515cd09857c0075/packages/core/src/networks.ts#L109)

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
