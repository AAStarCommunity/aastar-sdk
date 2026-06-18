> **SBTActions** = `object`

Defined in: [packages/core/src/actions/sbt.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L30)

## Properties

### airdropMint()

> **airdropMint**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L32)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `roleData`: [`Hex`](https://viem.sh/docs/index.html); `roleId`: [`Hex`](https://viem.sh/docs/index.html); `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.roleData` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### approve()

> **approve**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L56)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `to`: `Address`; `tokenId`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.to` | `Address` |
| `args.tokenId` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### balanceOf()

> **balanceOf**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L52)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `owner`: `Address`; \} |
| `args.owner` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### batchAirdropMint()

> **batchAirdropMint**: (`args`) => `Promise`\<[`BatchMintResult`](BatchMintResult.md)[]\>

Defined in: [packages/core/src/actions/sbt.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L34)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `continueOnError?`: `boolean`; `items`: `object`[]; `onProgress?`: (`done`, `total`, `lastResult`) => `void`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.continueOnError?` | `boolean` |
| `args.items` | `object`[] |
| `args.onProgress?` | (`done`, `total`, `lastResult`) => `void` |

#### Returns

`Promise`\<[`BatchMintResult`](BatchMintResult.md)[]\>

***

### burnSBT()

> **burnSBT**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L71)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### daoMultisig()

> **daoMultisig**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:99](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L99)

#### Returns

`Promise`\<`Address`\>

***

### deactivateAllMemberships()

> **deactivateAllMemberships**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:77](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L77)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### deactivateMembership()

> **deactivateMembership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L76)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `community`: `Address`; `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.community` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### getActiveMemberships()

> **getActiveMemberships**: (`args`) => `Promise`\<`Address`[]\>

Defined in: [packages/core/src/actions/sbt.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L45)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `tokenId`: `bigint`; \} |
| `args.tokenId` | `bigint` |

#### Returns

`Promise`\<`Address`[]\>

***

### getApproved()

> **getApproved**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L58)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `tokenId`: `bigint`; \} |
| `args.tokenId` | `bigint` |

#### Returns

`Promise`\<`Address`\>

***

### getCommunityMembership()

> **getCommunityMembership**: (`args`) => `Promise`\<[`SBTMembership`](SBTMembership.md)\>

Defined in: [packages/core/src/actions/sbt.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L43)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; `tokenId`: `bigint`; \} |
| `args.community` | `Address` |
| `args.tokenId` | `bigint` |

#### Returns

`Promise`\<[`SBTMembership`](SBTMembership.md)\>

***

### getMemberships()

> **getMemberships**: (`args`) => `Promise`\<[`SBTMembership`](SBTMembership.md)[]\>

Defined in: [packages/core/src/actions/sbt.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L44)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `tokenId`: `bigint`; \} |
| `args.tokenId` | `bigint` |

#### Returns

`Promise`\<[`SBTMembership`](SBTMembership.md)[]\>

***

### getSBTData()

> **getSBTData**: (`args`) => `Promise`\<[`SBTData`](SBTData.md)\>

Defined in: [packages/core/src/actions/sbt.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L42)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `tokenId`: `bigint`; \} |
| `args.tokenId` | `bigint` |

#### Returns

`Promise`\<[`SBTData`](SBTData.md)\>

***

### getUserSBT()

> **getUserSBT**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L41)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### GTOKEN()

> **GTOKEN**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:110](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L110)

#### Returns

`Promise`\<`Address`\>

***

### GTOKEN\_STAKING()

> **GTOKEN\_STAKING**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:109](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L109)

#### Returns

`Promise`\<`Address`\>

***

### isApprovedForAll()

> **isApprovedForAll**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/sbt.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L59)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `operator`: `Address`; `owner`: `Address`; \} |
| `args.operator` | `Address` |
| `args.owner` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### lastActivityTime()

> **lastActivityTime**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:81](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L81)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; `tokenId`: `bigint`; \} |
| `args.community` | `Address` |
| `args.tokenId` | `bigint` |

#### Returns

`Promise`\<`bigint`\>

***

### leaveCommunity()

