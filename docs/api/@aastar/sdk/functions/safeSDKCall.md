> **safeSDKCall**\<`T`\>(`promise`): `Promise`\<[`SDKResult`](../type-aliases/SDKResult.md)\<`T`\>\>

Defined in: [packages/sdk/src/types/result.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/sdk/src/types/result.ts#L19)

Utility to wrap a Promise in an SDKResult.
Handles AAStarError explicitly, and wraps unknown errors.

## Type Parameters

### T

`T`

## Parameters

### promise

`Promise`\<`T`\>

## Returns

`Promise`\<[`SDKResult`](../type-aliases/SDKResult.md)\<`T`\>\>
