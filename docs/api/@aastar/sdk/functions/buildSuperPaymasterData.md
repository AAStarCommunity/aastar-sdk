```ts
function buildSuperPaymasterData(
   paymasterAddress, 
   operator, 
   options?): `0x${string}`;
```

Defined in: [packages/paymaster/src/V4/PaymasterUtils.ts:95](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/paymaster/src/V4/PaymasterUtils.ts#L95)

Build paymasterAndData for SuperPaymaster V3.
Layout: [Paymaster(20)] [verGas(16)] [postGas(16)] [operator(20)] [maxRate(32)]

## Parameters

| Parameter | Type |
| ------ | ------ |
| `paymasterAddress` | `` `0x${string}` `` |
| `operator` | `` `0x${string}` `` |
| `options?` | \{ `postOpGasLimit?`: `bigint`; `verificationGasLimit?`: `bigint`; \} |
| `options.postOpGasLimit?` | `bigint` |
| `options.verificationGasLimit?` | `bigint` |

## Returns

`` `0x${string}` ``
