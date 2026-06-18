> **AirAccountActions** = `object`

Defined in: [packages/core/src/actions/airAccount.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L37)

## Properties

### accountId()

> **accountId**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/airAccount.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L42)

#### Returns

`Promise`\<`string`\>

***

### cancelModuleInstall()

> **cancelModuleInstall**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/airAccount.ts:81](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L81)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### executeFromExecutor()

> **executeFromExecutor**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/airAccount.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L66)

Execute calls via an installed executor module (ERC-7579 `executeFromExecutor`).
NOTE: this is a state-changing tx, so it resolves to the transaction `Hash` — the
on-chain `bytes[] returnData` is NOT recoverable from a write. If you need the
decoded return data, `simulateContract`/`call` the same function separately.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `executionCalldata`: [`Hex`](https://viem.sh/docs/index.html); `mode`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.executionCalldata` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.mode` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### executeModuleInstall()

> **executeModuleInstall**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/airAccount.ts:80](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L80)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `moduleInitData`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.moduleInitData` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### guardAddTokenConfig()

> **guardAddTokenConfig**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/airAccount.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L71)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `config`: [`TokenConfig`](TokenConfig.md); `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.config` | [`TokenConfig`](TokenConfig.md) |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### guardApproveAlgorithm()

> **guardApproveAlgorithm**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/airAccount.ts:72](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L72)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `algId`: `number`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.algId` | `number` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### guardDecreaseDailyLimit()

> **guardDecreaseDailyLimit**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/airAccount.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L73)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newLimit`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newLimit` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### guardDecreaseTokenDailyLimit()

> **guardDecreaseTokenDailyLimit**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/airAccount.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L74)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newLimit`: `bigint`; `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newLimit` | `bigint` |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### guardianCount()

> **guardianCount**: () => `Promise`\<`number`\>

Defined in: [packages/core/src/actions/airAccount.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L40)

#### Returns

`Promise`\<`number`\>

***

### guardians()

> **guardians**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/airAccount.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L41)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `index`: `bigint` \| `number`; \} |
| `args.index` | `bigint` \| `number` |

#### Returns

`Promise`\<`Address`\>

***

### guardSetStrictMode()

> **guardSetStrictMode**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/airAccount.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L76)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `enabled`: `boolean`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.enabled` | `boolean` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### initializeAgentAccount()

> **initializeAgentAccount**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/airAccount.ts:68](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L68)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `config`: [`InitConfig`](InitConfig.md); `entryPoint`: `Address`; `guardAddr`: `Address`; `owner`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.config` | [`InitConfig`](InitConfig.md) |
| `args.entryPoint` | `Address` |
| `args.guardAddr` | `Address` |
| `args.owner` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### isValidSignature()

> **isValidSignature**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/airAccount.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L43)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `hash`: [`Hex`](https://viem.sh/docs/index.html); `sig`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.hash` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.sig` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### moduleInstallTimelock()

> **moduleInstallTimelock**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/airAccount.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L50)

#### Returns

`Promise`\<`bigint`\>

***

### moduleManagementNonce()

> **moduleManagementNonce**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/airAccount.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L49)

#### Returns

`Promise`\<`bigint`\>

***

### owner()

> **owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/airAccount.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L39)

#### Returns

`Promise`\<`Address`\>

***

### p256KeyX()

> **p256KeyX**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/airAccount.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L46)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### p256KeyY()

> **p256KeyY**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/airAccount.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L47)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### parserRegistry()

> **parserRegistry**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/airAccount.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L48)

#### Returns

`Promise`\<`Address`\>

***

### pendingModuleInstall()

> **pendingModuleInstall**: () => `Promise`\<[`PendingModuleInstall`](PendingModuleInstall.md)\>

Defined in: [packages/core/src/actions/airAccount.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L51)

#### Returns

`Promise`\<[`PendingModuleInstall`](PendingModuleInstall.md)\>

***

### proposeModuleInstall()

> **proposeModuleInstall**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/airAccount.ts:79](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L79)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `initData`: [`Hex`](https://viem.sh/docs/index.html); `module`: `Address`; `moduleTypeId`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.initData` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.module` | `Address` |
| `args.moduleTypeId` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### requiredTier()

> **requiredTier**: (`args`) => `Promise`\<`number`\>

Defined in: [packages/core/src/actions/airAccount.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L44)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `txValue`: `bigint`; \} |
| `args.txValue` | `bigint` |

#### Returns

`Promise`\<`number`\>

***

### setModuleInstallTimelock()

> **setModuleInstallTimelock**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/airAccount.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L82)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `guardianSigs`: [`Hex`](https://viem.sh/docs/index.html); `newTimelock`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.guardianSigs` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.newTimelock` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setP256Key()

> **setP256Key**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/airAccount.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L54)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `x`: [`Hex`](https://viem.sh/docs/index.html); `y`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.x` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.y` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setParserRegistry()

> **setParserRegistry**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/airAccount.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L57)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `registry`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.registry` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setTierLimits()

> **setTierLimits**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/airAccount.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L55)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `tier1`: `bigint`; `tier2`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.tier1` | `bigint` |
| `args.tier2` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setValidator()

> **setValidator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/airAccount.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L56)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `validator`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.validator` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### supportsModule()

> **supportsModule**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/airAccount.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L45)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `moduleTypeId`: `bigint`; \} |
| `args.moduleTypeId` | `bigint` |

#### Returns

`Promise`\<`boolean`\>

***

### validateUserOp()

> **validateUserOp**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/airAccount.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccount.ts#L67)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `missingAccountFunds`: `bigint`; `userOp`: [`PackedUserOperation`](../../core/type-aliases/PackedUserOperation.md); `userOpHash`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.missingAccountFunds` | `bigint` |
| `args.userOp` | [`PackedUserOperation`](../../core/type-aliases/PackedUserOperation.md) |
| `args.userOpHash` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>
