> **getTokenContracts**(`network`): `object`

Defined in: [packages/core/src/contracts.ts:201](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/contracts.ts#L201)

Get token system contracts

## Parameters

### network

`"sepolia"`

Network name

## Returns

`object`

Token contract addresses

### aPNTs

> `readonly` **aPNTs**: `` `0x${string}` `` = `APNTS_ADDRESS`

### gToken

> `readonly` **gToken**: `` `0x${string}` `` = `GTOKEN_ADDRESS`

### pimToken

> `readonly` **pimToken**: `` `0x${string}` ``

### xPNTsFactory

> `readonly` **xPNTsFactory**: `` `0x${string}` `` = `XPNTS_FACTORY_ADDRESS`

## Example

```ts
const tokens = getTokenContracts('sepolia');
console.log(tokens.xPNTsFactory);
console.log(tokens.mySBT);
```
