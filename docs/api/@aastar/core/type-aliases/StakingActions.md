> **StakingActions** = `object`

Defined in: [packages/core/src/actions/staking.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L6)

## Properties

### authorizedSlashers()

> **authorizedSlashers**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/staking.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L59)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `slasher`: `Address`; \} |
| `args.slasher` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### availableBalance()

> **availableBalance**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/staking.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L35)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### getLockedStake()

> **getLockedStake**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/staking.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L26)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/index.html); `user`: `Address`; \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### getStakeInfo()

> **getStakeInfo**: (`args`) => `Promise`\<\{ `amount`: `bigint`; `slashedAmount`: `bigint`; `stakedAt`: `bigint`; `unstakeRequestedAt`: `bigint`; \}\>

Defined in: [packages/core/src/actions/staking.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L19)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `operator`: `Address`; `roleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.operator` | `Address` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<\{ `amount`: `bigint`; `slashedAmount`: `bigint`; `stakedAt`: `bigint`; `unstakeRequestedAt`: `bigint`; \}\>

***

### getStakingBalance()

> **getStakingBalance**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/staking.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L25)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### getTotalStaked()

> **getTotalStaked**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/staking.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L61)

#### Returns

`Promise`\<`bigint`\>

***

### getUserRoleLocks()

> **getUserRoleLocks**: (`args`) => `Promise`\<`object`[]\>

Defined in: [packages/core/src/actions/staking.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L27)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`object`[]\>

***

### GTOKEN()

> **GTOKEN**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/staking.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L74)

#### Returns

`Promise`\<`Address`\>

***

### hasRoleLock()

> **hasRoleLock**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/staking.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L34)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/index.html); `user`: `Address`; \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.user` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### lockStake()

> **lockStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L8)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `entryBurn`: `bigint`; `payer`: `Address`; `roleId`: [`Hex`](https://viem.sh/docs/index.html); `stakeAmount`: `bigint`; `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.entryBurn` | `bigint` |
| `args.payer` | `Address` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.stakeAmount` | `bigint` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### owner()

> **owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/staking.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L63)

#### Returns

`Promise`\<`Address`\>

***

### previewExitFee()

> **previewExitFee**: (`args`) => `Promise`\<\{ `fee`: `bigint`; `netAmount`: `bigint`; \}\>

Defined in: [packages/core/src/actions/staking.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L36)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/index.html); `user`: `Address`; \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.user` | `Address` |

#### Returns

`Promise`\<\{ `fee`: `bigint`; `netAmount`: `bigint`; \}\>

***

### REGISTRY()

> **REGISTRY**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/staking.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L73)

#### Returns

`Promise`\<`Address`\>

***

### renounceOwnership()

> **renounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L67)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### roleExitConfigs()

> **roleExitConfigs**: (`args`) => `Promise`\<\{ `feePercent`: `bigint`; `minFee`: `bigint`; \}\>

Defined in: [packages/core/src/actions/staking.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L57)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<\{ `feePercent`: `bigint`; `minFee`: `bigint`; \}\>

***

### roleLocks()

> **roleLocks**: (`args`) => `Promise`\<\{ `amount`: `bigint`; `entryBurn`: `bigint`; `lockedAt`: `number`; `metadata`: [`Hex`](https://viem.sh/docs/index.html); `roleId`: [`Hex`](https://viem.sh/docs/index.html); \}\>

Defined in: [packages/core/src/actions/staking.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L50)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/index.html); `user`: `Address`; \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.user` | `Address` |

#### Returns

`Promise`\<\{ `amount`: `bigint`; `entryBurn`: `bigint`; `lockedAt`: `number`; `metadata`: [`Hex`](https://viem.sh/docs/index.html); `roleId`: [`Hex`](https://viem.sh/docs/index.html); \}\>

***

### setAuthorizedSlasher()

> **setAuthorizedSlasher**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L16)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `authorized`: `boolean`; `slasher`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.authorized` | `boolean` |
| `args.slasher` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setRegistry()

> **setRegistry**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L39)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `registry`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.registry` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setRoleExitFee()

> **setRoleExitFee**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L40)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `feePercent`: `bigint`; `minFee`: `bigint`; `roleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.feePercent` | `bigint` |
| `args.minFee` | `bigint` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setTreasury()

> **setTreasury**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L41)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `treasury`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.treasury` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### slash()

> **slash**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L14)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amount`: `bigint`; `reason`: `string`; `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amount` | `bigint` |
| `args.reason` | `string` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### slashByDVT()

> **slashByDVT**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L15)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `operator`: `Address`; `penaltyAmount`: `bigint`; `reason`: `string`; `roleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.operator` | `Address` |
| `args.penaltyAmount` | `bigint` |
| `args.reason` | `string` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### stakes()

> **stakes**: (`args`) => `Promise`\<\{ `amount`: `bigint`; `slashedAmount`: `bigint`; `stakedAt`: `bigint`; `unstakeRequestedAt`: `bigint`; \}\>

Defined in: [packages/core/src/actions/staking.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L44)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<\{ `amount`: `bigint`; `slashedAmount`: `bigint`; `stakedAt`: `bigint`; `unstakeRequestedAt`: `bigint`; \}\>

***

### topUpStake()

> **topUpStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L9)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `payer`: `Address`; `roleId`: [`Hex`](https://viem.sh/docs/index.html); `stakeAmount`: `bigint`; `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.payer` | `Address` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.stakeAmount` | `bigint` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### totalStaked()

> **totalStaked**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/staking.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L60)

#### Returns

`Promise`\<`bigint`\>

***

### transferOwnership()

> **transferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L66)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newOwner`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newOwner` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### treasury()

> **treasury**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/staking.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L62)

#### Returns

`Promise`\<`Address`\>

***

### unlockAndTransfer()

> **unlockAndTransfer**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L11)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `roleId`: [`Hex`](https://viem.sh/docs/index.html); `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### unlockStake()

> **unlockStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L10)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `roleId`: [`Hex`](https://viem.sh/docs/index.html); `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### userActiveRoles()

> **userActiveRoles**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L58)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `index`: `bigint`; `user`: `Address`; \} |
| `args.index` | `bigint` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### version()

> **version**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/staking.ts:70](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/staking.ts#L70)

#### Returns

`Promise`\<`string`\>
