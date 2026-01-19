> **buildSuperPaymasterData**(`paymasterAddress`, `operator`, `options?`): `` `0x${string}` ``

Defined in: [V4/PaymasterUtils.ts:94](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/paymaster/src/V4/PaymasterUtils.ts#L94)

Build paymasterAndData for SuperPaymaster V3.
Layout: [Paymaster(20)] [verGas(16)] [postGas(16)] [operator(20)] [maxRate(32)]
Total: 104 bytes

IMPORTANT: SuperPaymaster contract generates validUntil internally using:
  validUntil = cachedPrice.updatedAt + priceStalenessThreshold
Do NOT include validUntil/validAfter in paymasterAndData!

## Parameters

### paymasterAddress

`` `0x${string}` ``

### operator

`` `0x${string}` ``

### options?

#### maxRate?

`bigint`

#### postOpGasLimit?

`bigint`

#### verificationGasLimit?

`bigint`

## Returns

`` `0x${string}` ``
