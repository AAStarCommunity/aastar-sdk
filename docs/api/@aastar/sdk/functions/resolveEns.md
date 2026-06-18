> **resolveEns**(`name`, `options`): `Promise`\<`` `0x${string}` `` \| `null`\>

Defined in: [packages/core/src/utils/ens.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/utils/ens.ts#L49)

Forward-resolve an ENS name to an Ethereum address.
Returns null if the name has no address record.

## Parameters

| Parameter | Type |
| ------ | ------ |
| `name` | `string` |
| `options` | [`EnsOptions`](../interfaces/EnsOptions.md) |

## Returns

`Promise`\<`` `0x${string}` `` \| `null`\>

## Example

```ts
const address = await resolveEns('vitalik.eth');
```
