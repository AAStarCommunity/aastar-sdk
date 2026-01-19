> **getChainId**(`network`): `number`

Defined in: [packages/core/src/networks.ts:125](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/networks.ts#L125)

Get chain ID for a network

## Parameters

### network

Network name

`"anvil"` | `"sepolia"`

## Returns

`number`

Chain ID number

## Example

```ts
const chainId = getChainId('sepolia');
// 11155111
```
