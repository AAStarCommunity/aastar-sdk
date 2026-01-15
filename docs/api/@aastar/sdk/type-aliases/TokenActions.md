```ts
type TokenActions = object;
```

Defined in: [packages/core/src/actions/tokens.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L5)

## Properties

### tokenAddAutoApprovedSpender()

```ts
tokenAddAutoApprovedSpender: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/tokens.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L38)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `spender`: `Address`; `token`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.spender` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### tokenAllowance()

```ts
tokenAllowance: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/tokens.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L14)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `owner`: `Address`; `spender`: `Address`; `token`: `Address`; \} |
| `args.owner` | `Address` |
| `args.spender` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### tokenApprove()

```ts
tokenApprove: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/tokens.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L13)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; `spender`: `Address`; `token`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |
| `args.spender` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### tokenAutoApprovedSpenders()

```ts
tokenAutoApprovedSpenders: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/tokens.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L66)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `spender`: `Address`; `token`: `Address`; \} |
| `args.spender` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### tokenBalanceOf()

```ts
tokenBalanceOf: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/tokens.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L8)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account`: `Address`; `token`: `Address`; \} |
| `args.account` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### tokenBurn()

```ts
tokenBurn: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/tokens.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L18)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; `token`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### tokenBurnFrom()

```ts
tokenBurnFrom: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/tokens.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L19)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; `from`: `Address`; `token`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |
| `args.from` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### tokenBurnFromWithOpHash()

```ts
tokenBurnFromWithOpHash: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/tokens.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L67)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account`: `Address`; `amount`: `bigint`; `opHash`: `Hex`; `token`: `Address`; `userOpAccount?`: `Account` \| `Address`; \} |
| `args.account` | `Address` |
| `args.amount` | `bigint` |
| `args.opHash` | `Hex` |
| `args.token` | `Address` |
| `args.userOpAccount?` | `Account` \| `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### tokenCap()

```ts
tokenCap: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/tokens.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L9)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### tokenCommunityENS()

```ts
tokenCommunityENS: (args) => Promise<string>;
```

Defined in: [packages/core/src/actions/tokens.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L52)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`string`\>

***

### tokenCommunityName()

```ts
tokenCommunityName: (args) => Promise<string>;
```

Defined in: [packages/core/src/actions/tokens.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L51)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`string`\>

***

### tokenCommunityOwner()

```ts
tokenCommunityOwner: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/tokens.ts:68](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L68)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Address`\>

***

### tokenCumulativeSpent()

```ts
tokenCumulativeSpent: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/tokens.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L56)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; `user`: `Address`; \} |
| `args.token` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### tokenDebts()

```ts
tokenDebts: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/tokens.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L57)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; `user`: `Address`; \} |
| `args.token` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### tokenDecimals()

```ts
tokenDecimals: (args) => Promise<number>;
```

Defined in: [packages/core/src/actions/tokens.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L24)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`number`\>

***

### tokenDEFAULT\_SPENDING\_LIMIT\_APNTS()

```ts
tokenDEFAULT_SPENDING_LIMIT_APNTS: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/tokens.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L74)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### tokenDefaultSpendingLimitXPNTs()

```ts
tokenDefaultSpendingLimitXPNTs: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/tokens.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L55)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### tokenDOMAIN\_SEPARATOR()

```ts
tokenDOMAIN_SEPARATOR: (args) => Promise<Hex>;
```

Defined in: [packages/core/src/actions/tokens.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L61)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Hex`\>

***

### tokenEip712Domain()

```ts
tokenEip712Domain: (args) => Promise<any>;
```

Defined in: [packages/core/src/actions/tokens.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L69)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`any`\>

***

### tokenExchangeRate()

```ts
tokenExchangeRate: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/tokens.ts:53](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L53)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### tokenFACTORY()

```ts
tokenFACTORY: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/tokens.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L44)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Address`\>

***

### tokenGetDebt()

```ts
tokenGetDebt: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/tokens.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L33)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; `user`: `Address`; \} |
| `args.token` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### tokenGetDefaultSpendingLimitXPNTs()

```ts
tokenGetDefaultSpendingLimitXPNTs: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/tokens.ts:70](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L70)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### tokenGetMetadata()

```ts
tokenGetMetadata: (args) => Promise<string>;
```

Defined in: [packages/core/src/actions/tokens.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L71)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`string`\>

***

### tokenIsAutoApprovedSpender()

```ts
tokenIsAutoApprovedSpender: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/tokens.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L40)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `spender`: `Address`; `token`: `Address`; \} |
| `args.spender` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### tokenMint()

```ts
tokenMint: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/tokens.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L17)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; `to`: `Address`; `token`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |
| `args.to` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### tokenName()

```ts
tokenName: (args) => Promise<string>;
```

Defined in: [packages/core/src/actions/tokens.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L22)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`string`\>

***

### tokenNeedsApproval()

```ts
tokenNeedsApproval: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/tokens.ts:72](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L72)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `amount`: `bigint`; `owner`: `Address`; `spender`: `Address`; `token`: `Address`; \} |
| `args.amount` | `bigint` |
| `args.owner` | `Address` |
| `args.spender` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### tokenNonces()

