> **SuperPaymasterActions** = `object`

Defined in: [packages/core/src/actions/superPaymaster.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L73)

## Properties

### addStake()

> **addStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L82)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `unstakeDelaySec`: `number`; `value`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.unstakeDelaySec` | `number` |
| `args.value` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### APNTS\_TOKEN()

> **APNTS\_TOKEN**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:190](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L190)

#### Returns

`Promise`\<`Address`\>

***

### APNTS\_TOKEN\_TIMELOCK()

> **APNTS\_TOKEN\_TIMELOCK**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:214](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L214)

Duration (seconds) of the aPNTs-token-change timelock.

#### Returns

`Promise`\<`bigint`\>

***

### aPNTsPriceUSD()

> **aPNTsPriceUSD**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:172](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L172)

#### Returns

`Promise`\<`bigint`\>

***

### applyBLSAggregator()

> **applyBLSAggregator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:148](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L148)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### BLS\_AGGREGATOR()

> **BLS\_AGGREGATOR**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:192](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L192)

#### Returns

`Promise`\<`Address`\>

***

### ~~BPS\_DENOMINATOR()~~

> **BPS\_DENOMINATOR**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:212](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L212)

#### Returns

`Promise`\<`bigint`\>

#### Deprecated

Removed in the v5.x contract refactor — not in the deployed SuperPaymaster ABI. Throws ErrorCode.NOT\_IMPLEMENTED.

***

### cachedPrice()

> **cachedPrice**: () => `Promise`\<\{ `decimals`: `number`; `price`: `bigint`; `roundId`: `bigint`; `updatedAt`: `bigint`; \}\>

Defined in: [packages/core/src/actions/superPaymaster.ts:171](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L171)

#### Returns

`Promise`\<\{ `decimals`: `number`; `price`: `bigint`; `roundId`: `bigint`; `updatedAt`: `bigint`; \}\>

***

### cancelAPNTsTokenChange()

> **cancelAPNTsTokenChange**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:122](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L122)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### cancelEmergencyPrice()

> **cancelEmergencyPrice**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:140](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L140)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### clearPendingDebt()

> **clearPendingDebt**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:104](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L104)

Operator force-clears the user's pending-debt entry without recording it.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `token`: `Address`; `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.token` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### configureOperator()

> **configureOperator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:87](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L87)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `opTreasury`: `Address`; `xPNTsToken`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.opTreasury` | `Address` |
| `args.xPNTsToken` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### deposit()

> **deposit**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L75)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amount`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amount` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### depositETH()

> **depositETH**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L76)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `value`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.value` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### depositFor()

> **depositFor**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:77](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L77)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amount`: `bigint`; `targetOperator`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amount` | `bigint` |
| `args.targetOperator` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### dryRunValidation()

> **dryRunValidation**: (`args`) => `Promise`\<[`DryRunValidationResult`](DryRunValidationResult.md)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:160](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L160)

Off-chain pre-flight validation of a UserOp against this paymaster.
Returns `{ ok, reasonCode }` so callers can detect AA34-style rejections
before submitting the UserOp on-chain. View call; never mutates state.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `maxCost`: `bigint`; `userOp`: [`PackedUserOperation`](PackedUserOperation.md); \} |
| `args.maxCost` | `bigint` |
| `args.userOp` | [`PackedUserOperation`](PackedUserOperation.md) |

#### Returns

`Promise`\<[`DryRunValidationResult`](DryRunValidationResult.md)\>

***

### EMERGENCY\_TIMELOCK()

> **EMERGENCY\_TIMELOCK**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:144](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L144)

#### Returns

`Promise`\<`bigint`\>

***

### emergencyActivatedAt()

> **emergencyActivatedAt**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:142](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L142)

#### Returns

`Promise`\<`bigint`\>

***

### emergencyPendingPrice()

> **emergencyPendingPrice**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:141](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L141)

#### Returns

`Promise`\<`bigint`\>

***

### emergencyQueuedAt()

> **emergencyQueuedAt**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:143](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L143)

#### Returns

`Promise`\<`bigint`\>

***

### emergencySetPrice()

> **emergencySetPrice**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:138](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L138)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newPrice`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newPrice` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### entryPoint()

> **entryPoint**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:196](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L196)

#### Returns

`Promise`\<`Address`\>

***

### ETH\_USD\_PRICE\_FEED()

> **ETH\_USD\_PRICE\_FEED**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:193](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L193)

#### Returns

`Promise`\<`Address`\>

***

### executeAPNTsTokenChange()

> **executeAPNTsTokenChange**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:121](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L121)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### executeEmergencyPrice()

> **executeEmergencyPrice**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:139](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L139)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### executeSlashWithBLS()

> **executeSlashWithBLS**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:91](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L91)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `level`: `number`; `operator`: `Address`; `proof`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.level` | `number` |
| `args.operator` | `Address` |
| `args.proof` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### getAvailableCredit()

