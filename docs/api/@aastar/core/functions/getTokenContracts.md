> **getTokenContracts**(`network`): `object`

Defined in: [packages/core/src/contracts.ts:201](https://github.com/AAStarCommunity/aastar-sdk/blob/02429a724df6d1db083144e00515cd09857c0075/packages/core/src/contracts.ts#L201)

Get token system contracts

## Parameters

### network

`"sepolia"`

Network name

## Returns

`object`

Token contract addresses

### mySBT

> `readonly` **mySBT**: `"0xa4eda5d023ea94a60b1d4b5695f022e1972858e7"` = `'0xa4eda5d023ea94a60b1d4b5695f022e1972858e7'`

### xPNTsFactory

> `readonly` **xPNTsFactory**: `"0x9dD72cB42427fC9F7Bf0c949DB7def51ef29D6Bd"` = `'0x9dD72cB42427fC9F7Bf0c949DB7def51ef29D6Bd'`

## Example

```ts
const tokens = getTokenContracts('sepolia');
console.log(tokens.xPNTsFactory);
console.log(tokens.mySBT);
```
