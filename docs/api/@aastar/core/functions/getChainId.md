> **getChainId**(`network`): `number`

Defined in: [packages/core/src/networks.ts:125](https://github.com/AAStarCommunity/aastar-sdk/blob/9b0a93af912c0a13b6340209fddaa3c55af271d0/packages/core/src/networks.ts#L125)

Get chain ID for a network

## Parameters

### network

Network name

`"sepolia"` | `"anvil"`

## Returns

`number`

Chain ID number

## Example

```ts
const chainId = getChainId('sepolia');
// 11155111
```
