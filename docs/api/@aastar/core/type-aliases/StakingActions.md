> **StakingActions** = `object`

Defined in: [packages/core/src/actions/staking.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L6)

## Properties

### authorizedSlashers()

> **authorizedSlashers**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/staking.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L59)

#### Parameters

##### args

###### slasher

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### availableBalance()

> **availableBalance**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/staking.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L35)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### getLockedStake()

> **getLockedStake**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/staking.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L26)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### getStakeInfo()

> **getStakeInfo**: (`args`) => `Promise`\<\{ `amount`: `bigint`; `slashedAmount`: `bigint`; `stakedAt`: `bigint`; `unstakeRequestedAt`: `bigint`; \}\>

Defined in: [packages/core/src/actions/staking.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L19)

#### Parameters

##### args

###### operator

`Address`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<\{ `amount`: `bigint`; `slashedAmount`: `bigint`; `stakedAt`: `bigint`; `unstakeRequestedAt`: `bigint`; \}\>

***

### getStakingBalance()

> **getStakingBalance**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/staking.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L25)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### getTotalStaked()

> **getTotalStaked**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/staking.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L61)

#### Returns

`Promise`\<`bigint`\>

***

### getUserRoleLocks()

> **getUserRoleLocks**: (`args`) => `Promise`\<`object`[]\>

Defined in: [packages/core/src/actions/staking.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L27)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`object`[]\>

***

### GTOKEN()

> **GTOKEN**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/staking.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L74)

#### Returns

`Promise`\<`Address`\>

***

### hasRoleLock()

> **hasRoleLock**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/staking.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L34)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### lockStake()

> **lockStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L8)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### entryBurn

`bigint`

###### payer

`Address`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### stakeAmount

`bigint`

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### owner()

> **owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/staking.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L63)

#### Returns

`Promise`\<`Address`\>

***

### previewExitFee()

> **previewExitFee**: (`args`) => `Promise`\<\{ `fee`: `bigint`; `netAmount`: `bigint`; \}\>

Defined in: [packages/core/src/actions/staking.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L36)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<\{ `fee`: `bigint`; `netAmount`: `bigint`; \}\>

***

### REGISTRY()

> **REGISTRY**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/staking.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L73)

#### Returns

`Promise`\<`Address`\>

***

### renounceOwnership()

> **renounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L67)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### roleExitConfigs()

> **roleExitConfigs**: (`args`) => `Promise`\<\{ `feePercent`: `bigint`; `minFee`: `bigint`; \}\>

Defined in: [packages/core/src/actions/staking.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L57)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<\{ `feePercent`: `bigint`; `minFee`: `bigint`; \}\>

***

### roleLocks()

> **roleLocks**: (`args`) => `Promise`\<\{ `amount`: `bigint`; `entryBurn`: `bigint`; `lockedAt`: `number`; `metadata`: [`Hex`](https://viem.sh/docs/index.html); `roleId`: [`Hex`](https://viem.sh/docs/index.html); \}\>

Defined in: [packages/core/src/actions/staking.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L50)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<\{ `amount`: `bigint`; `entryBurn`: `bigint`; `lockedAt`: `number`; `metadata`: [`Hex`](https://viem.sh/docs/index.html); `roleId`: [`Hex`](https://viem.sh/docs/index.html); \}\>

***

### setAuthorizedSlasher()

> **setAuthorizedSlasher**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L16)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### authorized

`boolean`

###### slasher

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setRegistry()

> **setRegistry**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L39)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### registry

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setRoleExitFee()

> **setRoleExitFee**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L40)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### feePercent

`bigint`

###### minFee

`bigint`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setTreasury()

> **setTreasury**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L41)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### treasury

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### slash()

> **slash**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L14)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

###### reason

`string`

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### slashByDVT()

> **slashByDVT**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L15)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### operator

`Address`

###### penaltyAmount

`bigint`

###### reason

`string`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### stakes()

> **stakes**: (`args`) => `Promise`\<\{ `amount`: `bigint`; `slashedAmount`: `bigint`; `stakedAt`: `bigint`; `unstakeRequestedAt`: `bigint`; \}\>

Defined in: [packages/core/src/actions/staking.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L44)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<\{ `amount`: `bigint`; `slashedAmount`: `bigint`; `stakedAt`: `bigint`; `unstakeRequestedAt`: `bigint`; \}\>

***

### topUpStake()

> **topUpStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L9)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### payer

`Address`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### stakeAmount

`bigint`

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### totalStaked()

> **totalStaked**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/staking.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L60)

#### Returns

`Promise`\<`bigint`\>

***

### transferOwnership()

> **transferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L66)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### newOwner

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### treasury()

> **treasury**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/staking.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L62)

#### Returns

`Promise`\<`Address`\>

***

### unlockAndTransfer()

> **unlockAndTransfer**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L11)

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

### unlockStake()

> **unlockStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L10)

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

### userActiveRoles()

> **userActiveRoles**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L58)

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

Defined in: [packages/core/src/actions/staking.ts:70](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/actions/staking.ts#L70)

#### Returns

`Promise`\<`string`\>