```ts
tokenNonces: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/tokens.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L62)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `owner`: `Address`; `token`: `Address`; \} |
| `args.owner` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### tokenOwner()

```ts
tokenOwner: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/tokens.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L27)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Address`\>

***

### tokenPermit()

```ts
tokenPermit: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/tokens.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L63)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `deadline`: `bigint`; `owner`: `Address`; `r`: `Hex`; `s`: `Hex`; `spender`: `Address`; `token`: `Address`; `v`: `number`; `value`: `bigint`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.deadline` | `bigint` |
| `args.owner` | `Address` |
| `args.r` | `Hex` |
| `args.s` | `Hex` |
| `args.spender` | `Address` |
| `args.token` | `Address` |
| `args.v` | `number` |
| `args.value` | `bigint` |

#### Returns

`Promise`\<`Hash`\>

***

### tokenRecordDebt()

```ts
tokenRecordDebt: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/tokens.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L73)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; `token`: `Address`; `user`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |
| `args.token` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### tokenRemainingMintableSupply()

```ts
tokenRemainingMintableSupply: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/tokens.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L10)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### tokenRemoveAutoApprovedSpender()

```ts
tokenRemoveAutoApprovedSpender: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/tokens.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L39)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `spender`: `Address`; `token`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.spender` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### tokenRenounceOwnership()

```ts
tokenRenounceOwnership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/tokens.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L29)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `token`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### tokenRepayDebt()

```ts
tokenRepayDebt: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/tokens.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L34)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; `token`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### tokenSetPaymasterLimit()

```ts
tokenSetPaymasterLimit: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/tokens.ts:77](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L77)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `limit`: `bigint`; `token`: `Address`; `user`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.limit` | `bigint` |
| `args.token` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### tokenSetSuperPaymasterAddress()

```ts
tokenSetSuperPaymasterAddress: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/tokens.ts:78](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L78)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `superPaymaster`: `Address`; `token`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.superPaymaster` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### tokenSpendingLimits()

```ts
tokenSpendingLimits: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/tokens.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L54)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; `user`: `Address`; \} |
| `args.token` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### tokenSUPERPAYMASTER\_ADDRESS()

```ts
tokenSUPERPAYMASTER_ADDRESS: (args) => Promise<Address>;
```

Defined in: [packages/core/src/actions/tokens.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L43)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Address`\>

***

### tokenSymbol()

```ts
tokenSymbol: (args) => Promise<string>;
```

Defined in: [packages/core/src/actions/tokens.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L23)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`string`\>

***

### tokenTotalSupply()

```ts
tokenTotalSupply: (args) => Promise<bigint>;
```

Defined in: [packages/core/src/actions/tokens.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L7)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### tokenTransfer()

```ts
tokenTransfer: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/tokens.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L11)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; `to`: `Address`; `token`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |
| `args.to` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### tokenTransferAndCall()

```ts
tokenTransferAndCall: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/tokens.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L35)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; `data?`: `Hex`; `to`: `Address`; `token`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |
| `args.data?` | `Hex` |
| `args.to` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### tokenTransferCommunityOwnership()

```ts
tokenTransferCommunityOwnership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/tokens.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L48)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `newOwner`: `Address`; `token`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.newOwner` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### tokenTransferFrom()

```ts
tokenTransferFrom: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/tokens.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L12)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `amount`: `bigint`; `from`: `Address`; `to`: `Address`; `token`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.amount` | `bigint` |
| `args.from` | `Address` |
| `args.to` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### tokenTransferOwnership()

```ts
tokenTransferOwnership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/tokens.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L47)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `newOwner`: `Address`; `token`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.newOwner` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### tokenTransferTokenOwnership()

```ts
tokenTransferTokenOwnership: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/tokens.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L28)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `newOwner`: `Address`; `token`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.newOwner` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### tokenUpdateExchangeRate()

```ts
tokenUpdateExchangeRate: (args) => Promise<Hash>;
```

Defined in: [packages/core/src/actions/tokens.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L32)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: `Account` \| `Address`; `newRate`: `bigint`; `token`: `Address`; \} |
| `args.account?` | `Account` \| `Address` |
| `args.newRate` | `bigint` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Hash`\>

***

### tokenUsedOpHashes()

```ts
tokenUsedOpHashes: (args) => Promise<boolean>;
```

Defined in: [packages/core/src/actions/tokens.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L58)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `hash`: `Hex`; `token`: `Address`; \} |
| `args.hash` | `Hex` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### tokenVersion()

```ts
tokenVersion: (args) => Promise<string>;
```

Defined in: [packages/core/src/actions/tokens.ts:79](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/actions/tokens.ts#L79)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`string`\>
