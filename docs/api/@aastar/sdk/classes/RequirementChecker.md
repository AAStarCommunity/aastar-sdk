Defined in: [packages/core/src/requirementChecker.ts:99](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/requirementChecker.ts#L99)

Requirement Checker Utility

## Description

Centralized validation for all role requirements

## Example

```typescript
const checker = new RequirementChecker(publicClient);

// Check community launch requirements
const result = await checker.checkRequirements({
    address: userAddress,
    roleId: ROLE_COMMUNITY,
    requiredGToken: parseEther("33"),
    requireSBT: false
});

if (!result.hasEnoughGToken) {
    console.error(result.missingRequirements.join('\n'));
}
```

## Constructors

### Constructor

> **new RequirementChecker**(`publicClient`, `addresses?`): `RequirementChecker`

Defined in: [packages/core/src/requirementChecker.ts:100](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/requirementChecker.ts#L100)

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `publicClient` | [`PublicClient`](../interfaces/PublicClient.md) | **`Internal`** |
| `addresses?` | \{ `apnts?`: `` `0x${string}` ``; `gtoken?`: `` `0x${string}` ``; `mysbt?`: `` `0x${string}` ``; `registry?`: `` `0x${string}` ``; \} | **`Internal`** |
| `addresses.apnts?` | `` `0x${string}` `` | - |
| `addresses.gtoken?` | `` `0x${string}` `` | - |
| `addresses.mysbt?` | `` `0x${string}` `` | - |
| `addresses.registry?` | `` `0x${string}` `` | - |

#### Returns

`RequirementChecker`

## Methods

### checkAPNTsBalance()

> **checkAPNTsBalance**(`address`, `required`): `Promise`\<\{ `balance`: `bigint`; `hasEnough`: `boolean`; \}\>

Defined in: [packages/core/src/requirementChecker.ts:239](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/requirementChecker.ts#L239)

Check aPNTs balance only (shortcut)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `address` | `` `0x${string}` `` |
| `required` | `bigint` |

#### Returns

`Promise`\<\{ `balance`: `bigint`; `hasEnough`: `boolean`; \}\>

***

### checkGTokenBalance()

> **checkGTokenBalance**(`address`, `required`): `Promise`\<\{ `balance`: `bigint`; `hasEnough`: `boolean`; \}\>

Defined in: [packages/core/src/requirementChecker.ts:218](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/requirementChecker.ts#L218)

Check GToken balance only (shortcut)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `address` | `` `0x${string}` `` |
| `required` | `bigint` |

#### Returns

`Promise`\<\{ `balance`: `bigint`; `hasEnough`: `boolean`; \}\>

***

### checkHasRole()

> **checkHasRole**(`roleId`, `address`): `Promise`\<`boolean`\>

Defined in: [packages/core/src/requirementChecker.ts:275](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/requirementChecker.ts#L275)

Check if user has specific role (shortcut)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `roleId` | `` `0x${string}` `` |
| `address` | `` `0x${string}` `` |

#### Returns

`Promise`\<`boolean`\>

***

### checkHasSBT()

> **checkHasSBT**(`address`): `Promise`\<`boolean`\>

Defined in: [packages/core/src/requirementChecker.ts:260](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/requirementChecker.ts#L260)

Check if user has MySBT (shortcut)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `address` | `` `0x${string}` `` |

#### Returns

`Promise`\<`boolean`\>

***

### checkRequirements()

> **checkRequirements**(`params`): `Promise`\<[`RoleRequirement`](../interfaces/RoleRequirement.md)\>

Defined in: [packages/core/src/requirementChecker.ts:118](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/requirementChecker.ts#L118)

Check all requirements for a user

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `params` | \{ `address`: `` `0x${string}` ``; `requiredAPNTs?`: `bigint`; `requiredGToken?`: `bigint`; `requireSBT?`: `boolean`; `roleId?`: `` `0x${string}` ``; \} | Check parameters |
| `params.address` | `` `0x${string}` `` | - |
| `params.requiredAPNTs?` | `bigint` | - |
| `params.requiredGToken?` | `bigint` | - |
| `params.requireSBT?` | `boolean` | - |
| `params.roleId?` | `` `0x${string}` `` | - |

#### Returns

`Promise`\<[`RoleRequirement`](../interfaces/RoleRequirement.md)\>

Detailed requirement status

***

### checkResources()

> **checkResources**(`wallet`, `mode`, `options`): `Promise`\<[`ResourceReport`](../interfaces/ResourceReport.md)\>

Defined in: [packages/core/src/requirementChecker.ts:321](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/requirementChecker.ts#L321)

Aggregated readiness query for an operator onboarding mode.

Composes the existing `check*` shortcuts into a single structured report,
so consumers (e.g. YAA) no longer need to wire each balance/role/SBT read
by hand. Each unmet requirement produces an actionable `issue` string.

- `AOA`  — independent paymaster operator: checks `ROLE_PAYMASTER_AOA` + role stake.
- `AOA+` — shared SuperPaymaster operator: checks `ROLE_PAYMASTER_SUPER` + role stake + SBT.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `wallet` | `` `0x${string}` `` | Operator address to evaluate. |
| `mode` | [`OperatorMode`](../type-aliases/OperatorMode.md) | Onboarding mode (`'AOA'` | `'AOA+'`). |
| `options` | [`CheckResourcesOptions`](../interfaces/CheckResourcesOptions.md) | Optional threshold overrides. |

#### Returns

`Promise`\<[`ResourceReport`](../interfaces/ResourceReport.md)\>

A [ResourceReport](../interfaces/ResourceReport.md); `ready` is true iff `issues` is empty.

***

### checkRoleStake()

> **checkRoleStake**(`roleId`, `address`, `required`): `Promise`\<\{ `hasEnough`: `boolean`; `staked`: `bigint`; \}\>

Defined in: [packages/core/src/requirementChecker.ts:288](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/requirementChecker.ts#L288)

Check a user's on-chain role stake (`getRoleStake(roleId, operator)`) (shortcut).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `roleId` | `` `0x${string}` `` |
| `address` | `` `0x${string}` `` |
| `required` | `bigint` |

#### Returns

`Promise`\<\{ `hasEnough`: `boolean`; `staked`: `bigint`; \}\>
