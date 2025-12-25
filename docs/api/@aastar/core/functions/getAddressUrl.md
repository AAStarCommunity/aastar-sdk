> **getAddressUrl**(`network`, `address`): `string`

Defined in: [packages/core/src/networks.ts:109](https://github.com/AAStarCommunity/aastar-sdk/blob/2bfec0a83e320e28501997c5fd5b6a5c22584cd8/packages/core/src/networks.ts#L109)

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
