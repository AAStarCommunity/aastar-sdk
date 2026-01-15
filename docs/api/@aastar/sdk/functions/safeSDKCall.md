```ts
function safeSDKCall<T>(promise): Promise<SDKResult<T>>;
```

Defined in: [packages/sdk/src/types/result.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/sdk/src/types/result.ts#L19)

Utility to wrap a Promise in an SDKResult.
Handles AAStarError explicitly, and wraps unknown errors.

## Type Parameters

| Type Parameter |
| ------ |
| `T` |

## Parameters

| Parameter | Type |
| ------ | ------ |
| `promise` | `Promise`\<`T`\> |

## Returns

`Promise`\<[`SDKResult`](../type-aliases/SDKResult.md)\<`T`\>\>
