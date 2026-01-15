> **getV2ContractByAddress**(`address`): [`ContractVersion`](../interfaces/ContractVersion.md) \| `undefined`

Defined in: [packages/core/src/contract-versions.ts:322](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/contract-versions.ts#L322)

Get V2 contract by address

## Parameters

### address

`string`

Contract address (case-insensitive)

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
