> **getV2ContractsByDate**(`date`): [`ContractVersion`](../interfaces/ContractVersion.md)[]

Defined in: [packages/core/src/contract-versions.ts:356](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/contract-versions.ts#L356)

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
