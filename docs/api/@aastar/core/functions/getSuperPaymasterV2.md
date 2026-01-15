```ts
function getSuperPaymasterV2(network): string;
```

Defined in: [packages/core/src/contracts.ts:278](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contracts.ts#L278)

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
