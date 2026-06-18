> **wrapExecuteUserOp**(`innerCallData`): `string`

Defined in: [packages/airaccount/src/server/utils/execute-user-op.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/utils/execute-user-op.ts#L40)

Wrap inner `execute()` / `executeBatch()` callData with the `executeUserOp` selector so a
guard-enabled (v0.17.2-beta.4) account routes the bundler UserOp through `executeUserOp`.

Only `execute` / `executeBatch` may be wrapped — the account reverts
`UnsupportedInnerSelector` for anything else (including a nested `executeUserOp`).

Owner-direct (non-bundler) `execute()` does NOT need this; no-guard accounts can submit
bare callData. Use this only when building a bundler UserOp for a guard-enabled account.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `innerCallData` | `string` | ABI-encoded `execute`/`executeBatch` calldata (0x-prefixed) |

## Returns

`string`

`executeUserOp.selector ++ innerCallData`

## Throws

if `innerCallData` is not an `execute`/`executeBatch` call
