> **RegistryActions** = `object`

Defined in: [packages/core/src/actions/registry.ts:140](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L140)

## Properties

### ~~addLevelThreshold()~~

> **addLevelThreshold**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:178](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L178)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `threshold`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.threshold` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

Removed in the v5.x contract refactor — there is no append-one `addLevelThreshold` (only the replace-all [setLevelThresholds](#setlevelthresholds)). Throws ErrorCode.NOT\_IMPLEMENTED; read [levelThresholds](#levelthresholds), append, and call [setLevelThresholds](#setlevelthresholds).

***

### batchUpdateGlobalReputation()

> **batchUpdateGlobalReputation**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:179](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L179)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `epoch`: `bigint`; `newScores`: `bigint`[]; `proof`: [`Hex`](https://viem.sh/docs/index.html); `proposalId`: `bigint`; `users`: `Address`[]; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.epoch` | `bigint` |
| `args.newScores` | `bigint`[] |
| `args.proof` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.proposalId` | `bigint` |
| `args.users` | `Address`[] |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### blacklistNonce()

> **blacklistNonce**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:192](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L192)

Monotonic nonce bumped on each operator-blacklist update (view). ABI: blacklistNonce() -> uint256.

#### Returns

`Promise`\<`bigint`\>

***

### blsAggregator()

> **blsAggregator**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:201](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L201)

#### Returns

`Promise`\<`Address`\>

***

### ~~calculateExitFee()~~

> **calculateExitFee**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:254](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L254)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `amount`: `bigint`; `roleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.amount` | `bigint` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`bigint`\>

#### Deprecated

Removed in the v5.x contract refactor — Registry has no exit-fee calculator. Throws ErrorCode.NOT\_IMPLEMENTED; use the GTokenStaking `previewExitFee({ user, roleId })` action instead.

***

### ~~communityByENS()~~

> **communityByENS**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:164](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L164)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `ensName`: `string`; \} |
| `args.ensName` | `string` |

#### Returns

`Promise`\<`Address`\>

#### Deprecated

The deployed v5 Registry ABI has no `communityByENS` function — use [getCommunityByENS](#getcommunitybyens). This wrapper now delegates to `getCommunityByENS` so it no longer reverts on-chain.

***

### ~~communityByName()~~

> **communityByName**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:162](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L162)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `name`: `string`; \} |
| `args.name` | `string` |

#### Returns

`Promise`\<`Address`\>

#### Deprecated

The deployed v5 Registry ABI has no `communityByName` function — use [getCommunityByName](#getcommunitybyname). This wrapper now delegates to `getCommunityByName` so it no longer reverts on-chain.

***

### configureRole()

> **configureRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:142](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L142)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `config`: [`RoleConfigDetailed`](RoleConfigDetailed.md); `roleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.config` | [`RoleConfigDetailed`](RoleConfigDetailed.md) |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### ~~createNewRole()~~

> **createNewRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:145](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L145)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `config`: [`RoleConfigDetailed`](RoleConfigDetailed.md); `roleId`: [`Hex`](https://viem.sh/docs/index.html); `roleOwner`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.config` | [`RoleConfigDetailed`](RoleConfigDetailed.md) |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.roleOwner` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

The deployed Registry ABI has no `createNewRole` — this wrapper now calls `configureRole(roleId, config)` with `roleOwner` merged into `config.owner`. Prefer [configureRole](#configurerole).

***

### creditTierConfig()

> **creditTierConfig**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:251](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L251)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `tierIndex`: `bigint`; \} |
| `args.tierIndex` | `bigint` |

#### Returns

`Promise`\<`bigint`\>

***

### exitRole()

> **exitRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:156](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L156)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `roleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### getCommunityByENS()

> **getCommunityByENS**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:167](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L167)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `ensName`: `string`; \} |
| `args.ensName` | `string` |

#### Returns

`Promise`\<`Address`\>

***

### getCommunityByName()

> **getCommunityByName**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:166](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L166)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `name`: `string`; \} |
| `args.name` | `string` |

#### Returns

`Promise`\<`Address`\>

***

### getCommunityProfile()

> **getCommunityProfile**: (`args`) => `Promise`\<[`CommunityProfile`](CommunityProfile.md) \| `null`\>

