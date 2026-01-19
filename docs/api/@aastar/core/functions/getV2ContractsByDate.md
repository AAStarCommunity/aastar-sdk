> **getV2ContractsByDate**(`date`): [`ContractVersion`](../interfaces/ContractVersion.md)[]

Defined in: [packages/core/src/contract-versions.ts:356](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/contract-versions.ts#L356)

Get all V2 contracts deployed on a specific date

## Parameters

### date

`string`

Deployment date (YYYY-MM-DD)

## Returns

[`ContractVersion`](../interfaces/ContractVersion.md)[]

Array of contracts deployed on that date

## Example

```ts
const contracts = getV2ContractsByDate('2025-11-01');
console.log(`${contracts.length} contracts deployed on 2025-11-01`);
```
