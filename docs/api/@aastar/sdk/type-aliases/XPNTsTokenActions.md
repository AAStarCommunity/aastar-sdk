> **XPNTsTokenActions** = [`ERC20Actions`](ERC20Actions.md) & `object`

Defined in: [packages/core/src/actions/tokens.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/tokens.ts#L33)

## Type Declaration

### addApprovedFacilitator()

> **addApprovedFacilitator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Add an approved facilitator. State-changing tx → resolves to a tx `Hash`.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `facilitator`: `Address`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.facilitator` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### addAutoApprovedSpender()

> **addAutoApprovedSpender**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `spender`: `Address`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.spender` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### approvedFacilitators()

> **approvedFacilitators**: (`args`) => `Promise`\<`boolean`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `facilitator`: `Address`; `token`: `Address`; \} |
| `args.facilitator` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`boolean`\>

### autoApprovedSpenders()

> **autoApprovedSpenders**: (`args`) => `Promise`\<`boolean`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `spender`: `Address`; `token`: `Address`; \} |
| `args.spender` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`boolean`\>

### burn()

> **burn**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amount`: `bigint`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amount` | `bigint` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### burnFrom()

> **burnFrom**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amount`: `bigint`; `from`: `Address`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amount` | `bigint` |
| `args.from` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### burnFromWithOpHash()

> **burnFromWithOpHash**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amount`: `bigint`; `from`: `Address`; `token`: `Address`; `userOpHash`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amount` | `bigint` |
| `args.from` | `Address` |
| `args.token` | `Address` |
| `args.userOpHash` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### communityENS()

> **communityENS**: (`args`) => `Promise`\<`string`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`string`\>

### communityName()

> **communityName**: (`args`) => `Promise`\<`string`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`string`\>

### communityOwner()

> **communityOwner**: (`args`) => `Promise`\<`Address`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Address`\>

### debts()

> **debts**: (`args`) => `Promise`\<`bigint`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; `user`: `Address`; \} |
| `args.token` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

### DOMAIN\_SEPARATOR()

> **DOMAIN\_SEPARATOR**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

### eip712Domain()

> **eip712Domain**: (`args`) => `Promise`\<`any`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`any`\>

### emergencyDisabled()

> **emergencyDisabled**: (`args`) => `Promise`\<`boolean`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`boolean`\>

### emergencyRevokedAddress()

> **emergencyRevokedAddress**: (`args`) => `Promise`\<`Address`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Address`\>

### emergencyRevokePaymaster()

> **emergencyRevokePaymaster**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### EXCHANGE\_RATE\_COOLDOWN()

> **EXCHANGE\_RATE\_COOLDOWN**: (`args`) => `Promise`\<`bigint`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

### EXCHANGE\_RATE\_DELTA\_BPS()

> **EXCHANGE\_RATE\_DELTA\_BPS**: (`args`) => `Promise`\<`bigint`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

### EXCHANGE\_RATE\_MAX()

> **EXCHANGE\_RATE\_MAX**: (`args`) => `Promise`\<`bigint`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

### EXCHANGE\_RATE\_MIN()

> **EXCHANGE\_RATE\_MIN**: (`args`) => `Promise`\<`bigint`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

### exchangeRate()

> **exchangeRate**: (`args`) => `Promise`\<`bigint`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

### exchangeRateUpdatedAt()

> **exchangeRateUpdatedAt**: (`args`) => `Promise`\<`bigint`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

### FACTORY()

> **FACTORY**: (`args`) => `Promise`\<`Address`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Address`\>

### getDebt()

> **getDebt**: (`args`) => `Promise`\<`bigint`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; `user`: `Address`; \} |
| `args.token` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

### getMetadata()

> **getMetadata**: (`args`) => `Promise`\<\{ `communityENS`: `string`; `communityName`: `string`; `communityOwner`: `Address`; `name`: `string`; `symbol`: `string`; \}\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<\{ `communityENS`: `string`; `communityName`: `string`; `communityOwner`: `Address`; `name`: `string`; `symbol`: `string`; \}\>

### ~~MAX\_SINGLE\_TX\_LIMIT()~~

> **MAX\_SINGLE\_TX\_LIMIT**: (`args`) => `Promise`\<`bigint`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

#### Deprecated

The deployed xPNTsToken ABI renamed this constant to `MAX_SINGLE_TX_LIMIT_CAP`; this wrapper now reads that. Prefer MAX\_SINGLE\_TX\_LIMIT\_CAP.

### MAX\_SINGLE\_TX\_LIMIT\_CAP()

> **MAX\_SINGLE\_TX\_LIMIT\_CAP**: (`args`) => `Promise`\<`bigint`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

### maxSingleTxLimit()

> **maxSingleTxLimit**: (`args`) => `Promise`\<`bigint`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

### mint()

> **mint**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amount`: `bigint`; `to`: `Address`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amount` | `bigint` |
| `args.to` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### needsApproval()

> **needsApproval**: (`args`) => `Promise`\<`boolean`\>

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

### nonces()

> **nonces**: (`args`) => `Promise`\<`bigint`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `owner`: `Address`; `token`: `Address`; \} |
| `args.owner` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

### permit()

> **permit**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `deadline`: `bigint`; `owner`: `Address`; `r`: [`Hex`](https://viem.sh/docs/index.html); `s`: [`Hex`](https://viem.sh/docs/index.html); `spender`: `Address`; `token`: `Address`; `v`: `number`; `value`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.deadline` | `bigint` |
| `args.owner` | `Address` |
| `args.r` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.s` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.spender` | `Address` |
| `args.token` | `Address` |
| `args.v` | `number` |
| `args.value` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### recordDebt()

