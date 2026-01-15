> **RegistryActions** = `object`

Defined in: [packages/core/src/actions/registry.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L14)

## Properties

### registryAccountToUser()

> **registryAccountToUser**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L89)

#### Parameters

##### args

###### account

`Address`

#### Returns

`Promise`\<`Address`\>

***

### registryAddLevelThreshold()

> **registryAddLevelThreshold**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:87](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L87)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### threshold

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### registryAdminConfigureRole()

> **registryAdminConfigureRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:97](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L97)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### entryBurn

`bigint`

###### exitFeePercent

`number`

###### minExitFee

`bigint`

###### minStake

`bigint`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### registryBatchUpdateGlobalReputation()

> **registryBatchUpdateGlobalReputation**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L48)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### epoch

`bigint`

###### proof

[`Hex`](https://viem.sh/docs/index.html)

###### scores

`bigint`[]

###### users

`Address`[]

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### registryBlsAggregator()

> **registryBlsAggregator**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L62)

#### Returns

`Promise`\<`Address`\>

***

### registryBlsValidator()

> **registryBlsValidator**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L61)

#### Returns

`Promise`\<`Address`\>

***

### registryCalculateExitFee()

> **registryCalculateExitFee**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:86](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L86)

#### Parameters

##### args

###### amount

`bigint`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`bigint`\>

***

### registryCommunityByENS()

> **registryCommunityByENS**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L27)

#### Parameters

##### args

###### ensName

`string`

#### Returns

`Promise`\<`Address`\>

***

### registryCommunityByENSV3()

> **registryCommunityByENSV3**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L29)

#### Parameters

##### args

###### ensName

`string`

#### Returns

`Promise`\<`Address`\>

***

### registryCommunityByName()

> **registryCommunityByName**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L26)

#### Parameters

##### args

###### name

`string`

#### Returns

`Promise`\<`Address`\>

***

### registryCommunityByNameV3()

> **registryCommunityByNameV3**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L28)

#### Parameters

##### args

###### name

`string`

#### Returns

`Promise`\<`Address`\>

***

### registryConfigureRole()

> **registryConfigureRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L16)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### config

[`RoleConfig`](../interfaces/RoleConfig.md)

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### registryCreateNewRole()

> **registryCreateNewRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:98](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L98)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### config

[`RoleConfig`](../interfaces/RoleConfig.md)

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### roleOwner

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### registryCreditTierConfig()

> **registryCreditTierConfig**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:94](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L94)

#### Parameters

##### args

###### level

`bigint`

#### Returns

`Promise`\<`bigint`\>

***

### registryExecutedProposals()

> **registryExecutedProposals**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/registry.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L31)

#### Parameters

##### args

###### proposalId

`bigint`

#### Returns

`Promise`\<`boolean`\>

***

### registryExitRole()

> **registryExitRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:85](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L85)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### registryGetAccountCommunity()

> **registryGetAccountCommunity**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L34)

#### Parameters

##### args

###### account

`Address`

#### Returns

`Promise`\<`Address`\>

***

### registryGetCreditLimit()

> **registryGetCreditLimit**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:92](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L92)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### registryGetRoleConfig()

> **registryGetRoleConfig**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/registry.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L21)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`any`\>

***

### registryGetRoleMemberCount()

> **registryGetRoleMemberCount**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L75)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`bigint`\>

***

### registryGetRoleMembers()

> **registryGetRoleMembers**: (`args`) => `Promise`\<`Address`[]\>

Defined in: [packages/core/src/actions/registry.ts:81](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L81)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`Address`[]\>

***

### registryGetRoleUserCount()

> **registryGetRoleUserCount**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L82)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`bigint`\>

***

### registryGetUserRoles()

> **registryGetUserRoles**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)[]\>

Defined in: [packages/core/src/actions/registry.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L83)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)[]\>

***

### registryGlobalReputation()

> **registryGlobalReputation**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L47)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### registryGTOKEN\_STAKING()

> **registryGTOKEN\_STAKING**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:109](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L109)

#### Returns

`Promise`\<`Address`\>

***

### registryHasRole()

> **registryHasRole**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/registry.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L19)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### registryIsCommunityMember()

> **registryIsCommunityMember**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/registry.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L25)

#### Parameters

##### args

###### community

`Address`

###### user

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### registryIsOperatorBlacklisted()

> **registryIsOperatorBlacklisted**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/registry.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L52)

#### Parameters

##### args

###### operator

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### registryIsReputationSource()

> **registryIsReputationSource**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/registry.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L36)

#### Parameters

##### args

###### source

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### registryLastReputationEpoch()

> **registryLastReputationEpoch**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L35)

#### Returns

`Promise`\<`bigint`\>

***

### registryLevelThresholds()

> **registryLevelThresholds**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L76)

#### Parameters

##### args

###### level

`bigint`

#### Returns

`Promise`\<`bigint`\>

***

### registryMySBT()

