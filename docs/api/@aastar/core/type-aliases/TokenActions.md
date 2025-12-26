> **TokenActions** = `object`

Defined in: [packages/core/src/actions/tokens.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/tokens.ts#L4)

## Properties

### getDebt()

> **getDebt**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/tokens.ts#L6)

#### Parameters

##### args

###### token

`Address`

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### mintXPNTs()

> **mintXPNTs**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/tokens.ts#L7)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

###### to

`Address`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### repayDebt()

> **repayDebt**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/tokens.ts#L5)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### transferAndCall()

> **transferAndCall**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/tokens.ts#L8)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

###### data?

[`Hex`](https://viem.sh/docs/index.html)

###### to

`Address`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### updateExchangeRate()

> **updateExchangeRate**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/tokens.ts#L9)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### newRate

`bigint`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>
