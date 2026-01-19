> **getChainId**(`network`): `number`

Defined in: [packages/core/src/networks.ts:125](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/networks.ts#L125)

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
