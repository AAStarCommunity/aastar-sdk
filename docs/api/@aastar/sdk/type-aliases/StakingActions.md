> **StakingActions** = `object`

Defined in: [packages/core/src/actions/staking.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L6)

## Properties

### authorizedSlashers()

> **authorizedSlashers**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/staking.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L69)

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

Defined in: [packages/core/src/actions/staking.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L44)

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

Defined in: [packages/core/src/actions/staking.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L35)

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

Defined in: [packages/core/src/actions/staking.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L28)

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

Defined in: [packages/core/src/actions/staking.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L34)

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

Defined in: [packages/core/src/actions/staking.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L71)

#### Returns

`Promise`\<`bigint`\>

***

### getUserRoleLocks()

> **getUserRoleLocks**: (`args`) => `Promise`\<`object`[]\>

Defined in: [packages/core/src/actions/staking.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L36)

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

Defined in: [packages/core/src/actions/staking.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L84)

#### Returns

`Promise`\<`Address`\>

***

### hasRoleLock()

> **hasRoleLock**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/staking.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L43)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/index.html); `user`: `Address`; \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.user` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### ~~lockStake()~~

> **lockStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L9)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `payer`: `Address`; `roleId`: [`Hex`](https://viem.sh/docs/index.html); `stakeAmount`: `bigint`; `ticketPrice`: `bigint`; `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.payer` | `Address` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.stakeAmount` | `bigint` |
| `args.ticketPrice` | `bigint` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

`lockStake` is absent from the deployed ABI (reverts on-chain); use [lockStakeWithTicket](#lockstakewithticket).

***

### lockStakeWithTicket()

> **lockStakeWithTicket**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L17)

Lock stake for a role and consume a ticket in one call. ABI:
lockStakeWithTicket(address user, bytes32 roleId, uint256 stakeAmount, uint256 ticketPrice, address payer) -> uint256 lockId.
NOTE: the deployed GTokenStaking ABI exposes ONLY this function; the bare `lockStake` getter no longer exists on-chain.
This is a state-changing tx, so it resolves to the transaction `Hash` — the on-chain
`uint256 lockId` return is NOT recoverable from a write; `simulateContract` the same call if you need it.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `payer`: `Address`; `roleId`: [`Hex`](https://viem.sh/docs/index.html); `stakeAmount`: `bigint`; `ticketPrice`: `bigint`; `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.payer` | `Address` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.stakeAmount` | `bigint` |
| `args.ticketPrice` | `bigint` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### MAX\_TOTAL\_STAKE()

> **MAX\_TOTAL\_STAKE**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/staking.ts:86](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L86)

Protocol-wide cap on total locked stake (view). ABI: MAX_TOTAL_STAKE() -> uint256.

#### Returns

`Promise`\<`bigint`\>

***

### owner()

> **owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/staking.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L73)

#### Returns

`Promise`\<`Address`\>

***

### previewExitFee()

> **previewExitFee**: (`args`) => `Promise`\<\{ `fee`: `bigint`; `netAmount`: `bigint`; \}\>

Defined in: [packages/core/src/actions/staking.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L45)

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

Defined in: [packages/core/src/actions/staking.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L83)

#### Returns

`Promise`\<`Address`\>

***

### renounceOwnership()

> **renounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:77](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L77)

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

Defined in: [packages/core/src/actions/staking.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L67)

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

Defined in: [packages/core/src/actions/staking.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L60)

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

Defined in: [packages/core/src/actions/staking.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L25)

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

### ~~setRegistry()~~

> **setRegistry**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L49)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `registry`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.registry` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

Removed in the v5.x contract refactor — `setRegistry` is absent from the deployed GTokenStaking ABI (REGISTRY is immutable, set at construction). Throws ErrorCode.NOT\_IMPLEMENTED.

***

### setRoleExitFee()

> **setRoleExitFee**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L50)

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

Defined in: [packages/core/src/actions/staking.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L51)

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

Defined in: [packages/core/src/actions/staking.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L23)

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

Defined in: [packages/core/src/actions/staking.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L24)

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

Defined in: [packages/core/src/actions/staking.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L54)

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

Defined in: [packages/core/src/actions/staking.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L18)

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

Defined in: [packages/core/src/actions/staking.ts:70](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L70)

#### Returns

`Promise`\<`bigint`\>

***

### transferOwnership()

> **transferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L76)

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

Defined in: [packages/core/src/actions/staking.ts:72](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L72)

#### Returns

`Promise`\<`Address`\>

***

### unlockAndTransfer()

> **unlockAndTransfer**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L20)

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

Defined in: [packages/core/src/actions/staking.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L19)

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

Defined in: [packages/core/src/actions/staking.ts:68](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L68)

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

Defined in: [packages/core/src/actions/staking.ts:80](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/staking.ts#L80)

#### Returns

`Promise`\<`string`\>
