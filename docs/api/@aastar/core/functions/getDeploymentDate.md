> **getDeploymentDate**(`network`, `contractName`): `string` \| `undefined`

Defined in: [packages/core/src/contracts.ts:376](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/contracts.ts#L376)

Get contract deployment date

## Parameters

### network

`"sepolia"`

Network name

### contractName

`string`

Contract name

## Returns

`string` \| `undefined`

Deployment date string (YYYY-MM-DD)

## Example

```ts
const date = getDeploymentDate('sepolia', 'superPaymaster');
// '2025-10-25'
```
