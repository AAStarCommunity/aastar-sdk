Defined in: [packages/airaccount/src/server/services/force-exit-service.ts:90](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/force-exit-service.ts#L90)

ForceExitService — typed wrappers for ForceExitModule ERC-7579 emergency L2→L1 exit.

Flow:
  1. Owner installs module via account.installModule(2, forceExitModuleAddr, encodeOnInstall(L2_TYPE.OPTIMISM))
  2. Any party calls proposeForceExit(target, value, data) to submit a bridge-out proposal
  3. 2-of-3 guardians each call approveForceExit(account, guardianSig) within their window
  4. Anyone calls executeForceExit(account) once threshold is met — triggers L2→L1 bridge call

The module is an ERC-7579 Executor (moduleTypeId=2) — call installModule on the account, not here.

## Constructors

### Constructor

> **new ForceExitService**(`moduleAddress`, `client`): `ForceExitService`

Defined in: [packages/airaccount/src/server/services/force-exit-service.ts:93](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/force-exit-service.ts#L93)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `moduleAddress` | `string` |
| `client` | `ForceExitClient` |

#### Returns

`ForceExitService`

## Methods

### approveForceExit()

> **approveForceExit**(`account`, `guardianSig`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/airaccount/src/server/services/force-exit-service.ts:221](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/force-exit-service.ts#L221)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `account` | `string` |
| `guardianSig` | `string` |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### cancelForceExit()

> **cancelForceExit**(`account`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/airaccount/src/server/services/force-exit-service.ts:232](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/force-exit-service.ts#L232)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `account` | `string` |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### encodeApproveForceExit()

> **encodeApproveForceExit**(`account`, `guardianSig`): `string`

Defined in: [packages/airaccount/src/server/services/force-exit-service.ts:187](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/force-exit-service.ts#L187)

Encode calldata for approveForceExit — guardian signs off on the pending proposal.
`guardianSig` must be an EIP-191 personal_sign over the proposal hash.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `account` | `string` |
| `guardianSig` | `string` |

#### Returns

`string`

***

### encodeCancelForceExit()

> **encodeCancelForceExit**(`account`): `string`

Defined in: [packages/airaccount/src/server/services/force-exit-service.ts:203](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/force-exit-service.ts#L203)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `account` | `string` |

#### Returns

`string`

***

### encodeExecuteForceExit()

> **encodeExecuteForceExit**(`account`): `string`

Defined in: [packages/airaccount/src/server/services/force-exit-service.ts:195](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/force-exit-service.ts#L195)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `account` | `string` |

#### Returns

`string`

***

### encodeOnInstall()

> **encodeOnInstall**(`l2Type`): `string`

Defined in: [packages/airaccount/src/server/services/force-exit-service.ts:155](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/force-exit-service.ts#L155)

Encode onInstall calldata for installModule() call on the smart account.
Must be submitted by the account owner, with moduleTypeId=2 (EXECUTOR).

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `l2Type` | [`L2Type`](../type-aliases/L2Type.md) | L2_TYPE.OPTIMISM (1) or L2_TYPE.ARBITRUM (2) |

#### Returns

`string`

#### Example

```ts
const calldata = forceExit.encodeOnInstall(L2_TYPE.OPTIMISM);
// account.installModule(2, forceExitModuleAddress, calldata)
```

***

### encodeOnUninstall()

> **encodeOnUninstall**(): `string`

Defined in: [packages/airaccount/src/server/services/force-exit-service.ts:163](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/force-exit-service.ts#L163)

#### Returns

`string`

***

### encodeProposeForceExit()

> **encodeProposeForceExit**(`target`, `value`, `data`): `string`

Defined in: [packages/airaccount/src/server/services/force-exit-service.ts:175](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/force-exit-service.ts#L175)

Encode calldata for proposeForceExit — the exit payload to bridge out of L2.
`target` is the L2→L1 bridge contract; `data` is the bridge call payload.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `target` | `string` |
| `value` | `bigint` |
| `data` | `string` |

#### Returns

`string`

***

### executeForceExit()

> **executeForceExit**(`account`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/airaccount/src/server/services/force-exit-service.ts:228](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/force-exit-service.ts#L228)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `account` | `string` |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### getAccountL2Type()

> **getAccountL2Type**(`account`): `Promise`\<`number`\>

Defined in: [packages/airaccount/src/server/services/force-exit-service.ts:132](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/force-exit-service.ts#L132)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `account` | `string` |

#### Returns

`Promise`\<`number`\>

***

### getApprovalThreshold()

> **getApprovalThreshold**(): `Promise`\<`number`\>

Defined in: [packages/airaccount/src/server/services/force-exit-service.ts:136](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/force-exit-service.ts#L136)

#### Returns

`Promise`\<`number`\>

***

### getModuleVersion()

> **getModuleVersion**(): `Promise`\<`string`\>

Defined in: [packages/airaccount/src/server/services/force-exit-service.ts:140](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/force-exit-service.ts#L140)

#### Returns

`Promise`\<`string`\>

***

### getPendingExit()

> **getPendingExit**(`account`): `Promise`\<[`PendingExit`](../interfaces/PendingExit.md)\>

Defined in: [packages/airaccount/src/server/services/force-exit-service.ts:112](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/force-exit-service.ts#L112)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `account` | `string` |

#### Returns

`Promise`\<[`PendingExit`](../interfaces/PendingExit.md)\>

***

### isInitialized()

> **isInitialized**(`smartAccount`): `Promise`\<`boolean`\>

Defined in: [packages/airaccount/src/server/services/force-exit-service.ts:108](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/force-exit-service.ts#L108)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `smartAccount` | `string` |

#### Returns

`Promise`\<`boolean`\>

***

### proposeForceExit()

> **proposeForceExit**(`target`, `value`, `data`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/airaccount/src/server/services/force-exit-service.ts:213](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/force-exit-service.ts#L213)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `target` | `string` |
| `value` | `bigint` |
| `data` | `string` |

#### Returns

`Promise`\<`` `0x${string}` ``\>
