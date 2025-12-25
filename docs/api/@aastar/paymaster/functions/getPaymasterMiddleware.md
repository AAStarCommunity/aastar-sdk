> **getPaymasterMiddleware**(`config`): `object`

Defined in: [packages/paymaster/src/AOA-Plus/index.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/4d5be576edce490d7405a108d648a390d96f3eb5/packages/paymaster/src/AOA-Plus/index.ts#L18)

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
