```ts
function getTokenContracts(network): object;
```

Defined in: [packages/core/src/contracts.ts:201](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contracts.ts#L201)

Get token system contracts

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"sepolia"` | Network name |

## Returns

`object`

Token contract addresses

| Name | Type | Default value | Defined in |
| ------ | ------ | ------ | ------ |
| `aPNTs` | `` `0x${string}` `` | `APNTS_ADDRESS` | [packages/core/src/contract-addresses.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contract-addresses.ts#L50) |
| `gToken` | `` `0x${string}` `` | `GTOKEN_ADDRESS` | [packages/core/src/contract-addresses.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contract-addresses.ts#L51) |
| `pimToken` | `` `0x${string}` `` | - | [packages/core/src/contract-addresses.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contract-addresses.ts#L52) |
| `xPNTsFactory` | `` `0x${string}` `` | `XPNTS_FACTORY_ADDRESS` | [packages/core/src/contract-addresses.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contract-addresses.ts#L49) |

## Example

```ts
const tokens = getTokenContracts('sepolia');
console.log(tokens.xPNTsFactory);
console.log(tokens.mySBT);
```
