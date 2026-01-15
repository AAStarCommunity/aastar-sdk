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

Defined in: [packages/sdk/src/types/result.ts:3](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/sdk/src/types/result.ts#L3)

## Type Parameters

| Type Parameter |
| ------ |
| `T` |
