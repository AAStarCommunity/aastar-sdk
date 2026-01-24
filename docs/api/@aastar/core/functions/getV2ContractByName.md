> **getV2ContractByName**(`name`): [`ContractVersion`](../interfaces/ContractVersion.md) \| `undefined`

Defined in: [packages/core/src/contract-versions.ts:303](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/contract-versions.ts#L303)

Get V2 contract by name

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `name` | `string` | Contract name |

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
