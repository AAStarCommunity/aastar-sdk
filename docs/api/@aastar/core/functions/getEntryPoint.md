```ts
function getEntryPoint(network): string;
```

Defined in: [packages/core/src/contracts.ts:293](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contracts.ts#L293)

Get EntryPoint v0.7 address

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"sepolia"` | Network name |

## Returns

`string`

EntryPoint address

## Example

```ts
const entryPoint = getEntryPoint('sepolia');
```
