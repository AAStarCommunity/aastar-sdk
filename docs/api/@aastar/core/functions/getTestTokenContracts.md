```ts
function getTestTokenContracts(network): object;
```

Defined in: [packages/core/src/contracts.ts:217](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contracts.ts#L217)

Get test token contracts (for development & testing)

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"sepolia"` | Network name |

## Returns

`object`

Test token contract addresses

| Name | Type | Default value | Defined in |
| ------ | ------ | ------ | ------ |
| `apnts` | `` `0x${string}` `` | `APNTS_ADDRESS` | [packages/core/src/contract-addresses.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contract-addresses.ts#L60) |
| `bpnts` | `` `0x${string}` `` | `GTOKEN_ADDRESS` | [packages/core/src/contract-addresses.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contract-addresses.ts#L62) |
| `gToken` | `` `0x${string}` `` | `GTOKEN_ADDRESS` | [packages/core/src/contract-addresses.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contract-addresses.ts#L61) |
| `mockUSDT` | `` `0x${string}` `` | - | [packages/core/src/contract-addresses.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contract-addresses.ts#L59) |
| `pimToken` | `` `0x${string}` `` | `TOKEN_ADDRESSES.pimToken` | [packages/core/src/contract-addresses.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contract-addresses.ts#L63) |

## Example

```ts
const testTokens = getTestTokenContracts('sepolia');
console.log(testTokens.mockUSDT);
```
