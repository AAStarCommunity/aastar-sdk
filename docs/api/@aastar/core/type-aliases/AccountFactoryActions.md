> **AccountFactoryActions** = `object`

Defined in: [packages/core/src/actions/account.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/account.ts#L19)

## Properties

### createAccount()

> **createAccount**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/account.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/account.ts#L20)

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

Defined in: [packages/core/src/actions/account.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/account.ts#L21)

#### Parameters

##### args

###### owner

`Address`

###### salt

`bigint`

#### Returns

`Promise`\<`Address`\>
