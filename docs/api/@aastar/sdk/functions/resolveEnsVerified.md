> **resolveEnsVerified**(`name`, `options`): `Promise`\<\{ `address`: `` `0x${string}` `` \| `null`; `name`: `string`; `verified`: `boolean`; \}\>

Defined in: [packages/core/src/utils/ens.ts:79](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/utils/ens.ts#L79)

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
