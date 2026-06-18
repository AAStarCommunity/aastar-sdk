> **getTestTokenContracts**(`network`): `object`

Defined in: [packages/core/src/contracts.ts:217](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/contracts.ts#L217)

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
