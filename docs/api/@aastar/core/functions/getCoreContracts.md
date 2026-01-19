> **getCoreContracts**(`network`): `object`

Defined in: [packages/core/src/contracts.ts:184](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/contracts.ts#L184)

Get core system contracts

## Parameters

### network

`"sepolia"`

Network name

## Returns

`object`

Core contract addresses

### aPNTs

> `readonly` **aPNTs**: `` `0x${string}` `` = `APNTS_ADDRESS`

### dvtValidator

> `readonly` **dvtValidator**: `` `0x${string}` `` = `DVT_VALIDATOR_ADDRESS`

### entryPoint

> `readonly` **entryPoint**: `` `0x${string}` `` = `ENTRY_POINT_ADDRESS`

### gToken

> `readonly` **gToken**: `` `0x${string}` `` = `GTOKEN_ADDRESS`

### gTokenStaking

> `readonly` **gTokenStaking**: `` `0x${string}` `` = `GTOKEN_STAKING_ADDRESS`

### mySBT

> `readonly` **mySBT**: `` `0x${string}` `` = `SBT_ADDRESS`

### paymasterFactory

> `readonly` **paymasterFactory**: `` `0x${string}` `` = `PAYMASTER_FACTORY_ADDRESS`

### paymasterV4

> `readonly` **paymasterV4**: `` `0x${string}` ``

### registry

> `readonly` **registry**: `` `0x${string}` `` = `REGISTRY_ADDRESS`

### superPaymaster

> `readonly` **superPaymaster**: `` `0x${string}` `` = `SUPER_PAYMASTER_ADDRESS`

### xPNTsFactory

> `readonly` **xPNTsFactory**: `` `0x${string}` `` = `XPNTS_FACTORY_ADDRESS`

## Example

```ts
const core = getCoreContracts('sepolia');
console.log(core.superPaymaster);
console.log(core.registry);
```
