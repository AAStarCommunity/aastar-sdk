> **getSuperPaymasterMiddleware**(`config`): `object`

Defined in: [SuperPaymaster/index.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/paymaster/src/SuperPaymaster/index.ts#L19)

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
