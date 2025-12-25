> **getCoreContracts**(`network`): `object`

Defined in: [packages/core/src/contracts.ts:184](https://github.com/AAStarCommunity/aastar-sdk/blob/77dddacf493396832f1a40715c8e5cda4ba43c65/packages/core/src/contracts.ts#L184)

Get core system contracts

## Parameters

### network

`"sepolia"`

Network name

## Returns

`object`

Core contract addresses

### gToken

> `readonly` **gToken**: `"0x99cCb70646Be7A5aeE7aF98cE853a1EA1A676DCc"` = `'0x99cCb70646Be7A5aeE7aF98cE853a1EA1A676DCc'`

### gTokenStaking

> `readonly` **gTokenStaking**: `"0xbEbF9b4c6a4cDB92Ac184aF211AdB13a0b9BF6c0"` = `'0xbEbF9b4c6a4cDB92Ac184aF211AdB13a0b9BF6c0'`

### paymasterFactory

> `readonly` **paymasterFactory**: `"0x65Cf6C4ab3d40f3C919b6F3CADC09Efb72817920"` = `'0x65Cf6C4ab3d40f3C919b6F3CADC09Efb72817920'`

### registry

> `readonly` **registry**: `"0x49245E1f3c2dD99b3884ffeD410d0605Cf4dC696"` = `'0x49245E1f3c2dD99b3884ffeD410d0605Cf4dC696'`

### superPaymasterV2

> `readonly` **superPaymasterV2**: `"0x7c3c355d9aa4723402bec2a35b61137b8a10d5db"` = `'0x7c3c355d9aa4723402bec2a35b61137b8a10d5db'`

## Example

```ts
const core = getCoreContracts('sepolia');
console.log(core.superPaymasterV2);
console.log(core.registry);
```
