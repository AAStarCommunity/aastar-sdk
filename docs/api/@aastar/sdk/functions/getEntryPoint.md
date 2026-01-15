```ts
function getEntryPoint(network): string;
```

Defined in: [packages/core/src/contracts.ts:293](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/contracts.ts#L293)

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
