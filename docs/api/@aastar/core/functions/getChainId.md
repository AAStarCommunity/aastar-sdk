> **getChainId**(`network`): `number`

Defined in: [packages/core/src/networks.ts:125](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/networks.ts#L125)

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
