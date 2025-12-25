> **getChainId**(`network`): `number`

Defined in: [packages/core/src/networks.ts:125](https://github.com/AAStarCommunity/aastar-sdk/blob/401447c149b116a7176de09bdf973a40913dd2f1/packages/core/src/networks.ts#L125)

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
