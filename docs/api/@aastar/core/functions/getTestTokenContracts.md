> **getTestTokenContracts**(`network`): `object`

Defined in: [packages/core/src/contracts.ts:217](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/contracts.ts#L217)

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
