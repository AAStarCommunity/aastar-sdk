> **DryRunValidationResult** = `object`

Defined in: [packages/core/src/actions/superPaymaster.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L28)

Result of an off-chain `dryRunValidation` pre-flight check.
`ok` mirrors whether the paymaster would accept the UserOp; `reasonCode` is a
bytes32 machine-readable rejection code (zero when `ok` is true).

## Properties

### ok

> **ok**: `boolean`

Defined in: [packages/core/src/actions/superPaymaster.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L29)

***

### reasonCode

> **reasonCode**: [`Hex`](https://viem.sh/docs/index.html)

Defined in: [packages/core/src/actions/superPaymaster.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/superPaymaster.ts#L30)
