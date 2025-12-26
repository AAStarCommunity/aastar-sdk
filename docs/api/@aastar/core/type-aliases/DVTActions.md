> **DVTActions** = `object`

Defined in: [packages/core/src/actions/dvt.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/dvt.ts#L4)

## Properties

### createSlashProposal()

> **createSlashProposal**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/dvt.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/dvt.ts#L5)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### address

`Address`

###### level

`number`

###### operator

`Address`

###### reason

`string`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### executeSlashWithProof()

> **executeSlashWithProof**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/dvt.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/dvt.ts#L7)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### address

`Address`

###### epoch

`bigint`

###### newScores

`bigint`[]

###### proof

[`Hex`](https://viem.sh/docs/index.html)

###### proposalId

`bigint`

###### repUsers

`Address`[]

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### isValidator()

> **isValidator**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/dvt.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/dvt.ts#L8)

#### Parameters

##### args

###### address

`Address`

###### user

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### signSlashProposal()

> **signSlashProposal**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/dvt.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/dvt.ts#L6)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### address

`Address`

###### proposalId

`bigint`

###### signature

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>
