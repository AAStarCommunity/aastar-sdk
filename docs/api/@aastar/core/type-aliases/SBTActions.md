> **SBTActions** = `object`

Defined in: [packages/core/src/actions/sbt.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L22)

## Properties

### airdropMint()

> **airdropMint**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L24)

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

### approve()

> **approve**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L41)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### to

`Address`

###### tokenId

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### balanceOf()

> **balanceOf**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L37)

#### Parameters

##### args

###### owner

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### burnSBT()

> **burnSBT**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L56)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### daoMultisig()

> **daoMultisig**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L83)

#### Returns

`Promise`\<`Address`\>

***

### deactivateAllMemberships()

> **deactivateAllMemberships**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L62)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### deactivateMembership()

> **deactivateMembership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L61)

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

### getActiveMemberships()

> **getActiveMemberships**: (`args`) => `Promise`\<`Address`[]\>

Defined in: [packages/core/src/actions/sbt.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L30)

#### Parameters

##### args

###### tokenId

`bigint`

#### Returns

`Promise`\<`Address`[]\>

***

### getApproved()

> **getApproved**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L43)

#### Parameters

##### args

###### tokenId

`bigint`

#### Returns

`Promise`\<`Address`\>

***

### getCommunityMembership()

> **getCommunityMembership**: (`args`) => `Promise`\<[`SBTMembership`](SBTMembership.md)\>

Defined in: [packages/core/src/actions/sbt.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L28)

#### Parameters

##### args

###### community

`Address`

###### tokenId

`bigint`

#### Returns

`Promise`\<[`SBTMembership`](SBTMembership.md)\>

***

### getMemberships()

> **getMemberships**: (`args`) => `Promise`\<[`SBTMembership`](SBTMembership.md)[]\>

Defined in: [packages/core/src/actions/sbt.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L29)

#### Parameters

##### args

###### tokenId

`bigint`

#### Returns

`Promise`\<[`SBTMembership`](SBTMembership.md)[]\>

***

### getSBTData()

> **getSBTData**: (`args`) => `Promise`\<[`SBTData`](SBTData.md)\>

Defined in: [packages/core/src/actions/sbt.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L27)

#### Parameters

##### args

###### tokenId

`bigint`

#### Returns

`Promise`\<[`SBTData`](SBTData.md)\>

***

### getUserSBT()

> **getUserSBT**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L26)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### GTOKEN()

> **GTOKEN**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:93](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L93)

#### Returns

`Promise`\<`Address`\>

***

### GTOKEN\_STAKING()

> **GTOKEN\_STAKING**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:92](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L92)

#### Returns

`Promise`\<`Address`\>

***

### isApprovedForAll()

> **isApprovedForAll**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/sbt.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L44)

#### Parameters

##### args

###### operator

`Address`

###### owner

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### lastActivityTime()

> **lastActivityTime**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L66)

#### Parameters

##### args

###### community

`Address`

###### tokenId

`bigint`

#### Returns

`Promise`\<`bigint`\>

***

### leaveCommunity()

> **leaveCommunity**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L60)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### community

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### membershipIndex()

> **membershipIndex**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L34)

#### Parameters

##### args

###### community

`Address`

###### tokenId

`bigint`

#### Returns

`Promise`\<`bigint`\>

***

### minLockAmount()

> **minLockAmount**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L74)

#### Returns

`Promise`\<`bigint`\>

***

### mintFee()

> **mintFee**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:72](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L72)

#### Returns

`Promise`\<`bigint`\>

***

### mintForRole()

> **mintForRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L25)

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

### name()

> **name**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/sbt.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L47)

#### Returns

`Promise`\<`string`\>

***

### nextTokenId()

> **nextTokenId**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L52)

#### Returns

`Promise`\<`bigint`\>

***

### owner()

> **owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:96](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L96)

#### Returns

`Promise`\<`Address`\>

***

### ownerOf()

> **ownerOf**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L38)

#### Parameters

##### args

###### tokenId

`bigint`

#### Returns

`Promise`\<`Address`\>

***

### pause()

> **pause**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:78](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L78)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### paused()

> **paused**: () => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/sbt.ts:80](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L80)

#### Returns

`Promise`\<`boolean`\>

***

### recordActivity()

> **recordActivity**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L65)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### REGISTRY()

> **REGISTRY**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:91](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L91)

#### Returns

`Promise`\<`Address`\>

***

### renounceOwnership()

> **renounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:98](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L98)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### reputationCalculator()

> **reputationCalculator**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:68](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L68)

#### Returns

`Promise`\<`Address`\>

***

### safeTransferFrom()

> **safeTransferFrom**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L39)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### data?

[`Hex`](https://viem.sh/docs/index.html)

###### from

`Address`

###### to

`Address`

###### tokenId

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### sbtData()

> **sbtData**: (`args`) => `Promise`\<[`SBTData`](SBTData.md)\>

Defined in: [packages/core/src/actions/sbt.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L33)

#### Parameters

##### args

###### tokenId

`bigint`

#### Returns

`Promise`\<[`SBTData`](SBTData.md)\>

***

### setApprovalForAll()

> **setApprovalForAll**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L42)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### approved

`boolean`

###### operator

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setBaseURI()

> **setBaseURI**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L57)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### baseURI

`string`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setDAOMultisig()

> **setDAOMultisig**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L84)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### multisig

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setMinLockAmount()

> **setMinLockAmount**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L75)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setMintFee()

> **setMintFee**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L73)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### fee

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setRegistry()

> **setRegistry**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:85](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L85)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### registry

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setReputationCalculator()

> **setReputationCalculator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L69)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### calculator

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### supportsInterface()

> **supportsInterface**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/sbt.ts:53](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L53)

#### Parameters

##### args

###### interfaceId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`boolean`\>

***

### symbol()

> **symbol**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/sbt.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L48)

#### Returns

`Promise`\<`string`\>

***

### tokenURI()

> **tokenURI**: (`args`) => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/sbt.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L49)

#### Parameters

##### args

###### tokenId

`bigint`

#### Returns

`Promise`\<`string`\>

***

### transferFrom()

> **transferFrom**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L40)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### from

`Address`

###### to

`Address`

###### tokenId

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### transferOwnership()

> **transferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:97](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L97)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### newOwner

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### unpause()

> **unpause**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:79](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L79)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### userToSBT()

> **userToSBT**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L32)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### verifyCommunityMembership()

> **verifyCommunityMembership**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/sbt.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L31)

#### Parameters

##### args

###### community

`Address`

###### user

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### version()

> **version**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/sbt.ts:88](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L88)

#### Returns

`Promise`\<`string`\>

***

### weeklyActivity()

> **weeklyActivity**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/sbt.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/actions/sbt.ts#L67)

#### Parameters

##### args

###### community

`Address`

###### tokenId

`bigint`

###### week

`bigint`

#### Returns

`Promise`\<`boolean`\>
