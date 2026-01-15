```ts
type EOAWalletClient = WalletClient & object;
```

Defined in: [packages/account/src/eoa.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/account/src/eoa.ts#L4)

## Type Declaration

| Name | Type | Defined in |
| ------ | ------ | ------ |
| `getAddress()` | () => `Address` | [packages/account/src/eoa.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/account/src/eoa.ts#L6) |
| `sendTransaction()` | (`args`) => `Promise`\<`Hash`\> | [packages/account/src/eoa.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/account/src/eoa.ts#L5) |
