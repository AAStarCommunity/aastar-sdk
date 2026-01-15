```ts
function getSuperPaymasterV2(network): string;
```

Defined in: [packages/core/src/contracts.ts:278](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/contracts.ts#L278)

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
