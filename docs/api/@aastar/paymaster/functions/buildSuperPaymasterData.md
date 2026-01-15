> **buildSuperPaymasterData**(`paymasterAddress`, `operator`, `options?`): `` `0x${string}` ``

Defined in: [V4/PaymasterUtils.ts:95](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/paymaster/src/V4/PaymasterUtils.ts#L95)

Build paymasterAndData for SuperPaymaster V3.
Layout: [Paymaster(20)] [verGas(16)] [postGas(16)] [operator(20)] [maxRate(32)]

## Parameters

### paymasterAddress

`` `0x${string}` ``

### operator

`` `0x${string}` ``

### options?

#### postOpGasLimit?

`bigint`

#### verificationGasLimit?

`bigint`

## Returns

`` `0x${string}` ``
