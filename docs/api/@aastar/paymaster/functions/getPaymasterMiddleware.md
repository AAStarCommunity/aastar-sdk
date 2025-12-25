> **getPaymasterMiddleware**(`config`): `object`

Defined in: [packages/paymaster/src/AOA-Plus/index.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/77dddacf493396832f1a40715c8e5cda4ba43c65/packages/paymaster/src/AOA-Plus/index.ts#L18)

Constructs the middleware for SuperPaymaster V3.
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
