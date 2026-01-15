```ts
type EOAWalletClient = WalletClient & object;
```

Defined in: [packages/account/src/eoa.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/account/src/eoa.ts#L4)

## Type Declaration

| Name | Type | Defined in |
| ------ | ------ | ------ |
| `getAddress()` | () => `Address` | [packages/account/src/eoa.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/account/src/eoa.ts#L6) |
| `sendTransaction()` | (`args`) => `Promise`\<`Hash`\> | [packages/account/src/eoa.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/account/src/eoa.ts#L5) |
