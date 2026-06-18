Defined in: [packages/core/src/requirementChecker.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/requirementChecker.ts#L45)

Aggregated readiness report for a given [OperatorMode](../type-aliases/OperatorMode.md).
Mirrors the structured-report style of PaymasterV4 `checkGaslessReadiness`.

## Properties

### checks

> **checks**: `object`

Defined in: [packages/core/src/requirementChecker.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/requirementChecker.ts#L50)

Only the sub-checks relevant to the requested mode are populated.

#### role?

> `optional` **role**: [`ResourceBoolCheck`](ResourceBoolCheck.md) & `object`

##### Type Declaration

###### roleId

> **roleId**: `` `0x${string}` ``

#### sbt?

> `optional` **sbt**: [`ResourceBoolCheck`](ResourceBoolCheck.md)

#### stake?

> `optional` **stake**: [`ResourceStakeCheck`](ResourceStakeCheck.md)

***

### issues

> **issues**: `string`[]

Defined in: [packages/core/src/requirementChecker.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/requirementChecker.ts#L56)

Actionable, human-readable description of each unmet requirement.

***

### mode

> **mode**: [`OperatorMode`](../type-aliases/OperatorMode.md)

Defined in: [packages/core/src/requirementChecker.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/requirementChecker.ts#L48)

***

### ready

> **ready**: `boolean`

Defined in: [packages/core/src/requirementChecker.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/requirementChecker.ts#L47)

True when every relevant sub-check passed (`issues.length === 0`).
