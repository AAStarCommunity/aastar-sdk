```ts
function getSuperPaymasterMiddleware(config): object;
```

Defined in: [packages/paymaster/src/SuperPaymaster/index.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/paymaster/src/SuperPaymaster/index.ts#L19)

Constructs the middleware for SuperPaymaster.
Returns the `paymasterAndData` hex string.

## Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`PaymasterConfig`](../type-aliases/PaymasterConfig.md) |

## Returns

`object`

| Name | Type | Defined in |
| ------ | ------ | ------ |
| `sponsorUserOperation()` | (`args`) => `Promise`\<\{ `paymasterAndData`: `` `0x${string}` ``; `preVerificationGas`: `any`; `verificationGasLimit`: `bigint`; \}\> | [packages/paymaster/src/SuperPaymaster/index.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/paymaster/src/SuperPaymaster/index.ts#L21) |
