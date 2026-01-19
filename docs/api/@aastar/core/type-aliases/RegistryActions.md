> **RegistryActions** = `object`

Defined in: [packages/core/src/actions/registry.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L21)

## Properties

### accountToUser()

> **accountToUser**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L73)

#### Parameters

##### args

###### account

`Address`

#### Returns

`Promise`\<`Address`\>

***

### addLevelThreshold()

> **addLevelThreshold**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L42)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### threshold

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### adminConfigureRole()

> **adminConfigureRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L24)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### entryBurn

`bigint`

###### exitFeePercent

`bigint`

###### minExitFee

`bigint`

###### minStake

`bigint`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### batchUpdateGlobalReputation()

> **batchUpdateGlobalReputation**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L43)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### epoch

`bigint`

###### newScores

`bigint`[]

###### proof

[`Hex`](https://viem.sh/docs/index.html)

###### proposalId

`bigint`

###### users

`Address`[]

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### blsAggregator()

> **blsAggregator**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L54)

#### Returns

`Promise`\<`Address`\>

***

### blsValidator()

> **blsValidator**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:53](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L53)

#### Returns

`Promise`\<`Address`\>

***

### calculateExitFee()

> **calculateExitFee**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:72](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L72)

#### Parameters

##### args

###### amount

`bigint`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`bigint`\>

***

### communityByENS()

> **communityByENS**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L37)

#### Parameters

##### args

###### ensName

`string`

#### Returns

`Promise`\<`Address`\>

***

### communityByName()

> **communityByName**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L36)

#### Parameters

##### args

###### name

`string`

#### Returns

`Promise`\<`Address`\>

***

### configureRole()

> **configureRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L23)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### config

[`RoleConfigDetailed`](RoleConfigDetailed.md)

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### createNewRole()

> **createNewRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L25)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### config

[`RoleConfigDetailed`](RoleConfigDetailed.md)

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### roleOwner

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### creditTierConfig()

> **creditTierConfig**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:70](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L70)

#### Parameters

##### args

###### tierIndex

`bigint`

#### Returns

`Promise`\<`bigint`\>

***

### exitRole()

> **exitRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L33)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### getCreditLimit()

> **getCreditLimit**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L40)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### getRoleConfig()

> **getRoleConfig**: (`args`) => `Promise`\<[`RoleConfigDetailed`](RoleConfigDetailed.md)\>

Defined in: [packages/core/src/actions/registry.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L30)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`RoleConfigDetailed`](RoleConfigDetailed.md)\>

***

### getRoleMembers()

> **getRoleMembers**: (`args`) => `Promise`\<`Address`[]\>

Defined in: [packages/core/src/actions/registry.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L65)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`Address`[]\>

***

### getRoleUserCount()

> **getRoleUserCount**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:64](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L64)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`bigint`\>

***

### getUserRoles()

> **getUserRoles**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)[]\>

Defined in: [packages/core/src/actions/registry.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L66)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)[]\>

***

### globalReputation()

> **globalReputation**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L41)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### GTOKEN\_STAKING()

> **GTOKEN\_STAKING**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L57)

#### Returns

`Promise`\<`Address`\>

***

### hasRole()

> **hasRole**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/registry.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L29)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### isReputationSource()

> **isReputationSource**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/registry.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L59)

#### Parameters

##### args

###### source

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### lastReputationEpoch()

> **lastReputationEpoch**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L60)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### levelThresholds()

> **levelThresholds**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L71)

#### Parameters

##### args

###### levelIndex

`bigint`

#### Returns

`Promise`\<`bigint`\>

***

### MYSBT()

> **MYSBT**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L55)

#### Returns

`Promise`\<`Address`\>

***

### owner()

> **owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:88](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L88)

#### Returns

`Promise`\<`Address`\>

***

### registerRole()

> **registerRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L26)

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

Defined in: [packages/core/src/actions/registry.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L27)

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

Defined in: [packages/core/src/actions/registry.ts:90](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L90)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### reputationSource()

> **reputationSource**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L58)

#### Returns

`Promise`\<`Address`\>

***

### ROLE\_ANODE()

> **ROLE\_ANODE**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:85](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L85)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### ROLE\_COMMUNITY()

> **ROLE\_COMMUNITY**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:79](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L79)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### ROLE\_DVT()

> **ROLE\_DVT**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L83)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### ROLE\_ENDUSER()

> **ROLE\_ENDUSER**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:80](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L80)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### ROLE\_KMS()

> **ROLE\_KMS**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L84)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### ROLE\_PAYMASTER\_AOA()

> **ROLE\_PAYMASTER\_AOA**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L82)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### ROLE\_PAYMASTER\_SUPER()

> **ROLE\_PAYMASTER\_SUPER**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:81](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L81)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### roleConfigs()

> **roleConfigs**: (`args`) => `Promise`\<[`RoleConfigDetailed`](RoleConfigDetailed.md)\>

Defined in: [packages/core/src/actions/registry.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L63)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`RoleConfigDetailed`](RoleConfigDetailed.md)\>

***

### roleLockDurations()

> **roleLockDurations**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L76)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`bigint`\>

***

### roleMembers()

> **roleMembers**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L67)

#### Parameters

##### args

###### index

`bigint`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`Address`\>

***

### roleOwners()

> **roleOwners**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L74)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`Address`\>

***

### roleStakes()

> **roleStakes**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L75)

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

Defined in: [packages/core/src/actions/registry.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L28)

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

### setBLSAggregator()

> **setBLSAggregator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L47)

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

Defined in: [packages/core/src/actions/registry.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L46)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### validator

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setMySBT()

> **setMySBT**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L48)

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

Defined in: [packages/core/src/actions/registry.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L51)

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

Defined in: [packages/core/src/actions/registry.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L31)

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

Defined in: [packages/core/src/actions/registry.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L32)

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

Defined in: [packages/core/src/actions/registry.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L50)

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

Defined in: [packages/core/src/actions/registry.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L49)

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

Defined in: [packages/core/src/actions/registry.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L56)

#### Returns

`Promise`\<`Address`\>

***

### transferOwnership()

> **transferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L89)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### newOwner

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### userRoleCount()

> **userRoleCount**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L69)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### userRoles()

> **userRoles**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:68](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L68)

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

Defined in: [packages/core/src/actions/registry.ts:93](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/registry.ts#L93)

#### Returns

`Promise`\<`string`\>
