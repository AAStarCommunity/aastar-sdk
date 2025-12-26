> **getTokenContracts**(`network`): `object`

Defined in: [packages/core/src/contracts.ts:201](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/contracts.ts#L201)

Get token system contracts

## Parameters

### network

`"sepolia"`

Network name

## Returns

`object`

Token contract addresses

### xPNTsFactory

> `readonly` **xPNTsFactory**: `"0x9dD72cB42427fC9F7Bf0c949DB7def51ef29D6Bd"` = `'0x9dD72cB42427fC9F7Bf0c949DB7def51ef29D6Bd'`

## Example

```ts
const tokens = getTokenContracts('sepolia');
console.log(tokens.xPNTsFactory);
console.log(tokens.mySBT);
```
