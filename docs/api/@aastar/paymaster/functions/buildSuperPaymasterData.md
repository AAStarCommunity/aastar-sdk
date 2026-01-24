> **buildSuperPaymasterData**(`paymasterAddress`, `operator`, `options?`): `` `0x${string}` ``

Defined in: [V4/PaymasterUtils.ts:94](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/paymaster/src/V4/PaymasterUtils.ts#L94)

Build paymasterAndData for SuperPaymaster V3.
Layout: [Paymaster(20)] [verGas(16)] [postGas(16)] [operator(20)] [maxRate(32)]
Total: 104 bytes

IMPORTANT: SuperPaymaster contract generates validUntil internally using:
  validUntil = cachedPrice.updatedAt + priceStalenessThreshold
Do NOT include validUntil/validAfter in paymasterAndData!

## Parameters

| Parameter | Type |
| ------ | ------ |
| `paymasterAddress` | `` `0x${string}` `` |
| `operator` | `` `0x${string}` `` |
| `options?` | \{ `maxRate?`: `bigint`; `postOpGasLimit?`: `bigint`; `verificationGasLimit?`: `bigint`; \} |
| `options.maxRate?` | `bigint` |
| `options.postOpGasLimit?` | `bigint` |
| `options.verificationGasLimit?` | `bigint` |

## Returns

`` `0x${string}` ``
