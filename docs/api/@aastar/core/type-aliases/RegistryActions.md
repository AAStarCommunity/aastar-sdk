> **RegistryActions** = `object`

Defined in: [packages/core/src/actions/registry.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L7)

## Properties

### accountToUser()

> **accountToUser**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:86](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L86)

#### Parameters

##### args

###### account

`Address`

#### Returns

`Promise`\<`Address`\>

***

### addLevelThreshold()

> **addLevelThreshold**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L84)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### level

`bigint`

###### threshold

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### adminConfigureRole()

> **adminConfigureRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:79](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L79)

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

### batchUpdateGlobalReputation()

> **batchUpdateGlobalReputation**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L31)

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

### blsAggregator()

> **blsAggregator**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L45)

#### Returns

`Promise`\<`Address`\>

***

### blsValidator()

> **blsValidator**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L44)

#### Returns

`Promise`\<`Address`\>

***

### calculateExitFee()

> **calculateExitFee**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L83)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### communityByENSV3()

> **communityByENSV3**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L23)

#### Parameters

##### args

###### ensName

`string`

#### Returns

`Promise`\<`Address`\>

***

### communityByNameV3()

> **communityByNameV3**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L22)

#### Parameters

##### args

###### name

`string`

#### Returns

`Promise`\<`Address`\>

***

### communityToToken()

> **communityToToken**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L19)

#### Parameters

##### args

###### community

`Address`

#### Returns

`Promise`\<`Address`\>

***

### configureRole()

> **configureRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L9)

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

### createNewRole()

> **createNewRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:80](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L80)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### config

[`RoleConfig`](../interfaces/RoleConfig.md)

###### name

`string`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### creditTierConfig()

> **creditTierConfig**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/registry.ts:85](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L85)

#### Parameters

##### args

###### tier

`bigint`

#### Returns

`Promise`\<`any`\>

***

### creditTiers()

> **creditTiers**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/registry.ts:64](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L64)

#### Parameters

##### args

###### tier

`bigint`

#### Returns

`Promise`\<`any`\>

***

### exitRole()

> **exitRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L82)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### getCommunityRoleData()

> **getCommunityRoleData**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/registry.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L20)

#### Parameters

##### args

###### community

`Address`

#### Returns

`Promise`\<`any`\>

***

### getCreditLimit()

> **getCreditLimit**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L27)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### getGlobalReputation()

> **getGlobalReputation**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L28)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### getRoleConfig()

> **getRoleConfig**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/registry.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L14)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`any`\>

***

### getRoleMemberCount()

> **getRoleMemberCount**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L59)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`bigint`\>

***

### getRoleMembers()

> **getRoleMembers**: (`args`) => `Promise`\<`Address`[]\>

Defined in: [packages/core/src/actions/registry.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L74)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`Address`[]\>

***

### getRoleUserCount()

> **getRoleUserCount**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L75)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`bigint`\>

***

### getUserRoles()

> **getUserRoles**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)[]\>

Defined in: [packages/core/src/actions/registry.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L76)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)[]\>

***

### globalReputation()

> **globalReputation**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L63)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### GTOKEN\_STAKING()

> **GTOKEN\_STAKING**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:96](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L96)

#### Returns

`Promise`\<`Address`\>

***

### hasRole()

> **hasRole**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/registry.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L12)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### isCommunityMember()

> **isCommunityMember**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/registry.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L21)

#### Parameters

##### args

###### community

`Address`

###### user

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### isOperatorBlacklisted()

> **isOperatorBlacklisted**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/registry.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L35)

#### Parameters

##### args

###### operator

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### isReputationSource()

> **isReputationSource**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/registry.ts:99](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L99)

#### Parameters

##### args

###### source

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### lastReputationEpoch()

> **lastReputationEpoch**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:100](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L100)

#### Returns

`Promise`\<`bigint`\>

***

### levelThresholds()

> **levelThresholds**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L65)

#### Parameters

##### args

###### level

`bigint`

#### Returns

`Promise`\<`bigint`\>

