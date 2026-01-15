```ts
type SimpleSmartAccount = LocalAccount & object;
```

Defined in: [packages/account/src/accounts/simple.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/account/src/accounts/simple.ts#L15)

## Type Declaration

| Name | Type | Defined in |
| ------ | ------ | ------ |
| `entryPoint` | `Address` | [packages/account/src/accounts/simple.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/account/src/accounts/simple.ts#L19) |
| `getDummySignature()` | () => `Promise`\<[`Hex`](https://viem.sh/docs/)\> | [packages/account/src/accounts/simple.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/account/src/accounts/simple.ts#L18) |
| `getInitCode()` | () => `Promise`\<[`Hex`](https://viem.sh/docs/)\> | [packages/account/src/accounts/simple.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/account/src/accounts/simple.ts#L17) |
| `signUserOperation()` | (`userOp`) => `Promise`\<[`Hex`](https://viem.sh/docs/)\> | [packages/account/src/accounts/simple.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/account/src/accounts/simple.ts#L16) |
