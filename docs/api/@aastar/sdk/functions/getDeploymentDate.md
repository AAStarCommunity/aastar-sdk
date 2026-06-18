> **getDeploymentDate**(`network`, `contractName`): `string` \| `undefined`

Defined in: [packages/core/src/contracts.ts:376](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/contracts.ts#L376)

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
