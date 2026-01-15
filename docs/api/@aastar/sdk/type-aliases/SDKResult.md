```ts
type SDKResult<T> = 
  | {
  data: T;
  success: true;
}
  | {
  error: AAStarError;
  success: false;
};
```

Defined in: [packages/sdk/src/types/result.ts:3](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/sdk/src/types/result.ts#L3)

## Type Parameters

| Type Parameter |
| ------ |
| `T` |
