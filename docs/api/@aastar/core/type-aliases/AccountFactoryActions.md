> **AccountFactoryActions** = `object`

Defined in: [packages/core/src/actions/account.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/account.ts#L24)

## Properties

### accountImplementation()

> **accountImplementation**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/account.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/account.ts#L29)

#### Returns

`Promise`\<`Address`\>

***

### createAccount()

> **createAccount**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/account.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/account.ts#L25)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### owner

`Address`

###### salt

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### getAddress()

> **getAddress**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/account.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/actions/account.ts#L26)

#### Parameters

##### args

###### owner

`Address`

###### salt

`bigint`

#### Returns

`Promise`\<`Address`\>
