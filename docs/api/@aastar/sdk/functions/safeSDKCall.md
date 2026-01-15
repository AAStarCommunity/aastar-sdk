```ts
function safeSDKCall<T>(promise): Promise<SDKResult<T>>;
```

Defined in: [packages/sdk/src/types/result.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/sdk/src/types/result.ts#L19)

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
