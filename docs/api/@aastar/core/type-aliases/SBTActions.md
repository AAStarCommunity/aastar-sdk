> **SBTActions** = `object`

Defined in: [packages/core/src/actions/sbt.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L7)

## Properties

### airdropMint()

> **airdropMint**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L10)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### to

`Address`

###### tokenURI

`string`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### approve()

> **approve**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L27)

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

Defined in: [packages/core/src/actions/sbt.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L23)

#### Parameters

##### args

###### owner

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### burn()

> **burn**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L46)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### tokenId

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### burnSBT()

> **burnSBT**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L47)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### tokenId

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### daoMultisig()

> **daoMultisig**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L73)

#### Returns

`Promise`\<`Address`\>

***

### deactivateMembership()

> **deactivateMembership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L52)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### tokenId

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### getActiveMemberships()

> **getActiveMemberships**: (`args`) => `Promise`\<`any`[]\>

Defined in: [packages/core/src/actions/sbt.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L16)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`any`[]\>

***

### getApproved()

> **getApproved**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L29)

#### Parameters

##### args

###### tokenId

`bigint`

#### Returns

`Promise`\<`Address`\>

***

### getCommunityMembership()

> **getCommunityMembership**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L14)

#### Parameters

##### args

###### community

`Address`

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### getMemberships()

> **getMemberships**: (`args`) => `Promise`\<`any`[]\>

Defined in: [packages/core/src/actions/sbt.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L15)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`any`[]\>

***

### getSBTData()

> **getSBTData**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/sbt.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L13)

#### Parameters

##### args

###### tokenId

`bigint`

#### Returns

`Promise`\<`any`\>

***

### getUserSBT()

> **getUserSBT**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L12)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### GTOKEN()

> **GTOKEN**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L84)

#### Returns

`Promise`\<`Address`\>

***

### GTOKEN\_STAKING()

> **GTOKEN\_STAKING**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L83)

#### Returns

`Promise`\<`Address`\>

***

### isApprovedForAll()

> **isApprovedForAll**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/sbt.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L30)

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

Defined in: [packages/core/src/actions/sbt.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L56)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### leaveCommunity()

> **leaveCommunity**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L51)

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

> **membershipIndex**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/sbt.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L20)

#### Parameters

##### args

###### index

`bigint`

###### user

`Address`

#### Returns

`Promise`\<`any`\>

***

### minLockAmount()

> **minLockAmount**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:64](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L64)

#### Returns

`Promise`\<`bigint`\>

***

### mint()

> **mint**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L45)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### to

`Address`

###### tokenURI

`string`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### mintFee()

> **mintFee**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L62)

#### Returns

`Promise`\<`bigint`\>

***

### mintForRole()

> **mintForRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L11)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### to

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### name()

> **name**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/sbt.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L33)

#### Returns

`Promise`\<`string`\>

***

### nextTokenId()

> **nextTokenId**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L42)

#### Returns

`Promise`\<`bigint`\>

***

### owner()

> **owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:88](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L88)

#### Returns

`Promise`\<`Address`\>

***

### ownerOf()

> **ownerOf**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L24)

#### Parameters

##### args

###### tokenId

`bigint`

#### Returns

`Promise`\<`Address`\>

***

### pause()

> **pause**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:68](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L68)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### paused()

> **paused**: () => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/sbt.ts:70](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L70)

#### Returns

`Promise`\<`boolean`\>

***

### recordActivity()

> **recordActivity**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L55)

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

Defined in: [packages/core/src/actions/sbt.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L82)

#### Returns

`Promise`\<`Address`\>

***

### renounceOwnership()

> **renounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:90](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L90)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### reputationCalculator()

> **reputationCalculator**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L58)

#### Returns

`Promise`\<`Address`\>

***

### safeMintForRole()

> **safeMintForRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L9)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### to

`Address`

###### tokenURI

`string`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### safeTransferFrom()

> **safeTransferFrom**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L25)

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

### sbtData()

> **sbtData**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/sbt.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L19)

#### Parameters

##### args

###### tokenId

`bigint`

#### Returns

`Promise`\<`any`\>

***

### setApprovalForAll()

> **setApprovalForAll**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L28)

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

Defined in: [packages/core/src/actions/sbt.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L48)

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

Defined in: [packages/core/src/actions/sbt.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L74)

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

Defined in: [packages/core/src/actions/sbt.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L65)

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

Defined in: [packages/core/src/actions/sbt.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L63)

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

Defined in: [packages/core/src/actions/sbt.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L75)

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

Defined in: [packages/core/src/actions/sbt.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L59)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### calculator

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setSuperPaymaster()

> **setSuperPaymaster**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L76)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### paymaster

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### SUPER\_PAYMASTER()

> **SUPER\_PAYMASTER**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:85](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L85)

#### Returns

`Promise`\<`Address`\>

***

### supportsInterface()

> **supportsInterface**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/sbt.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L41)

#### Parameters

##### args

###### interfaceId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`boolean`\>

***

### symbol()

> **symbol**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/sbt.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L34)

#### Returns

`Promise`\<`string`\>

***

### tokenByIndex()

> **tokenByIndex**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L39)

#### Parameters

##### args

###### index

`bigint`

#### Returns

`Promise`\<`bigint`\>

***

### tokenOfOwnerByIndex()

> **tokenOfOwnerByIndex**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L40)

#### Parameters

##### args

###### index

`bigint`

###### owner

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### tokenURI()

> **tokenURI**: (`args`) => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/sbt.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L35)

#### Parameters

##### args

###### tokenId

`bigint`

#### Returns

`Promise`\<`string`\>

***

### totalSupply()

> **totalSupply**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L38)

#### Returns

`Promise`\<`bigint`\>

***

### transferFrom()

> **transferFrom**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L26)

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

Defined in: [packages/core/src/actions/sbt.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L89)

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

Defined in: [packages/core/src/actions/sbt.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L69)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### userToSBT()

> **userToSBT**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L18)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### verifyCommunityMembership()

> **verifyCommunityMembership**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/sbt.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L17)

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

Defined in: [packages/core/src/actions/sbt.ts:79](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L79)

#### Returns

`Promise`\<`string`\>

***

### weeklyActivity()

> **weeklyActivity**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/sbt.ts#L57)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>
