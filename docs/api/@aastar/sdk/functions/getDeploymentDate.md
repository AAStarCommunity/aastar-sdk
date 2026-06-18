> **getDeploymentDate**(`network`, `contractName`): `string` \| `undefined`

Defined in: [packages/core/src/contracts.ts:376](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/contracts.ts#L376)

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
