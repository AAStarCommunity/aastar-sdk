```ts
function getAllV2Contracts(): ContractVersion[];
```

Defined in: [packages/core/src/contract-versions.ts:264](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contract-versions.ts#L264)

Get all V2 contracts with VERSION interface

## Returns

[`ContractVersion`](../interfaces/ContractVersion.md)[]

Array of all V2 contract versions

## Example

```ts
const allV2Contracts = getAllV2Contracts();
for (const contract of allV2Contracts) {
  console.log(`${contract.name} v${contract.version} at ${contract.address}`);
}
```
