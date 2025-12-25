> **SBTActions** = `object`

Defined in: [packages/core/src/actions/sbt.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/77dddacf493396832f1a40715c8e5cda4ba43c65/packages/core/src/actions/sbt.ts#L4)

## Properties

### airdropMint()

> **airdropMint**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/77dddacf493396832f1a40715c8e5cda4ba43c65/packages/core/src/actions/sbt.ts#L9)

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

Defined in: [packages/core/src/actions/sbt.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/77dddacf493396832f1a40715c8e5cda4ba43c65/packages/core/src/actions/sbt.ts#L7)

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

Defined in: [packages/core/src/actions/sbt.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/77dddacf493396832f1a40715c8e5cda4ba43c65/packages/core/src/actions/sbt.ts#L6)

#### Parameters

##### args

###### tokenId

`bigint`

#### Returns

`Promise`\<`any`\>

***

### getUserSBTId()

> **getUserSBTId**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/77dddacf493396832f1a40715c8e5cda4ba43c65/packages/core/src/actions/sbt.ts#L5)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### mintForRole()

> **mintForRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/77dddacf493396832f1a40715c8e5cda4ba43c65/packages/core/src/actions/sbt.ts#L8)

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
