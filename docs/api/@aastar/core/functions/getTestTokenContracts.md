> **getTestTokenContracts**(`network`): `object`

Defined in: [packages/core/src/contracts.ts:217](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/contracts.ts#L217)

Get test token contracts (for development & testing)

## Parameters

### network

`"sepolia"`

Network name

## Returns

`object`

Test token contract addresses

### aPNTs

> `readonly` **aPNTs**: `` `0x${string}` ``

### bPNTs

> `readonly` **bPNTs**: `` `0x${string}` ``

### mockUSDT

> `readonly` **mockUSDT**: `` `0x${string}` ``

## Example

```ts
const testTokens = getTestTokenContracts('sepolia');
console.log(testTokens.mockUSDT);
```
