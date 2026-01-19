> **getChainId**(`network`): `number`

Defined in: [packages/core/src/networks.ts:125](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/networks.ts#L125)

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
