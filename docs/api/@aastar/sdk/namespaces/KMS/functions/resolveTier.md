> **resolveTier**(`value`, `config`): [`TierLevel`](../type-aliases/TierLevel.md)

Defined in: [packages/airaccount/src/core/tier/tier-router.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/core/tier/tier-router.ts#L19)

Determine the required tier for a given transaction value.

- Tier 1: value <= tier1Limit — single ECDSA or P256 passkey
- Tier 2: tier1Limit < value <= tier2Limit — P256 + BLS aggregate
- Tier 3: value > tier2Limit — P256 + BLS + Guardian ECDSA

If both limits are 0 (no enforcement), always returns Tier 1.

## Parameters

| Parameter | Type |
| ------ | ------ |
| `value` | `bigint` |
| `config` | [`TierConfig`](../interfaces/TierConfig.md) |

## Returns

[`TierLevel`](../type-aliases/TierLevel.md)
