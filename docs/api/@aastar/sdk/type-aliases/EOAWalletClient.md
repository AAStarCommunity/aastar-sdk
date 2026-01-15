```ts
type EOAWalletClient = WalletClient & object;
```

Defined in: [packages/account/src/eoa.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/account/src/eoa.ts#L4)

## Type Declaration

| Name | Type | Defined in |
| ------ | ------ | ------ |
| `getAddress()` | () => `Address` | [packages/account/src/eoa.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/account/src/eoa.ts#L6) |
| `sendTransaction()` | (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/)\> | [packages/account/src/eoa.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/account/src/eoa.ts#L5) |