Defined in: [packages/core/src/actions/registry.ts:172](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L172)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; `fromBlock?`: [`BlockNumber`](https://viem.sh/docs/index.html) \| [`BlockTag`](https://viem.sh/docs/index.html); `toBlock?`: [`BlockNumber`](https://viem.sh/docs/index.html) \| [`BlockTag`](https://viem.sh/docs/index.html); \} |
| `args.community` | `Address` |
| `args.fromBlock?` | [`BlockNumber`](https://viem.sh/docs/index.html) \| [`BlockTag`](https://viem.sh/docs/index.html) |
| `args.toBlock?` | [`BlockNumber`](https://viem.sh/docs/index.html) \| [`BlockTag`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`CommunityProfile`](CommunityProfile.md) \| `null`\>

***

### getCreditLimit()

> **getCreditLimit**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:175](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L175)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### getEffectiveStake()

> **getEffectiveStake**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:170](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L170)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/index.html); `user`: `Address`; \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### getRoleConfig()

> **getRoleConfig**: (`args`) => `Promise`\<[`RoleConfigDetailed`](RoleConfigDetailed.md)\>

Defined in: [packages/core/src/actions/registry.ts:151](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L151)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`RoleConfigDetailed`](RoleConfigDetailed.md)\>

***

### getRoleMemberCount()

> **getRoleMemberCount**: (`args`) => `Promise`\<`number`\>

Defined in: [packages/core/src/actions/registry.ts:243](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L243)

Count of active members for a role, derived from the same event indexing as
[getRoleMembers](#getrolemembers) (i.e. `getRoleMembers(...).length`).

NOTE: this differs from [getRoleUserCount](#getroleusercount), which reads the on-chain
`roleMembers[roleId].length` counter directly. Prefer `getRoleUserCount` when you
only need a count and an authoritative on-chain value is acceptable; use this when
you also need the member addresses or want a count consistent with `getRoleMembers`
over a specific block range. Subject to the same `getLogs` truncation caveat as
[getRoleMembers](#getrolemembers) — prefer `getRoleUserCount` for an authoritative count.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `fromBlock?`: [`BlockNumber`](https://viem.sh/docs/index.html) \| [`BlockTag`](https://viem.sh/docs/index.html); `roleId`: [`Hex`](https://viem.sh/docs/index.html); `toBlock?`: [`BlockNumber`](https://viem.sh/docs/index.html) \| [`BlockTag`](https://viem.sh/docs/index.html); \} |
| `args.fromBlock?` | [`BlockNumber`](https://viem.sh/docs/index.html) \| [`BlockTag`](https://viem.sh/docs/index.html) |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.toBlock?` | [`BlockNumber`](https://viem.sh/docs/index.html) \| [`BlockTag`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`number`\>

***

### getRoleMembers()

> **getRoleMembers**: (`args`) => `Promise`\<`Address`[]\>

Defined in: [packages/core/src/actions/registry.ts:231](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L231)

Active members of a role, derived by event indexing.

The deployed v5 Registry slimmed its storage: there is NO `getRoleMembers`
getter in the ABI (members are not enumerable on-chain), so this is reconstructed
from the membership-lifecycle events — `RoleRegistered` (join, emitted by both
`registerRole` and `safeMintForRole`) minus `RoleExited` (exit). For each user we
keep their LATEST lifecycle event (by block number, then log index) so a user who
exited and later re-registered is correctly counted as active.

⚠️ The result is only as complete as the underlying `getLogs` response. Many RPC
providers cap the block range or the number of logs returned and may SILENTLY
truncate — in which case the member list will be incomplete with no error. This
helper does NOT paginate. For large histories, pass a bounded `fromBlock`/`toBlock`
window (and page yourself), or use an indexed data source (subgraph/indexer).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `fromBlock?`: [`BlockNumber`](https://viem.sh/docs/index.html) \| [`BlockTag`](https://viem.sh/docs/index.html); `roleId`: [`Hex`](https://viem.sh/docs/index.html); `toBlock?`: [`BlockNumber`](https://viem.sh/docs/index.html) \| [`BlockTag`](https://viem.sh/docs/index.html); \} |
| `args.fromBlock?` | [`BlockNumber`](https://viem.sh/docs/index.html) \| [`BlockTag`](https://viem.sh/docs/index.html) |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.toBlock?` | [`BlockNumber`](https://viem.sh/docs/index.html) \| [`BlockTag`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`Address`[]\>

***

### getRoleStake()

> **getRoleStake**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:169](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L169)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/index.html); `user`: `Address`; \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### getRoleUserCount()

> **getRoleUserCount**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:214](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L214)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`bigint`\>

***

### getUserRoles()

> **getUserRoles**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)[]\>

Defined in: [packages/core/src/actions/registry.ts:244](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L244)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)[]\>

***

### globalReputation()

> **globalReputation**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:176](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L176)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### ~~grantRole()~~

