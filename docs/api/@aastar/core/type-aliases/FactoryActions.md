> **FactoryActions** = `object`

Defined in: [packages/core/src/actions/factory.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/factory.ts#L4)

## Properties

### createXPNTs()

> **createXPNTs**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/factory.ts#L5)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### address

`Address`

###### domain

`string`

###### hub

`string`

###### name

`string`

###### pool

`bigint`

###### symbol

`string`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### getXPNTsTokenAddress()

> **getXPNTsTokenAddress**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/factory.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/factory.ts#L7)

#### Parameters

##### args

###### address

`Address`

###### hub

`string`

#### Returns

`Promise`\<`Address`\>

***

### setSuperPaymasterInFactory()

> **setSuperPaymasterInFactory**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/factory.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/factory.ts#L6)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### address

`Address`

###### paymaster

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>
