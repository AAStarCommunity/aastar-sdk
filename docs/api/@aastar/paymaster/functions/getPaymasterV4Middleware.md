> **getPaymasterV4Middleware**(`config`): `object`

Defined in: [V4/index.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/paymaster/src/V4/index.ts#L17)

Constructs the middleware for Paymaster V4.
Returns the `paymasterAndData` hex string.

## Parameters

### config

[`PaymasterV4MiddlewareConfig`](../type-aliases/PaymasterV4MiddlewareConfig.md)

## Returns

`object`

### sponsorUserOperation()

> **sponsorUserOperation**: (`args`) => `Promise`\<\{ `paymasterAndData`: `` `0x${string}` ``; `preVerificationGas`: `any`; `verificationGasLimit`: `bigint`; \}\>

#### Parameters

##### args

###### userOperation

`any`

#### Returns

`Promise`\<\{ `paymasterAndData`: `` `0x${string}` ``; `preVerificationGas`: `any`; `verificationGasLimit`: `bigint`; \}\>
