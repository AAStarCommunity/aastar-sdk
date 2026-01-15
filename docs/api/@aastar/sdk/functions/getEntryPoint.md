```ts
function getEntryPoint(network): string;
```

Defined in: [packages/core/src/contracts.ts:293](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/contracts.ts#L293)

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
