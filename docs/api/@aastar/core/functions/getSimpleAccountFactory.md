```ts
function getSimpleAccountFactory(network): string;
```

Defined in: [packages/core/src/contracts.ts:263](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/contracts.ts#L263)

Get SimpleAccountFactory address

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"sepolia"` | Network name |

## Returns

`string`

SimpleAccountFactory address

## Example

```ts
const factory = getSimpleAccountFactory('sepolia');
```
