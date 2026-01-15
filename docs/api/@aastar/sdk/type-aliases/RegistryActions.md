```ts
type RegistryActions = object;
```

Defined in: [packages/core/src/actions/registry.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L14)

## Properties

### registryAccountToUser()

```ts
registryAccountToUser: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/registry.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L89)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account`: `Address`; \} |
| `args.account` | `Address` |

#### Returns

`Promise`\<`Address`\>

***

### registryAddLevelThreshold()

```ts
registryAddLevelThreshold: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/registry.ts:87](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L87)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `threshold`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.threshold` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### registryAdminConfigureRole()

```ts
registryAdminConfigureRole: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/registry.ts:97](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L97)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `entryBurn`: `bigint`; `exitFeePercent`: `number`; `minExitFee`: `bigint`; `minStake`: `bigint`; `roleId`: [`Hex`](https://viem.sh/docs/); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.entryBurn` | `bigint` |
| `args.exitFeePercent` | `number` |
| `args.minExitFee` | `bigint` |
| `args.minStake` | `bigint` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### registryBatchUpdateGlobalReputation()

```ts
registryBatchUpdateGlobalReputation: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/registry.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L48)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `epoch`: `bigint`; `proof`: [`Hex`](https://viem.sh/docs/); `scores`: `bigint`[]; `users`: `Address`[]; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.epoch` | `bigint` |
| `args.proof` | [`Hex`](https://viem.sh/docs/) |
| `args.scores` | `bigint`[] |
| `args.users` | `Address`[] |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### registryBlsAggregator()

```ts
registryBlsAggregator: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/registry.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L62)

#### Returns

`Promise`\<`Address`\>

***

### registryBlsValidator()

```ts
registryBlsValidator: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/registry.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L61)

#### Returns

`Promise`\<`Address`\>

***

### registryCalculateExitFee()

```ts
registryCalculateExitFee: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/registry.ts:86](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L86)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `amount`: `bigint`; `roleId`: [`Hex`](https://viem.sh/docs/); \} |
| `args.amount` | `bigint` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<`bigint`\>

***

### registryCommunityByENS()

```ts
registryCommunityByENS: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/registry.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L27)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `ensName`: `string`; \} |
| `args.ensName` | `string` |

#### Returns

`Promise`\<`Address`\>

***

### registryCommunityByENSV3()

```ts
registryCommunityByENSV3: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/registry.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L29)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `ensName`: `string`; \} |
| `args.ensName` | `string` |

#### Returns

`Promise`\<`Address`\>

***

### registryCommunityByName()

```ts
registryCommunityByName: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/registry.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L26)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `name`: `string`; \} |
| `args.name` | `string` |

#### Returns

`Promise`\<`Address`\>

***

### registryCommunityByNameV3()

```ts
registryCommunityByNameV3: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/registry.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L28)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `name`: `string`; \} |
| `args.name` | `string` |

#### Returns

`Promise`\<`Address`\>

***

### registryConfigureRole()

```ts
registryConfigureRole: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/registry.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L16)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `config`: [`RoleConfig`](../interfaces/RoleConfig.md); `roleId`: [`Hex`](https://viem.sh/docs/); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.config` | [`RoleConfig`](../interfaces/RoleConfig.md) |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### registryCreateNewRole()

```ts
registryCreateNewRole: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/registry.ts:98](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L98)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `config`: [`RoleConfig`](../interfaces/RoleConfig.md); `roleId`: [`Hex`](https://viem.sh/docs/); `roleOwner`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.config` | [`RoleConfig`](../interfaces/RoleConfig.md) |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |
| `args.roleOwner` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### registryCreditTierConfig()

```ts
registryCreditTierConfig: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/registry.ts:94](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L94)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `level`: `bigint`; \} |
| `args.level` | `bigint` |

#### Returns

`Promise`\<`bigint`\>

***

### registryExecutedProposals()

```ts
registryExecutedProposals: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/registry.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L31)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `proposalId`: `bigint`; \} |
| `args.proposalId` | `bigint` |

#### Returns

`Promise`\<`boolean`\>

***

### registryExitRole()

```ts
registryExitRole: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/registry.ts:85](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L85)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `roleId`: [`Hex`](https://viem.sh/docs/); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### registryGetAccountCommunity()

```ts
registryGetAccountCommunity: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/registry.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L34)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account`: `Address`; \} |
| `args.account` | `Address` |

#### Returns

`Promise`\<`Address`\>

***

### registryGetCreditLimit()

```ts
registryGetCreditLimit: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/registry.ts:92](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L92)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### registryGetRoleConfig()

```ts
registryGetRoleConfig: (args) => Promise<any>;
```

Defined in: [packages/core/src/actions/registry.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L21)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/); \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<`any`\>

***

### registryGetRoleMemberCount()

