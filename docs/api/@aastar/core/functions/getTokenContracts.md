> **getTokenContracts**(`network`): `object`

Defined in: [packages/core/src/contracts.ts:201](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/contracts.ts#L201)

Get token system contracts

## Parameters

### network

`"sepolia"`

Network name

## Returns

`object`

Token contract addresses

### xPNTsFactory

> `readonly` **xPNTsFactory**: `` `0x${string}` `` = `XPNTS_FACTORY_ADDRESS`

## Example

```ts
const tokens = getTokenContracts('sepolia');
console.log(tokens.xPNTsFactory);
console.log(tokens.mySBT);
```