> **grantRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:274](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L274)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `roleId`: [`Hex`](https://viem.sh/docs/index.html); `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

Removed in the v5.x contract refactor — the Registry dropped the OZ AccessControl surface (no `grantRole`). Throws ErrorCode.NOT\_IMPLEMENTED; use [registerRole](#registerrole) to add a user to a role.

***

### GTOKEN\_STAKING()

> **GTOKEN\_STAKING**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:204](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L204)

#### Returns

`Promise`\<`Address`\>

***

### hasRole()

> **hasRole**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/registry.ts:150](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L150)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/index.html); `user`: `Address`; \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.user` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### isReputationSource()

> **isReputationSource**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/registry.ts:207](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L207)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `source`: `Address`; \} |
| `args.source` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### ~~lastReputationEpoch()~~

> **lastReputationEpoch**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:209](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L209)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

#### Deprecated

Removed in the v5.x contract refactor — not in the deployed Registry ABI. Throws ErrorCode.NOT\_IMPLEMENTED.

***

### levelThresholds()

> **levelThresholds**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:252](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L252)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `levelIndex`: `bigint`; \} |
| `args.levelIndex` | `bigint` |

#### Returns

`Promise`\<`bigint`\>

***

### MYSBT()

> **MYSBT**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:202](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L202)

#### Returns

`Promise`\<`Address`\>

***

### owner()

> **owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:268](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L268)

#### Returns

`Promise`\<`Address`\>

***

### registerRole()

> **registerRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:146](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L146)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `data`: [`Hex`](https://viem.sh/docs/index.html); `roleId`: [`Hex`](https://viem.sh/docs/index.html); `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.data` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### ~~registerRoleSelf()~~

> **registerRoleSelf**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:148](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L148)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `data`: [`Hex`](https://viem.sh/docs/index.html); `roleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.data` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

The deployed Registry ABI has no `registerRoleSelf` — this wrapper now calls `registerRole(roleId, <caller>, data)` deriving the caller from `account`. Prefer [registerRole](#registerrole).

***

### renounceOwnership()

> **renounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:270](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L270)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### ~~reputationSource()~~

> **reputationSource**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:206](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L206)

#### Returns

`Promise`\<`Address`\>

#### Deprecated

Removed in the v5.x contract refactor — there is no single-address `reputationSource` getter (sources are now a set). Throws ErrorCode.NOT\_IMPLEMENTED; use [isReputationSource](#isreputationsource)({ source }) to test membership.

***

### ~~revokeRole()~~

> **revokeRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:276](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L276)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `roleId`: [`Hex`](https://viem.sh/docs/index.html); `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

Removed in the v5.x contract refactor — the Registry has no admin `revokeRole` (only the caller can self-exit). Throws ErrorCode.NOT\_IMPLEMENTED; a user removes their own role via [exitRole](#exitrole).

***

### ROLE\_ANODE()

> **ROLE\_ANODE**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:265](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L265)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### ROLE\_COMMUNITY()

> **ROLE\_COMMUNITY**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:259](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L259)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### ROLE\_DVT()

> **ROLE\_DVT**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:263](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L263)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### ROLE\_ENDUSER()

> **ROLE\_ENDUSER**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:260](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L260)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### ROLE\_KMS()

> **ROLE\_KMS**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:264](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L264)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### ROLE\_PAYMASTER\_AOA()

> **ROLE\_PAYMASTER\_AOA**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:262](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L262)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### ROLE\_PAYMASTER\_SUPER()

> **ROLE\_PAYMASTER\_SUPER**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:261](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L261)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### ~~roleConfigs()~~

> **roleConfigs**: (`args`) => `Promise`\<[`RoleConfigDetailed`](RoleConfigDetailed.md)\>

Defined in: [packages/core/src/actions/registry.ts:213](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L213)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`RoleConfigDetailed`](RoleConfigDetailed.md)\>

#### Deprecated

The deployed Registry ABI has no `roleConfigs` mapping getter — this wrapper now reads the ABI-confirmed `getRoleConfig(roleId)`. Prefer [getRoleConfig](#getroleconfig).

***

### ~~roleMembers()~~

> **roleMembers**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:246](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L246)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `index`: `bigint`; `roleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.index` | `bigint` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`Address`\>

#### Deprecated

Removed in the v5.x contract refactor — Registry storage was slimmed and members are not enumerable by index (no `roleMembers(roleId,index)` getter). Throws ErrorCode.NOT\_IMPLEMENTED; use [getRoleMembers](#getrolemembers) (event-derived) instead.

***

### ~~roleMetadata()~~

> **roleMetadata**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:158](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L158)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/index.html); `user`: `Address`; \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

#### Deprecated

