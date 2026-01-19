> **getContract**(`network`, `category`, `name`): `string`

Defined in: [packages/core/src/contracts.ts:151](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/contracts.ts#L151)

Get a specific contract address

## Parameters

### network

`"sepolia"`

Network name

### category

[`ContractCategory`](../type-aliases/ContractCategory.md)

Contract category

### name

`string`

Contract name

## Returns

`string`

Contract address

## Example

```ts
const address = getContract('sepolia', 'core', 'superPaymaster');
```
