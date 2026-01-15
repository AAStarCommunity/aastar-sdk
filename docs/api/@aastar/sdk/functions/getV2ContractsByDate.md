```ts
function getV2ContractsByDate(date): ContractVersion[];
```

Defined in: [packages/core/src/contract-versions.ts:356](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/contract-versions.ts#L356)

Get all V2 contracts deployed on a specific date

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `date` | `string` | Deployment date (YYYY-MM-DD) |

## Returns

[`ContractVersion`](../interfaces/ContractVersion.md)[]

Array of contracts deployed on that date

## Example

```ts
const contracts = getV2ContractsByDate('2025-11-01');
console.log(`${contracts.length} contracts deployed on 2025-11-01`);
```