Removed in the v5.x contract refactor — there is no per-user role-metadata getter. Throws ErrorCode.NOT\_IMPLEMENTED; use [getCommunityProfile](#getcommunityprofile) (event back-trace) for a community's roleData or [getRoleConfig](#getroleconfig) for role config.

***

### ~~roleStakes()~~

> **roleStakes**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:256](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L256)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/index.html); `user`: `Address`; \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

#### Deprecated

The deployed Registry ABI has no `roleStakes` mapping getter — this wrapper now reads the ABI-confirmed `getRoleStake(roleId, user)`. Prefer [getRoleStake](#getrolestake).

***

### safeMintForRole()

> **safeMintForRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:149](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L149)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `data`: [`Hex`](https://viem.sh/docs/index.html); `roleId`: [`Hex`](https://viem.sh/docs/index.html); `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.data` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setBLSAggregator()

> **setBLSAggregator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:195](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L195)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `aggregator`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.aggregator` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setCreditTier()

> **setCreditTier**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:181](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L181)

Set the credit limit for a reputation level/tier (owner-gated). ABI: setCreditTier(uint256 level, uint256 limit).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `level`: `bigint`; `limit`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.level` | `bigint` |
| `args.limit` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setLevelThresholds()

> **setLevelThresholds**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:183](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L183)

Replace the full reputation level-threshold array (owner-gated). ABI: setLevelThresholds(uint256[] thresholds).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `thresholds`: `bigint`[]; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.thresholds` | `bigint`[] |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setMySBT()

> **setMySBT**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:196](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L196)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `sbt`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.sbt` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setReputationSource()

> **setReputationSource**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:199](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L199)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `source`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.source` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### ~~setRoleLockDuration()~~

> **setRoleLockDuration**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:153](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L153)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `duration`: `bigint`; `roleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.duration` | `bigint` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

Removed in the v5.x contract refactor — `roleLockDuration` is now a field of the role config. Throws ErrorCode.NOT\_IMPLEMENTED; set it via [configureRole](#configurerole) (config.roleLockDuration).

***

### ~~setRoleOwner()~~

> **setRoleOwner**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:155](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L155)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newOwner`: `Address`; `roleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newOwner` | `Address` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

Removed in the v5.x contract refactor — the role owner is now a field of the role config. Throws ErrorCode.NOT\_IMPLEMENTED; set it via [configureRole](#configurerole) (config.owner).

***

### setStaking()

> **setStaking**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:198](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L198)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `staking`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.staking` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setSuperPaymaster()

> **setSuperPaymaster**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:197](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L197)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `paymaster`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.paymaster` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### SUPER\_PAYMASTER()

> **SUPER\_PAYMASTER**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/registry.ts:203](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L203)

#### Returns

`Promise`\<`Address`\>

***

### syncExitFees()

> **syncExitFees**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:143](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L143)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `roles`: [`Hex`](https://viem.sh/docs/index.html)[]; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.roles` | [`Hex`](https://viem.sh/docs/index.html)[] |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### syncStakeFromStaking()

> **syncStakeFromStaking**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:190](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L190)

Sync a user's role stake from the GTokenStaking contract (staking-gated). ABI: syncStakeFromStaking(address user, bytes32 roleId, uint256 newAmount).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newAmount`: `bigint`; `roleId`: [`Hex`](https://viem.sh/docs/index.html); `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newAmount` | `bigint` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### transferOwnership()

> **transferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:269](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L269)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newOwner`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newOwner` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### updateOperatorBlacklist()

> **updateOperatorBlacklist**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:188](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L188)

Update an operator's per-user blacklist in batch with a proof.
ABI: updateOperatorBlacklist(address operator, address[] users, bool[] statuses, bytes proof).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `operator`: `Address`; `proof`: [`Hex`](https://viem.sh/docs/index.html); `statuses`: `boolean`[]; `users`: `Address`[]; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.operator` | `Address` |
| `args.proof` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.statuses` | `boolean`[] |
| `args.users` | `Address`[] |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### ~~userRoleCount()~~

> **userRoleCount**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:250](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L250)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

#### Deprecated

The deployed Registry ABI has no `userRoleCount` — this wrapper now returns `getUserRoles(user).length`. Prefer [getUserRoles](#getuserroles). (NOTE: distinct from [getRoleUserCount](#getroleusercount), which counts users of a role.)

***

### ~~userRoles()~~

> **userRoles**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:248](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L248)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `index`: `bigint`; `user`: `Address`; \} |
| `args.index` | `bigint` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

#### Deprecated

The deployed Registry ABI has no `userRoles(user,index)` indexed getter — this wrapper now reads `getUserRoles(user)` and returns the entry at `index`. Prefer [getUserRoles](#getuserroles).

***

### version()

> **version**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/registry.ts:279](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/registry.ts#L279)

#### Returns

`Promise`\<`string`\>
