```ts
function getSimpleAccountFactory(network): string;
```

Defined in: [packages/core/src/contracts.ts:263](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/contracts.ts#L263)

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
