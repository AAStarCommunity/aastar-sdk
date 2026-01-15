```ts
function getPaymasterV4_1(network): string;
```

Defined in: [packages/core/src/contracts.ts:232](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contracts.ts#L232)

Get PaymasterV4_1 address (AOA mode)

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"sepolia"` | Network name |

## Returns

`string`

PaymasterV4_1 address

## Example

```ts
const paymaster = getPaymasterV4_1('sepolia');
```
