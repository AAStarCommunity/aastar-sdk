```ts
type SimpleSmartAccount = LocalAccount & object;
```

Defined in: [packages/account/src/accounts/simple.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/account/src/accounts/simple.ts#L15)

## Type Declaration

| Name | Type | Defined in |
| ------ | ------ | ------ |
| `entryPoint` | `Address` | [packages/account/src/accounts/simple.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/account/src/accounts/simple.ts#L19) |
| `getDummySignature()` | () => `Promise`\<`Hex`\> | [packages/account/src/accounts/simple.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/account/src/accounts/simple.ts#L18) |
| `getInitCode()` | () => `Promise`\<`Hex`\> | [packages/account/src/accounts/simple.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/account/src/accounts/simple.ts#L17) |
| `signUserOperation()` | (`userOp`) => `Promise`\<`Hex`\> | [packages/account/src/accounts/simple.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/account/src/accounts/simple.ts#L16) |
