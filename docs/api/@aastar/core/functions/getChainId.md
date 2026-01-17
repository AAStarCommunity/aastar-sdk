> **getChainId**(`network`): `number`

Defined in: [packages/core/src/networks.ts:125](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/networks.ts#L125)

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
