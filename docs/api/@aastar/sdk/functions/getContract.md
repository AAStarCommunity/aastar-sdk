> **getContract**(`network`, `category`, `name`): `string`

Defined in: [packages/core/src/contracts.ts:151](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/contracts.ts#L151)

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
