```ts
function getV2ContractsByDate(date): ContractVersion[];
```

Defined in: [packages/core/src/contract-versions.ts:356](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contract-versions.ts#L356)

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