> **getAvailableCredit**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:164](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L164)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; `user`: `Address`; \} |
| `args.token` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### getDeposit()

> **getDeposit**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:165](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L165)

#### Returns

`Promise`\<`bigint`\>

***

### getLatestSlash()

> **getLatestSlash**: (`args`) => `Promise`\<[`SlashRecord`](SlashRecord.md)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:166](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L166)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `operator`: `Address`; \} |
| `args.operator` | `Address` |

#### Returns

`Promise`\<[`SlashRecord`](SlashRecord.md)\>

***

### getSlashCount()

> **getSlashCount**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:167](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L167)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `operator`: `Address`; \} |
| `args.operator` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### getSlashHistory()

> **getSlashHistory**: (`args`) => `Promise`\<[`SlashRecord`](SlashRecord.md)[]\>

Defined in: [packages/core/src/actions/superPaymaster.ts:168](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L168)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `operator`: `Address`; \} |
| `args.operator` | `Address` |

#### Returns

`Promise`\<[`SlashRecord`](SlashRecord.md)[]\>

***

### isChainlinkStale()

> **isChainlinkStale**: () => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:179](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L179)

True when the Chainlink ETH/USD feed is considered stale by the contract.

#### Returns

`Promise`\<`boolean`\>

***

### ~~MAX\_ETH\_USD\_PRICE()~~

> **MAX\_ETH\_USD\_PRICE**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:200](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L200)

#### Returns

`Promise`\<`bigint`\>

#### Deprecated

Removed from SuperPaymaster in the v5.x refactor (this bound belongs to the standalone Paymaster contract). Throws ErrorCode.NOT\_IMPLEMENTED.

***

### ~~MAX\_PROTOCOL\_FEE()~~

> **MAX\_PROTOCOL\_FEE**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:198](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L198)

#### Returns

`Promise`\<`bigint`\>

#### Deprecated

Removed in the v5.x contract refactor — not in the deployed SuperPaymaster ABI. Throws ErrorCode.NOT\_IMPLEMENTED.

***

### ~~MIN\_ETH\_USD\_PRICE()~~

> **MIN\_ETH\_USD\_PRICE**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:202](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L202)

#### Returns

`Promise`\<`bigint`\>

#### Deprecated

Removed from SuperPaymaster in the v5.x refactor (this bound belongs to the standalone Paymaster contract). Throws ErrorCode.NOT\_IMPLEMENTED.

***

### onTransferReceived()

