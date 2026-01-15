```ts
type SBTActions = object;
```

Defined in: [packages/core/src/actions/sbt.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L5)

## Properties

### sbtAirdropMint()

```ts
sbtAirdropMint: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/sbt.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L8)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `roleId`: [`Hex`](https://viem.sh/docs/); `to`: `Address`; `tokenURI`: `string`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |
| `args.to` | `Address` |
| `args.tokenURI` | `string` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### sbtApprove()

```ts
sbtApprove: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/sbt.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L25)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `to`: `Address`; `tokenId`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.to` | `Address` |
| `args.tokenId` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### sbtBalanceOf()

```ts
sbtBalanceOf: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/sbt.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L21)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `owner`: `Address`; \} |
| `args.owner` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### sbtBurn()

```ts
sbtBurn: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/sbt.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L44)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `tokenId`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.tokenId` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### sbtBurnSBT()

```ts
sbtBurnSBT: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/sbt.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L45)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `tokenId`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.tokenId` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### sbtDaoMultisig()

```ts
sbtDaoMultisig: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/sbt.ts:72](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L72)

#### Returns

`Promise`\<`Address`\>

***

### sbtDeactivateAllMemberships()

```ts
sbtDeactivateAllMemberships: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/sbt.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L46)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### sbtDeactivateMembership()

```ts
sbtDeactivateMembership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/sbt.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L51)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `tokenId`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.tokenId` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### sbtGetActiveMemberships()

```ts
sbtGetActiveMemberships: (args) => Promise<any[]>;
```

Defined in: [packages/core/src/actions/sbt.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L14)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`any`[]\>

***

### sbtGetApproved()

```ts
sbtGetApproved: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/sbt.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L27)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `tokenId`: `bigint`; \} |
| `args.tokenId` | `bigint` |

#### Returns

`Promise`\<`Address`\>

***

### sbtGetCommunityMembership()

```ts
sbtGetCommunityMembership: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/sbt.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L12)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; `user`: `Address`; \} |
| `args.community` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### sbtGetMemberships()

```ts
sbtGetMemberships: (args) => Promise<any[]>;
```

Defined in: [packages/core/src/actions/sbt.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L13)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`any`[]\>

***

### sbtGetSBTData()

```ts
sbtGetSBTData: (args) => Promise<any>;
```

Defined in: [packages/core/src/actions/sbt.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L11)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `tokenId`: `bigint`; \} |
| `args.tokenId` | `bigint` |

#### Returns

`Promise`\<`any`\>

***

### sbtGetUserSBT()

```ts
sbtGetUserSBT: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/sbt.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L10)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `roleId`: [`Hex`](https://viem.sh/docs/); `user`: `Address`; \} |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### sbtGTOKEN()

```ts
sbtGTOKEN: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/sbt.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L83)

#### Returns

`Promise`\<`Address`\>

***

### sbtGTOKEN\_STAKING()

```ts
sbtGTOKEN_STAKING: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/sbt.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L82)

#### Returns

`Promise`\<`Address`\>

***

### sbtIsApprovedForAll()

```ts
sbtIsApprovedForAll: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/sbt.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L28)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `operator`: `Address`; `owner`: `Address`; \} |
| `args.operator` | `Address` |
| `args.owner` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### sbtLastActivityTime()

```ts
sbtLastActivityTime: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/sbt.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L55)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### sbtLeaveCommunity()

```ts
sbtLeaveCommunity: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/sbt.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L50)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `community`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.community` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### sbtMembershipIndex()

```ts
sbtMembershipIndex: (args) => Promise<any>;
```

Defined in: [packages/core/src/actions/sbt.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L18)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `index`: `bigint`; `user`: `Address`; \} |
| `args.index` | `bigint` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`any`\>

***

### sbtMinLockAmount()

```ts
sbtMinLockAmount: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/sbt.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L63)

#### Returns

`Promise`\<`bigint`\>

***

### sbtMint()

```ts
sbtMint: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/sbt.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L43)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `to`: `Address`; `tokenURI`: `string`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.to` | `Address` |
| `args.tokenURI` | `string` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### sbtMintFee()

```ts
sbtMintFee: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/sbt.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L61)

#### Returns

`Promise`\<`bigint`\>

***

### sbtMintForRole()

```ts
sbtMintForRole: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/sbt.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L9)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `roleId`: [`Hex`](https://viem.sh/docs/); `to`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |
| `args.to` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### sbtName()

```ts
sbtName: () => Promise<string>;
```

Defined in: [packages/core/src/actions/sbt.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L31)

#### Returns

`Promise`\<`string`\>

***

### sbtNextTokenId()

```ts
sbtNextTokenId: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/sbt.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L40)

#### Returns

`Promise`\<`bigint`\>

***

### sbtOwner()

```ts
sbtOwner: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/sbt.ts:87](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L87)

#### Returns

`Promise`\<`Address`\>

***

### sbtOwnerOf()

```ts
sbtOwnerOf: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/sbt.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L22)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `tokenId`: `bigint`; \} |
| `args.tokenId` | `bigint` |

#### Returns

`Promise`\<`Address`\>

***

### sbtPause()

```ts
sbtPause: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/sbt.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L67)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### sbtPaused()

```ts
sbtPaused: () => Promise<boolean>;
```

Defined in: [packages/core/src/actions/sbt.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L69)

#### Returns

`Promise`\<`boolean`\>

