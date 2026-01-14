> **getTestTokenContracts**(`network`): `object`

Defined in: [packages/core/src/contracts.ts:217](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/contracts.ts#L217)

Get test token contracts (for development & testing)

## Parameters

### network

`"sepolia"`

Network name

## Returns

`object`

Test token contract addresses

### apnts

> `readonly` **apnts**: `` `0x${string}` `` = `APNTS_ADDRESS`

### bpnts

> `readonly` **bpnts**: `` `0x${string}` `` = `GTOKEN_ADDRESS`

### gToken

> `readonly` **gToken**: `` `0x${string}` `` = `GTOKEN_ADDRESS`

### mockUSDT

> `readonly` **mockUSDT**: `` `0x${string}` ``

### pimToken

> `readonly` **pimToken**: `` `0x${string}` `` = `TOKEN_ADDRESSES.pimToken`

## Example

```ts
const testTokens = getTestTokenContracts('sepolia');
console.log(testTokens.mockUSDT);
```
