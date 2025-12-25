> **getTestTokenContracts**(`network`): `object`

Defined in: [packages/core/src/contracts.ts:217](https://github.com/AAStarCommunity/aastar-sdk/blob/77dddacf493396832f1a40715c8e5cda4ba43c65/packages/core/src/contracts.ts#L217)

Get test token contracts (for development & testing)

## Parameters

### network

`"sepolia"`

Network name

## Returns

`object`

Test token contract addresses

### aPNTs

> `readonly` **aPNTs**: `"0xBD0710596010a157B88cd141d797E8Ad4bb2306b"` = `'0xBD0710596010a157B88cd141d797E8Ad4bb2306b'`

### bPNTs

> `readonly` **bPNTs**: `"0x70Da2c1B7Fcf471247Bc3B09f8927a4ab1751Ba3"` = `'0x70Da2c1B7Fcf471247Bc3B09f8927a4ab1751Ba3'`

### mockUSDT

> `readonly` **mockUSDT**: `"0x14EaC6C3D49AEDff3D59773A7d7bfb50182bCfDc"` = `'0x14EaC6C3D49AEDff3D59773A7d7bfb50182bCfDc'`

## Example

```ts
const testTokens = getTestTokenContracts('sepolia');
console.log(testTokens.mockUSDT);
```
