> **AccountFactoryActions** = `object`

Defined in: [packages/core/src/actions/account.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/account.ts#L18)

## Properties

### createAccount()

> **createAccount**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/account.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/account.ts#L19)

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

Defined in: [packages/core/src/actions/account.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/account.ts#L20)

#### Parameters

##### args

###### owner

`Address`

###### salt

`bigint`

#### Returns

`Promise`\<`Address`\>
