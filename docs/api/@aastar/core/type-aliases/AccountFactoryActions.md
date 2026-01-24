> **AccountFactoryActions** = `object`

Defined in: [packages/core/src/actions/account.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/account.ts#L19)

## Properties

### createAccount()

> **createAccount**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/account.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/account.ts#L20)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `owner`: `Address`; `salt`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.owner` | `Address` |
| `args.salt` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### getAddress()

> **getAddress**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/account.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/account.ts#L21)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `owner`: `Address`; `salt`: `bigint`; \} |
| `args.owner` | `Address` |
| `args.salt` | `bigint` |

#### Returns

`Promise`\<`Address`\>
