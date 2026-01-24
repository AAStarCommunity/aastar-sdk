> **getContract**(`network`, `category`, `name`): `string`

Defined in: [packages/core/src/contracts.ts:151](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/contracts.ts#L151)

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
