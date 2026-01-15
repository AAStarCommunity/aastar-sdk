> **buildSuperPaymasterData**(`paymasterAddress`, `operator`, `options?`): `` `0x${string}` ``

Defined in: [packages/paymaster/src/V4/PaymasterUtils.ts:95](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/paymaster/src/V4/PaymasterUtils.ts#L95)

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
