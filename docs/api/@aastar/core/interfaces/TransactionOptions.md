Defined in: [packages/core/src/clients/types.ts:53](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/clients/types.ts#L53)

Common options for transaction methods

## Properties

### account?

> `optional` **account**: `` `0x${string}` `` \| [`Account`](https://viem.sh/docs/index.html)

Defined in: [packages/core/src/clients/types.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/clients/types.ts#L58)

Override the account to use for the transaction.
If not provided, uses the account from the WalletClient.

***

### value?

> `optional` **value**: `bigint`

Defined in: [packages/core/src/clients/types.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/clients/types.ts#L63)

Optional value to send with the transaction (in wei)
