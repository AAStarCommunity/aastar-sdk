> **AccountActions** = `object`

Defined in: [packages/core/src/actions/account.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/account.ts#L7)

## Properties

### addDeposit()

> **addDeposit**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/account.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/account.ts#L12)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### entryPoint()

> **entryPoint**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/account.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/account.ts#L11)

#### Returns

`Promise`\<`Address`\>

***

### execute()

> **execute**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/account.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/account.ts#L8)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### dest

`Address`

###### func

[`Hex`](https://viem.sh/docs/index.html)

###### value

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### executeBatch()

> **executeBatch**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/account.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/account.ts#L9)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### dest

`Address`[]

###### func

[`Hex`](https://viem.sh/docs/index.html)[]

###### value

`bigint`[]

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### getDeposit()

> **getDeposit**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/account.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/account.ts#L14)

#### Returns

`Promise`\<`bigint`\>

***

### getNonce()

> **getNonce**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/account.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/account.ts#L10)

#### Returns

`Promise`\<`bigint`\>

***

### owner()

> **owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/account.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/account.ts#L15)

#### Returns

`Promise`\<`Address`\>

***

### withdrawDepositTo()

> **withdrawDepositTo**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/account.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/actions/account.ts#L13)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

###### withdrawAddress

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>
