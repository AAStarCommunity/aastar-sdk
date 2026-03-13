import {
  TierLevel,
  TierConfig,
  AlgId,
  ALG_ECDSA,
  ALG_CUMULATIVE_T2,
  ALG_CUMULATIVE_T3,
} from "./types";

/**
 * Determine the required tier for a given transaction value.
 *
 * - Tier 1: value <= tier1Limit — single ECDSA or P256 passkey
 * - Tier 2: tier1Limit < value <= tier2Limit — P256 + BLS aggregate
 * - Tier 3: value > tier2Limit — P256 + BLS + Guardian ECDSA
 *
 * If both limits are 0 (no enforcement), always returns Tier 1.
 */
export function resolveTier(value: bigint, config: TierConfig): TierLevel {
  if (config.tier1Limit === 0n && config.tier2Limit === 0n) return 1;
  if (config.tier1Limit > 0n && value <= config.tier1Limit) return 1;
  if (config.tier2Limit > 0n && value <= config.tier2Limit) return 2;
  return 3;
}

/**
 * Get the algorithm ID to use for a given tier.
 *
 * - Tier 1: ALG_ECDSA (0x02) — raw 65-byte ECDSA, no prefix needed
 * - Tier 2: ALG_CUMULATIVE_T2 (0x04) — P256 + BLS
 * - Tier 3: ALG_CUMULATIVE_T3 (0x05) — P256 + BLS + Guardian
 */
export function algIdForTier(tier: TierLevel): AlgId {
  switch (tier) {
    case 1:
      return ALG_ECDSA;
    case 2:
      return ALG_CUMULATIVE_T2;
    case 3:
      return ALG_CUMULATIVE_T3;
  }
}