> **onTransferReceived**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:151](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L151)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `data`: [`Hex`](https://viem.sh/docs/index.html); `from`: `Address`; `operator`: `Address`; `value`: `bigint`; \} |
| `args.data` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.from` | `Address` |
| `args.operator` | `Address` |
| `args.value` | `bigint` |

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### operators()

> **operators**: (`args`) => `Promise`\<[`OperatorConfig`](OperatorConfig.md)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:163](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L163)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `operator`: `Address`; \} |
| `args.operator` | `Address` |

#### Returns

`Promise`\<[`OperatorConfig`](OperatorConfig.md)\>

***

### owner()

> **owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:217](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L217)

#### Returns

`Promise`\<`Address`\>

***

### ~~PAYMASTER\_DATA\_OFFSET()~~

> **PAYMASTER\_DATA\_OFFSET**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:204](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L204)

#### Returns

`Promise`\<`bigint`\>

#### Deprecated

Removed in the v5.x contract refactor — not in the deployed SuperPaymaster ABI. Throws ErrorCode.NOT\_IMPLEMENTED.

***

### pendingAPNTsToken()

> **pendingAPNTsToken**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:123](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L123)

#### Returns

`Promise`\<`Address`\>

***

### pendingAPNTsTokenEta()

> **pendingAPNTsTokenEta**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:124](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L124)

#### Returns

`Promise`\<`bigint`\>

***

### pendingBLSAgg()

> **pendingBLSAgg**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:185](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L185)

Address of the BLS aggregator pending the timelock (`zeroAddress` if none queued).

#### Returns

`Promise`\<`Address`\>

***

### pendingBLSAggEta()

> **pendingBLSAggEta**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:187](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L187)

Unix-second ETA at which the pending BLS aggregator change becomes executable (uint48).

#### Returns

`Promise`\<`bigint`\>

***

### pendingDebts()

> **pendingDebts**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:100](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L100)

Read the unrecovered debt recorded for a user after a failed burn/recordDebt.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `token`: `Address`; `user`: `Address`; \} |
| `args.token` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### ~~PRICE\_CACHE\_DURATION()~~

> **PRICE\_CACHE\_DURATION**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:206](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L206)

#### Returns

`Promise`\<`bigint`\>

#### Deprecated

Removed in the v5.x contract refactor — not in the deployed SuperPaymaster ABI. Throws ErrorCode.NOT\_IMPLEMENTED.

***

### priceMode()

> **priceMode**: () => `Promise`\<`number`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:181](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L181)

Current pricing mode (uint8 enum on the contract).

#### Returns

`Promise`\<`number`\>

***

### priceStalenessThreshold()

> **priceStalenessThreshold**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:176](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L176)

#### Returns

`Promise`\<`bigint`\>

***

### priceValidUntil()

> **priceValidUntil**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:183](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L183)

Unix-second timestamp until which the cached price remains valid (uint48).

#### Returns

`Promise`\<`bigint`\>

***

### protocolFeeBPS()

> **protocolFeeBPS**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:173](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L173)

#### Returns

`Promise`\<`bigint`\>

***

### protocolRevenue()

> **protocolRevenue**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:174](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L174)

#### Returns

`Promise`\<`bigint`\>

***

### queueBLSAggregator()

> **queueBLSAggregator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:147](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L147)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `aggregator`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.aggregator` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### ~~RATE\_OFFSET()~~

> **RATE\_OFFSET**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:208](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L208)

#### Returns

`Promise`\<`bigint`\>

#### Deprecated

Removed in the v5.x contract refactor — not in the deployed SuperPaymaster ABI. Throws ErrorCode.NOT\_IMPLEMENTED.

***

### REGISTRY()

> **REGISTRY**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:191](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L191)

#### Returns

`Promise`\<`Address`\>

***

### renounceOwnership()

> **renounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:219](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L219)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### resolveAPNTsToken()

> **resolveAPNTsToken**: (`args?`) => `Promise`\<[`ResolvedAPNTsToken`](ResolvedAPNTsToken.md)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:135](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L135)

Resolve the live aPNTs token address from chain instead of relying on a static constant.

Reads `APNTS_TOKEN()` (active), `pendingAPNTsToken()` and `pendingAPNTsTokenEta()`
in parallel and returns them as a structured result. Prefer `active` for runtime use.

If `fallback` is supplied and the chain reads fail, the static `fallback` address is
returned with `fallbackUsed: true` (pending fields zeroed). Without a `fallback` the
underlying error is re-thrown rather than silently masked.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args?` | \{ `fallback?`: `Address`; \} |
| `args.fallback?` | `Address` |

#### Returns

`Promise`\<[`ResolvedAPNTsToken`](ResolvedAPNTsToken.md)\>

***

### retryPendingDebt()

> **retryPendingDebt**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:102](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L102)

Operator retries recovering up to `amount` of the user's pending debt.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amount`: `bigint`; `token`: `Address`; `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amount` | `bigint` |
| `args.token` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### sbtHolders()

> **sbtHolders**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:177](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L177)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### setAPNTSPrice()

> **setAPNTSPrice**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:107](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L107)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newPrice`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newPrice` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setAPNTsToken()

> **setAPNTsToken**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:115](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L115)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### ~~setBLSAggregator()~~

> **setBLSAggregator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:117](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L117)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `aggregator`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.aggregator` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

The deployed SuperPaymaster ABI has no direct `setBLSAggregator` — the aggregator change is timelocked via [queueBLSAggregator](#queueblsaggregator) + [applyBLSAggregator](#applyblsaggregator). Throws ErrorCode.NOT\_IMPLEMENTED.

***

### setOperatorLimits()

> **setOperatorLimits**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L89)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `minTxInterval`: `number`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.minTxInterval` | `number` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setOperatorPaused()