***

### mySBT()

> **mySBT**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L46)

#### Returns

`Promise`\<`Address`\>

***

### MYSBT()

> **MYSBT**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:97](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L97)

#### Returns

`Promise`\<`Address`\>

***

### owner()

> **owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:53](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L53)

#### Returns

`Promise`\<`Address`\>

***

### proposedRoleNames()

> **proposedRoleNames**: (`args`) => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/registry.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L24)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`string`\>

***

### registerRole()

> **registerRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L10)

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

### registerRoleSelf()

> **registerRoleSelf**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L11)

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

### renounceOwnership()

> **renounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L54)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### reputationSource()

> **reputationSource**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L49)

#### Returns

`Promise`\<`Address`\>

***

### ROLE\_ANODE()

> **ROLE\_ANODE**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:95](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L95)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### ROLE\_COMMUNITY()

> **ROLE\_COMMUNITY**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L89)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### ROLE\_DVT()

> **ROLE\_DVT**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:93](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L93)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### ROLE\_ENDUSER()

> **ROLE\_ENDUSER**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:90](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L90)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### ROLE\_KMS()

> **ROLE\_KMS**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:94](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L94)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### ROLE\_PAYMASTER\_AOA()

> **ROLE\_PAYMASTER\_AOA**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:92](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L92)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### ROLE\_PAYMASTER\_SUPER()

> **ROLE\_PAYMASTER\_SUPER**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:91](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L91)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### roleConfigs()

> **roleConfigs**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/registry.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L57)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`any`\>

***

### roleCounts()

> **roleCounts**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L58)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`bigint`\>

***

### roleLockDurations()

> **roleLockDurations**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:68](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L68)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`bigint`\>

***

### roleMemberIndex()

> **roleMemberIndex**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L73)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### roleMembers()

> **roleMembers**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L60)

#### Parameters

##### args

###### index

`bigint`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`Address`\>

***

### roleMetadata()

> **roleMetadata**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/registry.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L69)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`any`\>

***

### roleOwners()

> **roleOwners**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:72](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L72)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`Address`\>

***

### roleSBTTokenIds()

> **roleSBTTokenIds**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L71)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### roleStakes()

> **roleStakes**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:70](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L70)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### safeMintForRole()

> **safeMintForRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:81](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L81)

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

### setBLSAggregator()

> **setBLSAggregator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L39)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### aggregator

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setBLSValidator()

> **setBLSValidator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L38)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### validator

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setCreditTier()

> **setCreditTier**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L29)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### params

`any`

###### tier

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setLevelThreshold()

> **setLevelThreshold**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L30)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### level

`bigint`

###### threshold

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setMySBT()

> **setMySBT**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L40)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### sbt

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setReputationSource()

> **setReputationSource**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L43)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### source

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setRoleLockDuration()

> **setRoleLockDuration**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L15)

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

### setRoleOwner()

> **setRoleOwner**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L16)

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

### setStaking()

> **setStaking**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L42)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### staking

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setSuperPaymaster()

> **setSuperPaymaster**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L41)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### paymaster

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### staking()

> **staking**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L48)

#### Returns

`Promise`\<`Address`\>

***

### SUPER\_PAYMASTER()

> **SUPER\_PAYMASTER**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:98](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L98)

#### Returns

`Promise`\<`Address`\>

***

### superPaymaster()

> **superPaymaster**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L47)

#### Returns

`Promise`\<`Address`\>

***

### transferOwnership()

> **transferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L52)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### newOwner

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### unRegisterRole()

> **unRegisterRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L13)

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

### updateOperatorBlacklist()

> **updateOperatorBlacklist**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L34)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### isBlacklisted

`boolean`

###### operator

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### userRoleCount()

> **userRoleCount**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L62)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### userRoles()

> **userRoles**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L61)

#### Parameters

##### args

###### index

`bigint`

###### user

`Address`

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### version()

> **version**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/registry.ts:103](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/registry.ts#L103)

#### Returns

`Promise`\<`string`\>
