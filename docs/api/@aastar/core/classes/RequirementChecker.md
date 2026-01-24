Defined in: [packages/core/src/requirementChecker.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/requirementChecker.ts#L43)

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

Defined in: [packages/core/src/requirementChecker.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/requirementChecker.ts#L44)

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

Defined in: [packages/core/src/requirementChecker.ts:183](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/requirementChecker.ts#L183)

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

Defined in: [packages/core/src/requirementChecker.ts:162](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/requirementChecker.ts#L162)

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

Defined in: [packages/core/src/requirementChecker.ts:219](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/requirementChecker.ts#L219)

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

Defined in: [packages/core/src/requirementChecker.ts:204](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/requirementChecker.ts#L204)

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

Defined in: [packages/core/src/requirementChecker.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/requirementChecker.ts#L62)

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
