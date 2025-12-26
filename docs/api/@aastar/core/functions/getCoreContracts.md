> **getCoreContracts**(`network`): `object`

Defined in: [packages/core/src/contracts.ts:184](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/contracts.ts#L184)

Get core system contracts

## Parameters

### network

`"sepolia"`

Network name

## Returns

`object`

Core contract addresses

### aPNTs

> `readonly` **aPNTs**: `` `0x${string}` `` \| `undefined`

### gToken

> `readonly` **gToken**: `` `0x${string}` ``

### gTokenStaking

> `readonly` **gTokenStaking**: `` `0x${string}` ``

### mySBT

> `readonly` **mySBT**: `` `0x${string}` ``

### paymasterFactory

> `readonly` **paymasterFactory**: `` `0x${string}` ``

### registry

> `readonly` **registry**: `` `0x${string}` ``

### superPaymaster

> `readonly` **superPaymaster**: `` `0x${string}` ``

## Example

```ts
const core = getCoreContracts('sepolia');
console.log(core.superPaymaster);
console.log(core.registry);
```
