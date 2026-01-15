```ts
function getSimpleAccountFactory(network): string;
```

Defined in: [packages/core/src/contracts.ts:263](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contracts.ts#L263)

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
