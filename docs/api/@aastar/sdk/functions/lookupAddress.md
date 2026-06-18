> **lookupAddress**(`address`, `options`): `Promise`\<`string` \| `null`\>

Defined in: [packages/core/src/utils/ens.ts:64](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/utils/ens.ts#L64)

Reverse-resolve an Ethereum address to its primary ENS name.
Returns null if the address has no reverse record.

## Parameters

| Parameter | Type |
| ------ | ------ |
| `address` | `` `0x${string}` `` |
| `options` | [`EnsOptions`](../interfaces/EnsOptions.md) |

## Returns

`Promise`\<`string` \| `null`\>

## Example

```ts
const name = await lookupAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
```
