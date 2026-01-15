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

Defined in: [packages/sdk/src/types/result.ts:3](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/sdk/src/types/result.ts#L3)

## Type Parameters

| Type Parameter |
| ------ |
| `T` |