***

### sbtRecordActivity()

```ts
sbtRecordActivity: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/sbt.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L54)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### sbtREGISTRY()

```ts
sbtREGISTRY: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/sbt.ts:81](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L81)

#### Returns

`Promise`\<`Address`\>

***

### sbtRenounceOwnership()

```ts
sbtRenounceOwnership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/sbt.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L89)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### sbtReputationCalculator()

```ts
sbtReputationCalculator: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/sbt.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L57)

#### Returns

`Promise`\<`Address`\>

***

### sbtSafeMintForRole()

```ts
sbtSafeMintForRole: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/sbt.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L7)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `roleId`: [`Hex`](https://viem.sh/docs/); `to`: `Address`; `tokenURI`: `string`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/) |
| `args.to` | `Address` |
| `args.tokenURI` | `string` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### sbtSafeTransferFrom()

```ts
sbtSafeTransferFrom: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/sbt.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L23)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `from`: `Address`; `to`: `Address`; `tokenId`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.from` | `Address` |
| `args.to` | `Address` |
| `args.tokenId` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### sbtSbtData()

```ts
sbtSbtData: (args) => Promise<any>;
```

Defined in: [packages/core/src/actions/sbt.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L17)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `tokenId`: `bigint`; \} |
| `args.tokenId` | `bigint` |

#### Returns

`Promise`\<`any`\>

***

### sbtSetApprovalForAll()

```ts
sbtSetApprovalForAll: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/sbt.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L26)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `approved`: `boolean`; `operator`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.approved` | `boolean` |
| `args.operator` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### sbtSetBaseURI()

```ts
sbtSetBaseURI: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/sbt.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L47)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `baseURI`: `string`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.baseURI` | `string` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### sbtSetDAOMultisig()

```ts
sbtSetDAOMultisig: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/sbt.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L73)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `multisig`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.multisig` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### sbtSetMinLockAmount()

```ts
sbtSetMinLockAmount: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/sbt.ts:64](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L64)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `amount`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.amount` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### sbtSetMintFee()

```ts
sbtSetMintFee: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/sbt.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L62)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `fee`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.fee` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### sbtSetRegistry()

```ts
sbtSetRegistry: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/sbt.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L74)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `registry`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.registry` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### sbtSetReputationCalculator()

```ts
sbtSetReputationCalculator: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/sbt.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L58)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `calculator`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.calculator` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### sbtSetSuperPaymaster()

```ts
sbtSetSuperPaymaster: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/sbt.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L75)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `paymaster`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.paymaster` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### sbtSUPER\_PAYMASTER()

```ts
sbtSUPER_PAYMASTER: () => Promise<Address>;
```

Defined in: [packages/core/src/actions/sbt.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L84)

#### Returns

`Promise`\<`Address`\>

***

### sbtSupportsInterface()

```ts
sbtSupportsInterface: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/sbt.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L39)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `interfaceId`: [`Hex`](https://viem.sh/docs/); \} |
| `args.interfaceId` | [`Hex`](https://viem.sh/docs/) |

#### Returns

`Promise`\<`boolean`\>

***

### sbtSymbol()

```ts
sbtSymbol: () => Promise<string>;
```

Defined in: [packages/core/src/actions/sbt.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L32)

#### Returns

`Promise`\<`string`\>

***

### sbtTokenByIndex()

```ts
sbtTokenByIndex: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/sbt.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L37)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `index`: `bigint`; \} |
| `args.index` | `bigint` |

#### Returns

`Promise`\<`bigint`\>

***

### sbtTokenOfOwnerByIndex()

```ts
sbtTokenOfOwnerByIndex: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/sbt.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L38)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `index`: `bigint`; `owner`: `Address`; \} |
| `args.index` | `bigint` |
| `args.owner` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### sbtTokenURI()

```ts
sbtTokenURI: (args) => Promise<string>;
```

Defined in: [packages/core/src/actions/sbt.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L33)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `tokenId`: `bigint`; \} |
| `args.tokenId` | `bigint` |

#### Returns

`Promise`\<`string`\>

***

### sbtTotalSupply()

```ts
sbtTotalSupply: () => Promise<bigint>;
```

Defined in: [packages/core/src/actions/sbt.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L36)

#### Returns

`Promise`\<`bigint`\>

***

### sbtTransferFrom()

```ts
sbtTransferFrom: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/sbt.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L24)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `from`: `Address`; `to`: `Address`; `tokenId`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.from` | `Address` |
| `args.to` | `Address` |
| `args.tokenId` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### sbtTransferSBTOwnership()

```ts
sbtTransferSBTOwnership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/sbt.ts:88](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L88)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; `newOwner`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |
| `args.newOwner` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### sbtUnpause()

```ts
sbtUnpause: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/sbt.ts:68](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L68)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/)\>

***

### sbtUserToSBT()

```ts
sbtUserToSBT: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/sbt.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L16)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### sbtVerifyCommunityMembership()

```ts
sbtVerifyCommunityMembership: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/sbt.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L15)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; `user`: `Address`; \} |
| `args.community` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### sbtVersion()

```ts
sbtVersion: () => Promise<string>;
```

Defined in: [packages/core/src/actions/sbt.ts:78](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L78)

#### Returns

`Promise`\<`string`\>

***

### sbtWeeklyActivity()

```ts
sbtWeeklyActivity: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/sbt.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/actions/sbt.ts#L56)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>
