> **getPaymasterV4Middleware**(`config`): `object`

Defined in: [V4/PaymasterUtils.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/paymaster/src/V4/PaymasterUtils.ts#L32)

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
