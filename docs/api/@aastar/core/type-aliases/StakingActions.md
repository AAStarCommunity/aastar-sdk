```ts
type StakingActions = object;
```

Defined in: [packages/core/src/actions/staking.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L4)

## Properties

### authorizedSlashers()

```ts
authorizedSlashers: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/staking.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L38)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `slasher`: `Address`; \} |
| `args.slasher` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### availableBalance()

```ts
availableBalance: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/staking.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L24)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### balanceOf()

```ts
balanceOf: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/staking.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L40)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account`: `Address`; \} |
| `args.account` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### getLockedStake()

```ts
getLockedStake: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/staking.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L21)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/); `user`: `Address`; \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### getStake()

```ts
getStake: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/staking.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L39)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account`: `Address`; \} |
| `args.account` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### getStakeInfo()

```ts
getStakeInfo: (args) => Promise<any>;
```

Defined in: [packages/core/src/actions/staking.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L19)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `operator`: `Address`; `roleId`: [`Hex`](https://viem.sh/docs/); \} |
| `args.operator` | `Address` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<`any`\>

***

### getStakingBalance()

```ts
getStakingBalance: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/staking.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L20)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### getTotalStaked()

```ts
getTotalStaked: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/staking.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L42)

#### Returns

`Promise`\<`bigint`\>

***

### getUserRoleLocks()

```ts
getUserRoleLocks: (args) => Promise<any[]>;
```

Defined in: [packages/core/src/actions/staking.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L22)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`any`[]\>

***

### GTOKEN()

```ts
GTOKEN: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/staking.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L55)

#### Returns

`Promise`\<`Address`\>

***

### hasRoleLock()

```ts
hasRoleLock: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/staking.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L23)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/); `user`: `Address`; \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |
| `args.user` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### lockStake()

```ts
lockStake: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/staking.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L6)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `entryBurn`: `bigint`; `payer`: `Address`; `roleId`: [`Hex`](https://viem.sh/docs/); `stakeAmount`: `bigint`; `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.entryBurn` | `bigint` |
| `args.payer` | `Address` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |
| `args.stakeAmount` | `bigint` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### owner()

```ts
owner: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/staking.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L44)

#### Returns

`Promise`\<`Address`\>

***

### previewExitFee()

```ts
previewExitFee: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/staking.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L25)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/); `user`: `Address`; \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### REGISTRY()

```ts
REGISTRY: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/staking.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L54)

#### Returns

`Promise`\<`Address`\>

***

### renounceOwnership()

```ts
renounceOwnership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/staking.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L48)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### roleExitConfigs()

```ts
roleExitConfigs: (args) => Promise<any>;
```

Defined in: [packages/core/src/actions/staking.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L36)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/); \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<`any`\>

***

### roleLocks()

```ts
roleLocks: (args) => Promise<any>;
```

Defined in: [packages/core/src/actions/staking.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L35)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/); `user`: `Address`; \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |
| `args.user` | `Address` |

#### Returns

`Promise`\<`any`\>

***

### setAuthorizedSlasher()

```ts
setAuthorizedSlasher: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/staking.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L16)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `authorized`: `boolean`; `slasher`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.authorized` | `boolean` |
| `args.slasher` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### setRegistry()

```ts
setRegistry: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/staking.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L28)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `registry`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.registry` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### setRoleExitFee()

```ts
setRoleExitFee: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/staking.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L30)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `feePercent`: `bigint`; `roleId`: [`Hex`](https://viem.sh/docs/); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.feePercent` | `bigint` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### setTreasury()

```ts
setTreasury: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/staking.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L31)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `treasury`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.treasury` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### slash()

```ts
slash: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/staking.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L14)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `amount`: `bigint`; `reason`: `string`; `roleId`: [`Hex`](https://viem.sh/docs/); `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.amount` | `bigint` |
| `args.reason` | `string` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### slashByDVT()

```ts
slashByDVT: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/staking.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L15)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `amount`: `bigint`; `reason`: `string`; `roleId`: [`Hex`](https://viem.sh/docs/); `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.amount` | `bigint` |
| `args.reason` | `string` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### stake()

```ts
stake: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/staking.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L9)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `amount`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.amount` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### stakes()

```ts
stakes: (args) => Promise<any>;
```

Defined in: [packages/core/src/actions/staking.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L34)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`any`\>

***

### topUpStake()

```ts
topUpStake: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/staking.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L10)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `amount`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.amount` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### totalStaked()

```ts
totalStaked: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/staking.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L41)

#### Returns

`Promise`\<`bigint`\>

***

### transferOwnership()

```ts
transferOwnership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/staking.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L29)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `newOwner`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.newOwner` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### transferStakingOwnership()

```ts
transferStakingOwnership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/staking.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L47)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `newOwner`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.newOwner` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### treasury()

```ts
treasury: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/staking.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L43)

#### Returns

`Promise`\<`Address`\>

***

### unlockAndTransfer()

```ts
unlockAndTransfer: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/staking.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L8)

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

### unlockStake()

```ts
unlockStake: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/staking.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L7)

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

### unstake()

```ts
unstake: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/staking.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L11)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `amount`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.amount` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### userActiveRoles()

```ts
userActiveRoles: (args) => Promise<Hex>;
```

Defined in: [packages/core/src/actions/staking.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L37)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `index`: `bigint`; `user`: `Address`; \} |
| `args.index` | `bigint` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/)\>

***

### version()

```ts
version: () => Promise<string>;
```

Defined in: [packages/core/src/actions/staking.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/staking.ts#L51)

#### Returns

`Promise`\<`string`\>
