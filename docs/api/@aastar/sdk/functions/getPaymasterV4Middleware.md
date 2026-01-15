```ts
function getPaymasterV4Middleware(config): object;
```

Defined in: [packages/paymaster/src/V4/PaymasterUtils.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/paymaster/src/V4/PaymasterUtils.ts#L32)

Constructs the middleware for Paymaster V4.
Returns the `paymasterAndData` hex string.

## Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`PaymasterV4MiddlewareConfig`](../type-aliases/PaymasterV4MiddlewareConfig.md) |

## Returns

`object`

| Name | Type | Defined in |
| ------ | ------ | ------ |
| `sponsorUserOperation()` | (`args`) => `Promise`\<\{ `paymasterAndData`: `` `0x${string}` ``; `preVerificationGas`: `any`; `verificationGasLimit`: `bigint`; \}\> | [packages/paymaster/src/V4/PaymasterUtils.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/paymaster/src/V4/PaymasterUtils.ts#L34) |
