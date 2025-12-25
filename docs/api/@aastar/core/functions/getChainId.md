> **getChainId**(`network`): `number`

Defined in: [packages/core/src/networks.ts:125](https://github.com/AAStarCommunity/aastar-sdk/blob/2bfec0a83e320e28501997c5fd5b6a5c22584cd8/packages/core/src/networks.ts#L125)

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
