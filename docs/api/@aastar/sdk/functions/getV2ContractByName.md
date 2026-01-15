```ts
function getV2ContractByName(name): ContractVersion | undefined;
```

Defined in: [packages/core/src/contract-versions.ts:303](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/contract-versions.ts#L303)

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
