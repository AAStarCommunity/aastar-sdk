```ts
function getV2ContractByAddress(address): ContractVersion | undefined;
```

Defined in: [packages/core/src/contract-versions.ts:322](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/contract-versions.ts#L322)

Get V2 contract by address

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `address` | `string` | Contract address (case-insensitive) |

## Returns

[`ContractVersion`](../interfaces/ContractVersion.md) \| `undefined`

Contract version info or undefined

## Example

```ts
const contract = getV2ContractByAddress('0xB97A20aca3D6770Deca299a1aD9DAFb12d1e5eCf');
if (contract) {
  console.log(`Found: ${contract.name} v${contract.version}`);
}
```
