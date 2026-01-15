> **getTestTokenContracts**(`network`): `object`

Defined in: [packages/core/src/contracts.ts:217](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/contracts.ts#L217)

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
