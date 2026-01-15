```ts
function buildPaymasterData(
   paymasterAddress, 
   token, 
   options?): `0x${string}`;
```

Defined in: [V4/PaymasterUtils.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/paymaster/src/V4/PaymasterUtils.ts#L59)

Build paymasterAndData for gasless UserOperation.
Layout: [Paymaster(20)] [VerificationGasLimit(16)] [PostOpGasLimit(16)] [Token(20)] [ValidUntil(6)] [ValidAfter(6)]

## Parameters

| Parameter | Type |
| ------ | ------ |
| `paymasterAddress` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |
| `options?` | \{ `postOpGasLimit?`: `bigint`; `validityWindow?`: `number`; `verificationGasLimit?`: `bigint`; \} |
| `options.postOpGasLimit?` | `bigint` |
| `options.validityWindow?` | `number` |
| `options.verificationGasLimit?` | `bigint` |

## Returns

`` `0x${string}` ``
