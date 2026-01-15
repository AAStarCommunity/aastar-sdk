Defined in: [packages/core/src/clients/types.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/clients/types.ts#L52)

Common options for transaction methods

## Properties

### account?

```ts
optional account: `0x${string}` | Account;
```

Defined in: [packages/core/src/clients/types.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/clients/types.ts#L57)

Override the account to use for the transaction.
If not provided, uses the account from the WalletClient.

***

### value?

```ts
optional value: bigint;
```

Defined in: [packages/core/src/clients/types.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/clients/types.ts#L62)

Optional value to send with the transaction (in wei)
