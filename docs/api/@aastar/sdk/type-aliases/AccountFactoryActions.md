```ts
type AccountFactoryActions = object;
```

Defined in: [packages/core/src/actions/account.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/account.ts#L24)

## Properties

### accountImplementation()

```ts
accountImplementation: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/account.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/account.ts#L29)

#### Returns

`Promise`\<`Address`\>

***

### createAccount()

```ts
createAccount: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/account.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/account.ts#L25)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `owner`: `Address`; `salt`: `bigint`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.owner` | `Address` |
| `args.salt` | `bigint` |

#### Returns

`Promise`\<`Hash`\>

***

### getAddress()

```ts
getAddress: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/account.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/account.ts#L26)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `owner`: `Address`; `salt`: `bigint`; \} |
| `args.owner` | `Address` |
| `args.salt` | `bigint` |

#### Returns

`Promise`\<`Address`\>
