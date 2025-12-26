> **getSuperPaymasterMiddleware**(`config`): `object`

Defined in: [SuperPaymaster/index.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/paymaster/src/SuperPaymaster/index.ts#L18)

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
