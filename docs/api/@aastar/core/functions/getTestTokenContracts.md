> **getTestTokenContracts**(`network`): `object`

Defined in: [packages/core/src/contracts.ts:217](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/contracts.ts#L217)

Get test token contracts (for development & testing)

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"sepolia"` | Network name |

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
