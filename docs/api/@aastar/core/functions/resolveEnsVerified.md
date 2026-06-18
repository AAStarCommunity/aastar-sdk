> **resolveEnsVerified**(`name`, `options`): `Promise`\<\{ `address`: `` `0x${string}` `` \| `null`; `name`: `string`; `verified`: `boolean`; \}\>

Defined in: [packages/core/src/utils/ens.ts:79](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/utils/ens.ts#L79)

Resolve both directions at once: given an ENS name, return the address and
confirm the reverse record matches (to detect misconfigurations).

Returns `{ address, name, verified }` where `verified` is true only when
the reverse record of the resolved address points back to `name`.

## Parameters

| Parameter | Type |
| ------ | ------ |
| `name` | `string` |
| `options` | [`EnsOptions`](../interfaces/EnsOptions.md) |

## Returns

`Promise`\<\{ `address`: `` `0x${string}` `` \| `null`; `name`: `string`; `verified`: `boolean`; \}\>
