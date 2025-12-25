> **getDeploymentDate**(`network`, `contractName`): `string` \| `undefined`

Defined in: [packages/core/src/contracts.ts:376](https://github.com/AAStarCommunity/aastar-sdk/blob/4d5be576edce490d7405a108d648a390d96f3eb5/packages/core/src/contracts.ts#L376)

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
const date = getDeploymentDate('sepolia', 'superPaymasterV2');
// '2025-10-25'
```