```ts
registryGetRoleMemberCount: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/registry.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L75)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/); \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<`bigint`\>

***

### registryGetRoleMembers()

```ts
registryGetRoleMembers: (args) => Promise<Address[]>;
```

Defined in: [packages/core/src/actions/registry.ts:81](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L81)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/); \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<`Address`[]\>

***

### registryGetRoleUserCount()

```ts
registryGetRoleUserCount: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/registry.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L82)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/); \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<`bigint`\>

***

### registryGetUserRoles()

```ts
registryGetUserRoles: (args) => Promise<Hex[]>;
```

Defined in: [packages/core/src/actions/registry.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L83)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/)[]\>

***

### registryGlobalReputation()

```ts
registryGlobalReputation: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/registry.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L47)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### registryGTOKEN\_STAKING()

```ts
registryGTOKEN_STAKING: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/registry.ts:109](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L109)

#### Returns

`Promise`\<`Address`\>

***

### registryHasRole()

```ts
registryHasRole: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/registry.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L19)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/); `user`: `Address`; \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |
| `args.user` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### registryIsCommunityMember()

```ts
registryIsCommunityMember: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/registry.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L25)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; `user`: `Address`; \} |
| `args.community` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### registryIsOperatorBlacklisted()

```ts
registryIsOperatorBlacklisted: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/registry.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L52)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `operator`: `Address`; \} |
| `args.operator` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### registryIsReputationSource()

```ts
registryIsReputationSource: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/registry.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L36)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `source`: `Address`; \} |
| `args.source` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### registryLastReputationEpoch()

```ts
registryLastReputationEpoch: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/registry.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L35)

#### Returns

`Promise`\<`bigint`\>

***

### registryLevelThresholds()

```ts
registryLevelThresholds: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/registry.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L76)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `level`: `bigint`; \} |
| `args.level` | `bigint` |

#### Returns

`Promise`\<`bigint`\>

***

### registryMySBT()

```ts
registryMySBT: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/registry.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L63)

#### Returns

`Promise`\<`Address`\>

***

### registryMYSBT()

```ts
registryMYSBT: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/registry.ts:110](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L110)

#### Returns

`Promise`\<`Address`\>

***

### registryOwner()

```ts
registryOwner: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/registry.ts:70](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L70)

#### Returns

`Promise`\<`Address`\>

***

### registryProposedRoleNames()

```ts
registryProposedRoleNames: (args) => Promise<string>;
```

Defined in: [packages/core/src/actions/registry.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L30)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/); \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<`string`\>

***

### registryRegisterRole()

```ts
registryRegisterRole: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/registry.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L17)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `data`: [`Hex`](https://viem.sh/docs/); `roleId`: [`Hex`](https://viem.sh/docs/); `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.data` | [`Hex`](https://viem.sh/docs/) |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### registryRegisterRoleSelf()

```ts
registryRegisterRoleSelf: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/registry.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L18)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `data`: [`Hex`](https://viem.sh/docs/); `roleId`: [`Hex`](https://viem.sh/docs/); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.data` | [`Hex`](https://viem.sh/docs/) |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### registryRenounceOwnership()

```ts
registryRenounceOwnership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/registry.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L71)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### registryReputationSource()

```ts
registryReputationSource: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/registry.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L66)

#### Returns

`Promise`\<`Address`\>

***

### registryROLE\_ANODE()

```ts
registryROLE_ANODE: () => Promise<Hex>;
```

Defined in: [packages/core/src/actions/registry.ts:108](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L108)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/)\>

***

### registryROLE\_COMMUNITY()

```ts
registryROLE_COMMUNITY: () => Promise<Hex>;
```

Defined in: [packages/core/src/actions/registry.ts:102](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L102)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/)\>

***

### registryROLE\_DVT()

```ts
registryROLE_DVT: () => Promise<Hex>;
```

Defined in: [packages/core/src/actions/registry.ts:106](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L106)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/)\>

***

### registryROLE\_ENDUSER()

```ts
registryROLE_ENDUSER: () => Promise<Hex>;
```

Defined in: [packages/core/src/actions/registry.ts:103](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L103)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/)\>

***

### registryROLE\_KMS()

```ts
registryROLE_KMS: () => Promise<Hex>;
```

Defined in: [packages/core/src/actions/registry.ts:107](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L107)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/)\>

***

### registryROLE\_PAYMASTER\_AOA()

```ts
registryROLE_PAYMASTER_AOA: () => Promise<Hex>;
```

Defined in: [packages/core/src/actions/registry.ts:105](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L105)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/)\>

***

### registryROLE\_PAYMASTER\_SUPER()

```ts
registryROLE_PAYMASTER_SUPER: () => Promise<Hex>;
```

Defined in: [packages/core/src/actions/registry.ts:104](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L104)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/)\>

***

### registryRoleConfigs()

```ts
registryRoleConfigs: (args) => Promise<any>;
```

Defined in: [packages/core/src/actions/registry.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L74)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/); \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<`any`\>

***

### registryRoleCounts()

