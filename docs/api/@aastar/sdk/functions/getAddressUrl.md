> **getAddressUrl**(`network`, `address`): `string`

Defined in: [packages/core/src/networks.ts:109](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/networks.ts#L109)

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
