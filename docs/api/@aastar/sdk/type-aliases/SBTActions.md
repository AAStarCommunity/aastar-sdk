> **SBTActions** = `object`

Defined in: [packages/core/src/actions/sbt.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L5)

## Properties

### sbtAirdropMint()

> **sbtAirdropMint**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L8)

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

### sbtApprove()

> **sbtApprove**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L25)

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

### sbtBalanceOf()

> **sbtBalanceOf**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L21)

#### Parameters

##### args

###### owner

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### sbtBurn()

> **sbtBurn**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L44)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### tokenId

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### sbtBurnSBT()

> **sbtBurnSBT**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L45)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### tokenId

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### sbtDaoMultisig()

> **sbtDaoMultisig**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:72](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L72)

#### Returns

`Promise`\<`Address`\>

***

### sbtDeactivateAllMemberships()

> **sbtDeactivateAllMemberships**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L46)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### sbtDeactivateMembership()

> **sbtDeactivateMembership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L51)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### tokenId

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### sbtGetActiveMemberships()

> **sbtGetActiveMemberships**: (`args`) => `Promise`\<`any`[]\>

Defined in: [packages/core/src/actions/sbt.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L14)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`any`[]\>

***

### sbtGetApproved()

> **sbtGetApproved**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L27)

#### Parameters

##### args

###### tokenId

`bigint`

#### Returns

`Promise`\<`Address`\>

***

### sbtGetCommunityMembership()

> **sbtGetCommunityMembership**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L12)

#### Parameters

##### args

###### community

`Address`

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### sbtGetMemberships()

> **sbtGetMemberships**: (`args`) => `Promise`\<`any`[]\>

Defined in: [packages/core/src/actions/sbt.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L13)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`any`[]\>

***

### sbtGetSBTData()

> **sbtGetSBTData**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/sbt.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L11)

#### Parameters

##### args

###### tokenId

`bigint`

#### Returns

`Promise`\<`any`\>

***

### sbtGetUserSBT()

> **sbtGetUserSBT**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L10)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### sbtGTOKEN()

> **sbtGTOKEN**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L83)

#### Returns

`Promise`\<`Address`\>

***

### sbtGTOKEN\_STAKING()

> **sbtGTOKEN\_STAKING**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L82)

#### Returns

`Promise`\<`Address`\>

***

### sbtIsApprovedForAll()

> **sbtIsApprovedForAll**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/sbt.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L28)

#### Parameters

##### args

###### operator

`Address`

###### owner

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### sbtLastActivityTime()

> **sbtLastActivityTime**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L55)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### sbtLeaveCommunity()

> **sbtLeaveCommunity**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L50)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### community

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### sbtMembershipIndex()

> **sbtMembershipIndex**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/sbt.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L18)

#### Parameters

##### args

###### index

`bigint`

###### user

`Address`

#### Returns

`Promise`\<`any`\>

***

### sbtMinLockAmount()

> **sbtMinLockAmount**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L63)

#### Returns

`Promise`\<`bigint`\>

***

### sbtMint()

> **sbtMint**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L43)

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

### sbtMintFee()

> **sbtMintFee**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L61)

#### Returns

`Promise`\<`bigint`\>

***

### sbtMintForRole()

> **sbtMintForRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L9)

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

### sbtName()

> **sbtName**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/sbt.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L31)

#### Returns

`Promise`\<`string`\>

***

### sbtNextTokenId()

> **sbtNextTokenId**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L40)

#### Returns

`Promise`\<`bigint`\>

***

### sbtOwner()

> **sbtOwner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:87](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L87)

#### Returns

`Promise`\<`Address`\>

***

### sbtOwnerOf()

> **sbtOwnerOf**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L22)

#### Parameters

##### args

###### tokenId

`bigint`

#### Returns

`Promise`\<`Address`\>

***

### sbtPause()

> **sbtPause**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L67)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### sbtPaused()

> **sbtPaused**: () => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/sbt.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L69)

#### Returns

`Promise`\<`boolean`\>

***

### sbtRecordActivity()

> **sbtRecordActivity**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L54)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### sbtREGISTRY()

> **sbtREGISTRY**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:81](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L81)

#### Returns

`Promise`\<`Address`\>

***

### sbtRenounceOwnership()

> **sbtRenounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L89)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### sbtReputationCalculator()

> **sbtReputationCalculator**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L57)

#### Returns

`Promise`\<`Address`\>

***

### sbtSafeMintForRole()

> **sbtSafeMintForRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L7)

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

### sbtSafeTransferFrom()

> **sbtSafeTransferFrom**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L23)

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

### sbtSbtData()

> **sbtSbtData**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/sbt.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L17)

#### Parameters

##### args

###### tokenId

`bigint`

#### Returns

`Promise`\<`any`\>

***

### sbtSetApprovalForAll()

> **sbtSetApprovalForAll**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L26)

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

### sbtSetBaseURI()

> **sbtSetBaseURI**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L47)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### baseURI

`string`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### sbtSetDAOMultisig()

> **sbtSetDAOMultisig**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L73)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### multisig

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### sbtSetMinLockAmount()

> **sbtSetMinLockAmount**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:64](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L64)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### sbtSetMintFee()

> **sbtSetMintFee**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L62)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### fee

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### sbtSetRegistry()

> **sbtSetRegistry**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L74)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### registry

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### sbtSetReputationCalculator()

> **sbtSetReputationCalculator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L58)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### calculator

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### sbtSetSuperPaymaster()

> **sbtSetSuperPaymaster**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L75)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### paymaster

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### sbtSUPER\_PAYMASTER()

> **sbtSUPER\_PAYMASTER**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L84)

#### Returns

`Promise`\<`Address`\>

***

### sbtSupportsInterface()

> **sbtSupportsInterface**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/sbt.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L39)

#### Parameters

##### args

###### interfaceId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`boolean`\>

***

### sbtSymbol()

> **sbtSymbol**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/sbt.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L32)

#### Returns

`Promise`\<`string`\>

***

### sbtTokenByIndex()

> **sbtTokenByIndex**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L37)

#### Parameters

##### args

###### index

`bigint`

#### Returns

`Promise`\<`bigint`\>

***

### sbtTokenOfOwnerByIndex()

> **sbtTokenOfOwnerByIndex**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L38)

#### Parameters

##### args

###### index

`bigint`

###### owner

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### sbtTokenURI()

> **sbtTokenURI**: (`args`) => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/sbt.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L33)

#### Parameters

##### args

###### tokenId

`bigint`

#### Returns

`Promise`\<`string`\>

***

### sbtTotalSupply()

> **sbtTotalSupply**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L36)

#### Returns

`Promise`\<`bigint`\>

***

### sbtTransferFrom()

> **sbtTransferFrom**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L24)

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

### sbtTransferSBTOwnership()

> **sbtTransferSBTOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:88](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L88)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### newOwner

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### sbtUnpause()

> **sbtUnpause**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:68](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L68)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### sbtUserToSBT()

> **sbtUserToSBT**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L16)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### sbtVerifyCommunityMembership()

> **sbtVerifyCommunityMembership**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/sbt.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L15)

#### Parameters

##### args

###### community

`Address`

###### user

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### sbtVersion()

> **sbtVersion**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/sbt.ts:78](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L78)

#### Returns

`Promise`\<`string`\>

***

### sbtWeeklyActivity()

> **sbtWeeklyActivity**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/sbt.ts#L56)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>
