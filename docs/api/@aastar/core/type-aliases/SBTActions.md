> **SBTActions** = `object`

Defined in: [packages/core/src/actions/sbt.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/sbt.ts#L4)

## Properties

### airdropMint()

> **airdropMint**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/sbt.ts#L9)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### roleData

[`Hex`](https://viem.sh/docs/index.html)

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### getCommunityMembership()

> **getCommunityMembership**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/sbt.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/sbt.ts#L7)

#### Parameters

##### args

###### community

`Address`

###### tokenId

`bigint`

#### Returns

`Promise`\<`any`\>

***

### getSBTData()

> **getSBTData**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/sbt.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/sbt.ts#L6)

#### Parameters

##### args

###### tokenId

`bigint`

#### Returns

`Promise`\<`any`\>

***

### getSBTURI()

> **getSBTURI**: (`args`) => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/sbt.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/sbt.ts#L12)

#### Parameters

##### args

###### tokenId

`bigint`

#### Returns

`Promise`\<`string`\>

***

### getUserSBTId()

> **getUserSBTId**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/sbt.ts#L5)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### mintForRole()

> **mintForRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/sbt.ts#L8)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### roleData

[`Hex`](https://viem.sh/docs/index.html)

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### mintSBT()

> **mintSBT**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/sbt.ts#L10)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### community

`Address`

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setBaseURI()

> **setBaseURI**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/actions/sbt.ts#L11)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### uri

`string`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>