> **setOperatorPaused**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:88](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L88)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `operator`: `Address`; `paused`: `boolean`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.operator` | `Address` |
| `args.paused` | `boolean` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setProtocolFee()

> **setProtocolFee**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:112](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L112)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newFeeBPS`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newFeeBPS` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setTreasury()

> **setTreasury**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:113](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L113)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `treasury`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.treasury` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setXPNTsFactory()

> **setXPNTsFactory**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:114](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L114)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `factory`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.factory` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### slashHistory()

> **slashHistory**: (`args`) => `Promise`\<[`SlashRecord`](SlashRecord.md)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:169](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L169)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `index`: `bigint`; `operator`: `Address`; \} |
| `args.index` | `bigint` |
| `args.operator` | `Address` |

#### Returns

`Promise`\<[`SlashRecord`](SlashRecord.md)\>

***

### slashOperator()

> **slashOperator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:92](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L92)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `level`: `number`; `operator`: `Address`; `penaltyAmount`: `bigint`; `reason`: `string`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.level` | `number` |
| `args.operator` | `Address` |
| `args.penaltyAmount` | `bigint` |
| `args.reason` | `string` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### totalTrackedBalance()

> **totalTrackedBalance**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:175](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L175)

#### Returns

`Promise`\<`bigint`\>

***

### transferOwnership()

> **transferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:218](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L218)

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

Defined in: [packages/core/src/actions/superPaymaster.ts:194](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L194)

#### Returns

`Promise`\<`Address`\>

***

### unlockStake()

> **unlockStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L83)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### updateBlockedStatus()

> **updateBlockedStatus**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:95](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L95)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `operator`: `Address`; `statuses`: `boolean`[]; `users`: `Address`[]; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.operator` | `Address` |
| `args.statuses` | `boolean`[] |
| `args.users` | `Address`[] |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### updatePrice()

> **updatePrice**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:108](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L108)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### updatePriceDVT()

> **updatePriceDVT**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:109](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L109)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `price`: `bigint`; `proof`: [`Hex`](https://viem.sh/docs/index.html); `updatedAt`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.price` | `bigint` |
| `args.proof` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.updatedAt` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### updateReputation()

> **updateReputation**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:90](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L90)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newScore`: `bigint`; `operator`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newScore` | `bigint` |
| `args.operator` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### updateSBTStatus()

> **updateSBTStatus**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:96](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L96)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `status`: `boolean`; `user`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.status` | `boolean` |
| `args.user` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### userOpState()

> **userOpState**: (`args`) => `Promise`\<\{ `isBlocked`: `boolean`; `lastTimestamp`: `number`; \}\>

Defined in: [packages/core/src/actions/superPaymaster.ts:170](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L170)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `operator`: `Address`; `user`: `Address`; \} |
| `args.operator` | `Address` |
| `args.user` | `Address` |

#### Returns

`Promise`\<\{ `isBlocked`: `boolean`; `lastTimestamp`: `number`; \}\>

***

### validatePaymasterUserOp()

> **validatePaymasterUserOp**: (`args`) => `Promise`\<\{ `context`: [`Hex`](https://viem.sh/docs/index.html); `validationData`: `bigint`; \}\>

Defined in: [packages/core/src/actions/superPaymaster.ts:154](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L154)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `maxCost`: `bigint`; `userOp`: `any`; `userOpHash`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.maxCost` | `bigint` |
| `args.userOp` | `any` |
| `args.userOpHash` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<\{ `context`: [`Hex`](https://viem.sh/docs/index.html); `validationData`: `bigint`; \}\>

***

### ~~VALIDATION\_BUFFER\_BPS()~~

> **VALIDATION\_BUFFER\_BPS**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:210](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L210)

#### Returns

`Promise`\<`bigint`\>

#### Deprecated

Removed in the v5.x contract refactor — not in the deployed SuperPaymaster ABI. Throws ErrorCode.NOT\_IMPLEMENTED.

***

### version()

> **version**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:222](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L222)

#### Returns

`Promise`\<`string`\>

***

### withdraw()

> **withdraw**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:79](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L79)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amount`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amount` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### withdrawProtocolRevenue()

> **withdrawProtocolRevenue**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:118](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L118)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amount`: `bigint`; `to`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amount` | `bigint` |
| `args.to` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### withdrawStake()

> **withdrawStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L84)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `to`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.to` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### withdrawTo()

> **withdrawTo**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:78](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L78)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amount`: `bigint`; `to`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amount` | `bigint` |
| `args.to` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### xpntsFactory()

> **xpntsFactory**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:195](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L195)

#### Returns

`Promise`\<`Address`\>
