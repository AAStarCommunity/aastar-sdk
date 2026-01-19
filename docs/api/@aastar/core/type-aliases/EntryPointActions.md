> **EntryPointActions** = `object`

Defined in: [packages/core/src/actions/entryPoint.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/entryPoint.ts#L11)

## Properties

### balanceOf()

> **balanceOf**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/entryPoint.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/entryPoint.ts#L12)

#### Parameters

##### args

###### account

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### depositTo()

> **depositTo**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/entryPoint.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/entryPoint.ts#L13)

#### Parameters

##### args

###### account

`Address`

###### amount

`bigint`

###### txAccount?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### entryPointAddress

> **entryPointAddress**: `Address`

Defined in: [packages/core/src/actions/entryPoint.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/entryPoint.ts#L16)

***

### getDepositInfo()

> **getDepositInfo**: (`args`) => `Promise`\<\{ `deposit`: `bigint`; `stake`: `bigint`; `staked`: `boolean`; `unstakeDelaySec`: `number`; `withdrawTime`: `number`; \}\>

Defined in: [packages/core/src/actions/entryPoint.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/entryPoint.ts#L15)

#### Parameters

##### args

###### account

`Address`

#### Returns

`Promise`\<\{ `deposit`: `bigint`; `stake`: `bigint`; `staked`: `boolean`; `unstakeDelaySec`: `number`; `withdrawTime`: `number`; \}\>

***

### getNonce()

> **getNonce**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/entryPoint.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/entryPoint.ts#L14)

#### Parameters

##### args

###### key

`bigint`

###### sender

`Address`

#### Returns

`Promise`\<`bigint`\>
