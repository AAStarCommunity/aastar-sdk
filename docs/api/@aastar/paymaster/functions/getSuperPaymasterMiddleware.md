> **getSuperPaymasterMiddleware**(`config`): `object`

Defined in: [SuperPaymaster/index.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/paymaster/src/SuperPaymaster/index.ts#L18)

Constructs the middleware for SuperPaymaster.
Returns the `paymasterAndData` hex string.

## Parameters

### config

[`PaymasterConfig`](../type-aliases/PaymasterConfig.md)

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
