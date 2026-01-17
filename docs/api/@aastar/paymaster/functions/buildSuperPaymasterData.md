> **buildSuperPaymasterData**(`paymasterAddress`, `operator`, `options?`): `` `0x${string}` ``

Defined in: [V4/PaymasterUtils.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/paymaster/src/V4/PaymasterUtils.ts#L89)

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
