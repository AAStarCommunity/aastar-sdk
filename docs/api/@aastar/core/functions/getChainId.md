> **getChainId**(`network`): `number`

Defined in: [packages/core/src/networks.ts:125](https://github.com/AAStarCommunity/aastar-sdk/blob/ee2dd989851034f323f1aad02b8ecb5fe586602a/packages/core/src/networks.ts#L125)

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
