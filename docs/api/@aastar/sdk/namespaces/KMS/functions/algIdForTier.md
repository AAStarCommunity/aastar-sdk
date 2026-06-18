> **algIdForTier**(`tier`): [`AlgId`](../type-aliases/AlgId.md)

Defined in: [packages/airaccount/src/core/tier/tier-router.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/core/tier/tier-router.ts#L33)

Get the algorithm ID to use for a given tier.

- Tier 1: ALG_ECDSA (0x02) — raw 65-byte ECDSA, no prefix needed
- Tier 2: ALG_CUMULATIVE_T2 (0x04) — P256 + BLS
- Tier 3: ALG_CUMULATIVE_T3 (0x05) — P256 + BLS + Guardian

## Parameters

| Parameter | Type |
| ------ | ------ |
| `tier` | [`TierLevel`](../type-aliases/TierLevel.md) |

## Returns

[`AlgId`](../type-aliases/AlgId.md)
