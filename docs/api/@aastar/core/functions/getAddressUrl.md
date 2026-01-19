> **getAddressUrl**(`network`, `address`): `string`

Defined in: [packages/core/src/networks.ts:109](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/networks.ts#L109)

Get address URL on block explorer

## Parameters

### network

Network name

`"anvil"` | `"sepolia"`

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
