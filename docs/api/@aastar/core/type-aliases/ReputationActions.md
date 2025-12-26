> **ReputationActions** = `object`

Defined in: [packages/core/src/actions/reputation.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/reputation.ts#L4)

## Properties

### syncToRegistry()

> **syncToRegistry**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/reputation.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/reputation.ts#L5)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### activities

`bigint`[][]

###### communities

`Address`[]

###### epoch

`bigint`

###### proof

[`Hex`](https://viem.sh/docs/index.html)

###### ruleIds

[`Hex`](https://viem.sh/docs/index.html)[][]

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>