> **registryMySBT**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L63)

#### Returns

`Promise`\<`Address`\>

***

### registryMYSBT()

> **registryMYSBT**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:110](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L110)

#### Returns

`Promise`\<`Address`\>

***

### registryOwner()

> **registryOwner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:70](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L70)

#### Returns

`Promise`\<`Address`\>

***

### registryProposedRoleNames()

> **registryProposedRoleNames**: (`args`) => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/registry.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L30)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`string`\>

***

### registryRegisterRole()

> **registryRegisterRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L17)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### data

[`Hex`](https://viem.sh/docs/index.html)

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### registryRegisterRoleSelf()

> **registryRegisterRoleSelf**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L18)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### data

[`Hex`](https://viem.sh/docs/index.html)

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### registryRenounceOwnership()

> **registryRenounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L71)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### registryReputationSource()

> **registryReputationSource**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L66)

#### Returns

`Promise`\<`Address`\>

***

### registryROLE\_ANODE()

> **registryROLE\_ANODE**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:108](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L108)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### registryROLE\_COMMUNITY()

> **registryROLE\_COMMUNITY**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:102](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L102)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### registryROLE\_DVT()

> **registryROLE\_DVT**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:106](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L106)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### registryROLE\_ENDUSER()

> **registryROLE\_ENDUSER**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:103](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L103)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### registryROLE\_KMS()

> **registryROLE\_KMS**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:107](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L107)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### registryROLE\_PAYMASTER\_AOA()

> **registryROLE\_PAYMASTER\_AOA**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:105](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L105)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### registryROLE\_PAYMASTER\_SUPER()

> **registryROLE\_PAYMASTER\_SUPER**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:104](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L104)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### registryRoleConfigs()

> **registryRoleConfigs**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/registry.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L74)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`any`\>

***

### registryRoleCounts()

> **registryRoleCounts**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L37)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`bigint`\>

***

### registryRoleLockDurations()

> **registryRoleLockDurations**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:79](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L79)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`bigint`\>

***

### registryRoleMemberIndex()

> **registryRoleMemberIndex**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L39)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### registryRoleMembers()

> **registryRoleMembers**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L38)

#### Parameters

##### args

###### index

`bigint`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`Address`\>

***

### registryRoleMetadata()

> **registryRoleMetadata**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L40)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user?

`Address`

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### registryRoleOwners()

> **registryRoleOwners**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:80](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L80)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`Address`\>

***

### registryRoleSBTTokenIds()

> **registryRoleSBTTokenIds**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L42)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### registryRoleStakes()

> **registryRoleStakes**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L41)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### registrySafeMintForRole()

> **registrySafeMintForRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:99](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L99)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### data

[`Hex`](https://viem.sh/docs/index.html)

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### registrySetBLSAggregator()

> **registrySetBLSAggregator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L56)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### aggregator

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### registrySetBLSValidator()

> **registrySetBLSValidator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L55)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### validator

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### registrySetCreditTier()

> **registrySetCreditTier**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:93](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L93)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### level

`bigint`

###### limit

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### registrySetLevelThreshold()

> **registrySetLevelThreshold**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:88](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L88)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### index

`bigint`

###### threshold

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### registrySetMySBT()

> **registrySetMySBT**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L57)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### sbt

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### registrySetReputationSource()

> **registrySetReputationSource**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L60)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### source

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### registrySetRoleLockDuration()

> **registrySetRoleLockDuration**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L22)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### duration

`bigint`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### registrySetRoleOwner()

> **registrySetRoleOwner**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L23)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### newOwner

`Address`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### registrySetStaking()

> **registrySetStaking**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L59)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### staking

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### registrySetSuperPaymaster()

> **registrySetSuperPaymaster**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L58)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### paymaster

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### registryStaking()

> **registryStaking**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L65)

#### Returns

`Promise`\<`Address`\>

***

### registrySUPER\_PAYMASTER()

> **registrySUPER\_PAYMASTER**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:111](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L111)

#### Returns

`Promise`\<`Address`\>

***

### registrySuperPaymaster()

> **registrySuperPaymaster**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:64](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L64)

#### Returns

`Promise`\<`Address`\>

***

### registryTransferOwnership()

> **registryTransferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L69)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### newOwner

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### registryUnRegisterRole()

> **registryUnRegisterRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L20)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### registryUpdateOperatorBlacklist()

> **registryUpdateOperatorBlacklist**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L51)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### operator

`Address`

###### proof

[`Hex`](https://viem.sh/docs/index.html)

###### statuses

`boolean`[]

###### users

`Address`[]

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### registryUserRoleCount()

> **registryUserRoleCount**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L44)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### registryUserRoles()

> **registryUserRoles**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L43)

#### Parameters

##### args

###### index

`bigint`

###### user

`Address`

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### registryVersion()

> **registryVersion**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/registry.ts:114](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/registry.ts#L114)

#### Returns

`Promise`\<`string`\>