> **recordDebt**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amountXPNTs`: `bigint`; `token`: `Address`; `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amountXPNTs` | `bigint` |
| `args.token` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### recordDebtWithOpHash()

> **recordDebtWithOpHash**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Record APNTs-denominated debt for a user, guarded by a unique `opHash` to prevent replay.
ABI: recordDebtWithOpHash(address user, uint256 amountAPNTs, bytes32 opHash). This is a
state-changing tx, so it resolves to the transaction `Hash`; the function has no return value.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amountAPNTs`: `bigint`; `opHash`: [`Hex`](https://viem.sh/docs/index.html); `token`: `Address`; `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amountAPNTs` | `bigint` |
| `args.opHash` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.token` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### removeApprovedFacilitator()

> **removeApprovedFacilitator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Remove an approved facilitator. State-changing tx → resolves to a tx `Hash`.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `facilitator`: `Address`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.facilitator` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### removeAutoApprovedSpender()

> **removeAutoApprovedSpender**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `spender`: `Address`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.spender` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### renounceFactory()

> **renounceFactory**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Permanently renounce the factory link. State-changing tx → resolves to a tx `Hash`.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### repayDebt()

> **repayDebt**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amount`: `bigint`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amount` | `bigint` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### setMaxSingleTxLimit()

> **setMaxSingleTxLimit**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Set the per-tx burn ceiling. State-changing tx → resolves to a tx `Hash`.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newLimit`: `bigint`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newLimit` | `bigint` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### setSpenderDailyCap()

> **setSpenderDailyCap**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Set the per-spender daily burn cap (in whole tokens). State-changing tx → resolves to a tx `Hash`.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newCap`: `bigint`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newCap` | `bigint` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### setSpenderDailyCapFor()

> **setSpenderDailyCapFor**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Set a per-spender daily burn-cap OVERRIDE for a specific spender (admin). State-changing tx → resolves to a tx `Hash`.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newCap`: `bigint`; `spender`: `Address`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newCap` | `bigint` |
| `args.spender` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### setSuperPaymasterAddress()

> **setSuperPaymasterAddress**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `spAddress`: `Address`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.spAddress` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### spenderDailyCapOverride()

> **spenderDailyCapOverride**: (`args`) => `Promise`\<`bigint`\>

Read a spender's daily-cap override (0 = no override; the global `spenderDailyCapTokens` applies).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `spender`: `Address`; `token`: `Address`; \} |
| `args.spender` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

### spenderDailyCapTokens()

> **spenderDailyCapTokens**: (`args`) => `Promise`\<`bigint`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`bigint`\>

### spenderRateLimit()

> **spenderRateLimit**: (`args`) => `Promise`\<\{ `dailyBurnTotal`: `bigint`; `reserved`: `bigint`; `windowStart`: `bigint`; \}\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `spender`: `Address`; `token`: `Address`; \} |
| `args.spender` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<\{ `dailyBurnTotal`: `bigint`; `reserved`: `bigint`; `windowStart`: `bigint`; \}\>

### SUPERPAYMASTER\_ADDRESS()

> **SUPERPAYMASTER\_ADDRESS**: (`args`) => `Promise`\<`Address`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`Address`\>

### transferAndCall()

> **transferAndCall**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amount`: `bigint`; `data?`: [`Hex`](https://viem.sh/docs/index.html); `to`: `Address`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amount` | `bigint` |
| `args.data?` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.to` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### transferCommunityOwnership()

> **transferCommunityOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newOwner`: `Address`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newOwner` | `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### unsetEmergencyDisabled()

> **unsetEmergencyDisabled**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Clear the emergency-disabled flag. State-changing tx → resolves to a tx `Hash`.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### updateExchangeRate()

> **updateExchangeRate**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newRate`: `bigint`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newRate` | `bigint` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### usedDebtHashes()

> **usedDebtHashes**: (`args`) => `Promise`\<`boolean`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `opHash`: [`Hex`](https://viem.sh/docs/index.html); `token`: `Address`; \} |
| `args.opHash` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.token` | `Address` |

#### Returns

`Promise`\<`boolean`\>

### usedOpHashes()

> **usedOpHashes**: (`args`) => `Promise`\<`boolean`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `opHash`: [`Hex`](https://viem.sh/docs/index.html); `token`: `Address`; \} |
| `args.opHash` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.token` | `Address` |

#### Returns

`Promise`\<`boolean`\>

### version()

> **version**: (`args`) => `Promise`\<`string`\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; \} |
| `args.token` | `Address` |

#### Returns

`Promise`\<`string`\>
