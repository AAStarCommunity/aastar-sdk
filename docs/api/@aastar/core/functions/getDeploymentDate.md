> **getDeploymentDate**(`network`, `contractName`): `string` \| `undefined`

Defined in: [packages/core/src/contracts.ts:376](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/contracts.ts#L376)

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
