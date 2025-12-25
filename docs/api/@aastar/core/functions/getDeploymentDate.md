> **getDeploymentDate**(`network`, `contractName`): `string` \| `undefined`

Defined in: [packages/core/src/contracts.ts:376](https://github.com/AAStarCommunity/aastar-sdk/blob/401447c149b116a7176de09bdf973a40913dd2f1/packages/core/src/contracts.ts#L376)

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
