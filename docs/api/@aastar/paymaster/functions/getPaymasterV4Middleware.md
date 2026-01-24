> **getPaymasterV4Middleware**(`config`): `object`

Defined in: [V4/PaymasterUtils.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/paymaster/src/V4/PaymasterUtils.ts#L31)

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
