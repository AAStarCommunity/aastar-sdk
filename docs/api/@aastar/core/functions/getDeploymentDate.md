```ts
function getDeploymentDate(network, contractName): string | undefined;
```

Defined in: [packages/core/src/contracts.ts:376](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contracts.ts#L376)

Get contract deployment date

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"sepolia"` | Network name |
| `contractName` | `string` | Contract name |

## Returns

`string` \| `undefined`

Deployment date string (YYYY-MM-DD)

## Example

```ts
const date = getDeploymentDate('sepolia', 'superPaymaster');
// '2025-10-25'
```
