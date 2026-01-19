> **getV2ContractByName**(`name`): [`ContractVersion`](../interfaces/ContractVersion.md) \| `undefined`

Defined in: [packages/core/src/contract-versions.ts:303](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/contract-versions.ts#L303)

Get V2 contract by name

## Parameters

### name

`string`

Contract name

## Returns

[`ContractVersion`](../interfaces/ContractVersion.md) \| `undefined`

Contract version info or undefined

## Example

```ts
const contract = getV2ContractByName('SuperPaymasterV2');
if (contract) {
  console.log(`Version: ${contract.version}`);
}
```
