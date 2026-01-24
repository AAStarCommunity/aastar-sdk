Defined in: [packages/core/src/clients/types.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/clients/types.ts#L52)

Common options for transaction methods

## Properties

### account?

> `optional` **account**: `` `0x${string}` `` \| [`Account`](https://viem.sh/docs/index.html)

Defined in: [packages/core/src/clients/types.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/clients/types.ts#L57)

Override the account to use for the transaction.
If not provided, uses the account from the WalletClient.

***

### value?

> `optional` **value**: `bigint`

Defined in: [packages/core/src/clients/types.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/clients/types.ts#L62)

Optional value to send with the transaction (in wei)
