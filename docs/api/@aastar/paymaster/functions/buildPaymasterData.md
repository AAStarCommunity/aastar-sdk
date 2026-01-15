> **buildPaymasterData**(`paymasterAddress`, `token`, `options?`): `` `0x${string}` ``

Defined in: [V4/PaymasterUtils.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/paymaster/src/V4/PaymasterUtils.ts#L59)

Build paymasterAndData for gasless UserOperation.
Layout: [Paymaster(20)] [VerificationGasLimit(16)] [PostOpGasLimit(16)] [Token(20)] [ValidUntil(6)] [ValidAfter(6)]

## Parameters

### paymasterAddress

`` `0x${string}` ``

### token

`` `0x${string}` ``

### options?

#### postOpGasLimit?

`bigint`

#### validityWindow?

`number`

#### verificationGasLimit?

`bigint`

## Returns

`` `0x${string}` ``
