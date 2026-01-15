```ts
function getSuperPaymasterV2(network): string;
```

Defined in: [packages/core/src/contracts.ts:278](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/contracts.ts#L278)

Get SuperPaymaster V2 address (AOA+ mode)

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"sepolia"` | Network name |

## Returns

`string`

SuperPaymaster V2 address

## Example

```ts
const superPaymaster = getSuperPaymasterV2('sepolia');
```
