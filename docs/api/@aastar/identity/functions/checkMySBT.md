> **checkMySBT**(`client`, `sbtAddress`, `user`): `Promise`\<\{ `balance`: `bigint`; `hasSBT`: `boolean`; \}\>

Defined in: [mysbt.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/identity/src/mysbt.ts#L14)

Check if user holds MySBT token (identity verification).

Does NOT swallow read errors: `balanceOf` returns 0 for a non-holder, so any
thrown error is an RPC/transport/contract failure — masking it as
`{ hasSBT: false }` would turn a transient RPC blip into a false "no SBT" and
wrongly fail eligibility checks. The error propagates so the caller can retry
or surface "couldn't determine" rather than "no SBT".

## Parameters

| Parameter | Type |
| ------ | ------ |
| `client` | `any` |
| `sbtAddress` | `` `0x${string}` `` |
| `user` | `` `0x${string}` `` |

## Returns

`Promise`\<\{ `balance`: `bigint`; `hasSBT`: `boolean`; \}\>
