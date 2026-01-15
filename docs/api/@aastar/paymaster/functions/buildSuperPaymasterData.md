```ts
function buildSuperPaymasterData(
   paymasterAddress, 
   operator, 
   options?): `0x${string}`;
```

Defined in: [V4/PaymasterUtils.ts:95](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/paymaster/src/V4/PaymasterUtils.ts#L95)

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