> **leaveCommunity**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L75)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `community`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.community` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### membershipIndex()

> **membershipIndex**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L49)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; `tokenId`: `bigint`; \} |
| `args.community` | `Address` |
| `args.tokenId` | `bigint` |

#### Returns

`Promise`\<`bigint`\>

***

### minLockAmount()

> **minLockAmount**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:90](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L90)

#### Returns

`Promise`\<`bigint`\>

***

### mintFee()

> **mintFee**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:88](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L88)

#### Returns

`Promise`\<`bigint`\>

***

### mintForRole()

> **mintForRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L33)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `roleData`: [`Hex`](https://viem.sh/docs/index.html); `roleId`: [`Hex`](https://viem.sh/docs/index.html); `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.roleData` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### mintOrAddMembership()

> **mintOrAddMembership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L40)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `roleData`: [`Hex`](https://viem.sh/docs/index.html); `roleId`: [`Hex`](https://viem.sh/docs/index.html); `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.roleData` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### name()

> **name**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/sbt.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L62)

#### Returns

`Promise`\<`string`\>

***

### nextTokenId()

> **nextTokenId**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L67)

#### Returns

`Promise`\<`bigint`\>

***

### ~~owner()~~

> **owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:114](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L114)

#### Returns

`Promise`\<`Address`\>

#### Deprecated

MySBT is not Ownable — it is governed by `daoMultisig`. The deployed ABI has no `owner`. Throws ErrorCode.NOT\_IMPLEMENTED; use [daoMultisig](#daomultisig).

***

### ownerOf()

> **ownerOf**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:53](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L53)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `tokenId`: `bigint`; \} |
| `args.tokenId` | `bigint` |

#### Returns

`Promise`\<`Address`\>

***

### pause()

> **pause**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:94](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L94)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### paused()

> **paused**: () => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/sbt.ts:96](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L96)

#### Returns

`Promise`\<`boolean`\>

***

### recordActivity()

> **recordActivity**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:80](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L80)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### REGISTRY()

> **REGISTRY**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:108](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L108)

#### Returns

`Promise`\<`Address`\>

***

### ~~renounceOwnership()~~

> **renounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:118](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L118)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

MySBT is not Ownable — there is no `renounceOwnership`. Throws ErrorCode.NOT\_IMPLEMENTED.

***

### reputationCalculator()

> **reputationCalculator**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/sbt.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L84)

#### Returns

`Promise`\<`Address`\>

***

### safeTransferFrom()

> **safeTransferFrom**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L54)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `data?`: [`Hex`](https://viem.sh/docs/index.html); `from`: `Address`; `to`: `Address`; `tokenId`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.data?` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.from` | `Address` |
| `args.to` | `Address` |
| `args.tokenId` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### sbtData()

> **sbtData**: (`args`) => `Promise`\<[`SBTData`](SBTData.md)\>

Defined in: [packages/core/src/actions/sbt.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L48)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `tokenId`: `bigint`; \} |
| `args.tokenId` | `bigint` |

#### Returns

`Promise`\<[`SBTData`](SBTData.md)\>

***

### setApprovalForAll()

> **setApprovalForAll**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L57)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `approved`: `boolean`; `operator`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.approved` | `boolean` |
| `args.operator` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setBaseURI()

> **setBaseURI**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:72](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L72)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `baseURI`: `string`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.baseURI` | `string` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setDAOMultisig()

> **setDAOMultisig**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:100](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L100)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `multisig`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.multisig` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setMinLockAmount()

> **setMinLockAmount**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:91](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L91)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amount`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amount` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setMintFee()

> **setMintFee**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L89)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `fee`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.fee` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### ~~setRegistry()~~

> **setRegistry**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:102](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L102)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `registry`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.registry` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

Removed in the v5.x contract refactor — MySBT has no `setRegistry` (REGISTRY is immutable). Throws ErrorCode.NOT\_IMPLEMENTED.

***

### setReputationCalculator()

> **setReputationCalculator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:85](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L85)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `calculator`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.calculator` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### supportsInterface()

> **supportsInterface**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/sbt.ts:68](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L68)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `interfaceId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.interfaceId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`boolean`\>

***

### symbol()

> **symbol**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/sbt.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L63)

#### Returns

`Promise`\<`string`\>

***

### tokenURI()

> **tokenURI**: (`args`) => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/sbt.ts:64](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L64)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `tokenId`: `bigint`; \} |
| `args.tokenId` | `bigint` |

#### Returns

`Promise`\<`string`\>

***

### transferFrom()

> **transferFrom**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L55)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `from`: `Address`; `to`: `Address`; `tokenId`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.from` | `Address` |
| `args.to` | `Address` |
| `args.tokenId` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### ~~transferOwnership()~~

> **transferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:116](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L116)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newOwner`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newOwner` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

MySBT is not Ownable — there is no `transferOwnership`. Throws ErrorCode.NOT\_IMPLEMENTED; use [setDAOMultisig](#setdaomultisig).

***

### unpause()

> **unpause**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/sbt.ts:95](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L95)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### userToSBT()

> **userToSBT**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/sbt.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L47)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### verifyCommunityMembership()

> **verifyCommunityMembership**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/sbt.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L46)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; `user`: `Address`; \} |
| `args.community` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### version()

> **version**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/sbt.ts:105](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L105)

#### Returns

`Promise`\<`string`\>

***

### ~~weeklyActivity()~~

> **weeklyActivity**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/sbt.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/sbt.ts#L83)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; `tokenId`: `bigint`; `week`: `bigint`; \} |
| `args.community` | `Address` |
| `args.tokenId` | `bigint` |
| `args.week` | `bigint` |

#### Returns

`Promise`\<`boolean`\>

#### Deprecated

Removed in the v5.x contract refactor — MySBT no longer tracks per-week activity (no `weeklyActivity` getter). Throws ErrorCode.NOT\_IMPLEMENTED; use [lastActivityTime](#lastactivitytime) and compare against your week window.
