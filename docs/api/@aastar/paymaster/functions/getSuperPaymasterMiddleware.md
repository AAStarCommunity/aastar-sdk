> **getSuperPaymasterMiddleware**(`config`): `object`

Defined in: [SuperPaymaster/index.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/paymaster/src/SuperPaymaster/index.ts#L19)

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
