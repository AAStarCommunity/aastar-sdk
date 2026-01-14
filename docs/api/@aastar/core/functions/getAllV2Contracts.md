> **getAllV2Contracts**(): [`ContractVersion`](../interfaces/ContractVersion.md)[]

Defined in: [packages/core/src/contract-versions.ts:264](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/contract-versions.ts#L264)

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
