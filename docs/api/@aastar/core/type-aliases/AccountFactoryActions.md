```ts
type AccountFactoryActions = object;
```

Defined in: [packages/core/src/actions/account.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/account.ts#L24)

## Properties

### accountImplementation()

```ts
accountImplementation: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/account.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/account.ts#L29)

#### Returns

`Promise`\<`Address`\>

***

### createAccount()

```ts
createAccount: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/account.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/account.ts#L25)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `owner`: `Address`; `salt`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.owner` | `Address` |
| `args.salt` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### getAddress()

```ts
getAddress: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/account.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/account.ts#L26)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `owner`: `Address`; `salt`: `bigint`; \} |
| `args.owner` | `Address` |
| `args.salt` | `bigint` |

#### Returns

`Promise`\<`Address`\>