```ts
registryRoleCounts: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/registry.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L37)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/); \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<`bigint`\>

***

### registryRoleLockDurations()

```ts
registryRoleLockDurations: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/registry.ts:79](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L79)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/); \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<`bigint`\>

***

### registryRoleMemberIndex()

```ts
registryRoleMemberIndex: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/registry.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L39)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/); `user`: `Address`; \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### registryRoleMembers()

```ts
registryRoleMembers: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/registry.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L38)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `index`: `bigint`; `roleId`: [`Hex`](https://viem.sh/docs/); \} |
| `args.index` | `bigint` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<`Address`\>

***

### registryRoleMetadata()

```ts
registryRoleMetadata: (args) => Promise<Hex>;
```

Defined in: [packages/core/src/actions/registry.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L40)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/); `user?`: `Address`; \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |
| `args.user?` | `Address` |

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/)\>

***

### registryRoleOwners()

```ts
registryRoleOwners: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/registry.ts:80](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L80)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/); \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<`Address`\>

***

### registryRoleSBTTokenIds()

```ts
registryRoleSBTTokenIds: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/registry.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L42)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/); `user`: `Address`; \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### registryRoleStakes()

```ts
registryRoleStakes: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/registry.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L41)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/); `user`: `Address`; \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### registrySafeMintForRole()

```ts
registrySafeMintForRole: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/registry.ts:99](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L99)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `data`: [`Hex`](https://viem.sh/docs/); `roleId`: [`Hex`](https://viem.sh/docs/); `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.data` | [`Hex`](https://viem.sh/docs/) |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### registrySetBLSAggregator()

```ts
registrySetBLSAggregator: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/registry.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L56)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `aggregator`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.aggregator` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### registrySetBLSValidator()

```ts
registrySetBLSValidator: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/registry.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L55)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `validator`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.validator` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### registrySetCreditTier()

```ts
registrySetCreditTier: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/registry.ts:93](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L93)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `level`: `bigint`; `limit`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.level` | `bigint` |
| `args.limit` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### registrySetLevelThreshold()

```ts
registrySetLevelThreshold: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/registry.ts:88](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L88)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `index`: `bigint`; `threshold`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.index` | `bigint` |
| `args.threshold` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### registrySetMySBT()

```ts
registrySetMySBT: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/registry.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L57)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `sbt`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.sbt` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### registrySetReputationSource()

```ts
registrySetReputationSource: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/registry.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L60)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `source`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.source` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### registrySetRoleLockDuration()

```ts
registrySetRoleLockDuration: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/registry.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L22)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `duration`: `bigint`; `roleId`: [`Hex`](https://viem.sh/docs/); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.duration` | `bigint` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### registrySetRoleOwner()

```ts
registrySetRoleOwner: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/registry.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L23)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `newOwner`: `Address`; `roleId`: [`Hex`](https://viem.sh/docs/); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.newOwner` | `Address` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### registrySetStaking()

```ts
registrySetStaking: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/registry.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L59)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `staking`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.staking` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### registrySetSuperPaymaster()

```ts
registrySetSuperPaymaster: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/registry.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L58)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `paymaster`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.paymaster` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### registryStaking()

```ts
registryStaking: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/registry.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L65)

#### Returns

`Promise`\<`Address`\>

***

### registrySUPER\_PAYMASTER()

```ts
registrySUPER_PAYMASTER: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/registry.ts:111](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L111)

#### Returns

`Promise`\<`Address`\>

***

### registrySuperPaymaster()

```ts
registrySuperPaymaster: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/registry.ts:64](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L64)

#### Returns

`Promise`\<`Address`\>

***

### registryTransferOwnership()

```ts
registryTransferOwnership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/registry.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L69)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `newOwner`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.newOwner` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### registryUnRegisterRole()

```ts
registryUnRegisterRole: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/registry.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L20)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `roleId`: [`Hex`](https://viem.sh/docs/); `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### registryUpdateOperatorBlacklist()

```ts
registryUpdateOperatorBlacklist: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/registry.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L51)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `operator`: `Address`; `proof`: [`Hex`](https://viem.sh/docs/); `statuses`: `boolean`[]; `users`: `Address`[]; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.operator` | `Address` |
| `args.proof` | [`Hex`](https://viem.sh/docs/) |
| `args.statuses` | `boolean`[] |
| `args.users` | `Address`[] |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### registryUserRoleCount()

```ts
registryUserRoleCount: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/registry.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L44)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### registryUserRoles()

```ts
registryUserRoles: (args) => Promise<Hex>;
```

Defined in: [packages/core/src/actions/registry.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L43)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `index`: `bigint`; `user`: `Address`; \} |
| `args.index` | `bigint` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/)\>

***

### registryVersion()

```ts
registryVersion: () => Promise<string>;
```

Defined in: [packages/core/src/actions/registry.ts:114](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/registry.ts#L114)

#### Returns

`Promise`\<`string`\>
