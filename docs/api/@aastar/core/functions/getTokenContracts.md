> **getTokenContracts**(`network`): `object`

Defined in: [packages/core/src/contracts.ts:201](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/contracts.ts#L201)

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
