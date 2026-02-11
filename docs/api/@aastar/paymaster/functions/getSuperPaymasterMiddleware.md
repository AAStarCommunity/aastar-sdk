> **getSuperPaymasterMiddleware**(`config`): `object`

Defined in: [SuperPaymaster/index.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/paymaster/src/SuperPaymaster/index.ts#L19)

Constructs the middleware for SuperPaymaster.
Returns the `paymasterAndData` hex string.

## Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`PaymasterConfig`](../type-aliases/PaymasterConfig.md) |

## Returns

`object`

### sponsorUserOperation()

> **sponsorUserOperation**: (`args`) => `Promise`\<\{ `paymasterAndData`: `` `0x${string}` ``; `preVerificationGas`: `any`; `verificationGasLimit`: `bigint`; \}\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `userOperation`: `any`; \} |
| `args.userOperation` | `any` |

#### Returns

`Promise`\<\{ `paymasterAndData`: `` `0x${string}` ``; `preVerificationGas`: `any`; `verificationGasLimit`: `bigint`; \}\>
