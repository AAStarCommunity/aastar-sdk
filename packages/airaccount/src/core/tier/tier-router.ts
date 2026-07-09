import {
  TierLevel,
  TierConfig,
  AlgId,
  ALG_ECDSA,
  ALG_CUMULATIVE_T2,
  ALG_CUMULATIVE_T3,
  ALG_CUMULATIVE_T2_WA,
  ALG_CUMULATIVE_T3_WA,
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
 * Determine the required tier for an ERC-20 **token** transfer. This mirrors the on-chain GUARD
 * (`AAStarGlobalGuard.recordTokenSpend`), whose per-token semantics DIFFER from the account's
 * `requiredTier` at `tier2Limit == 0`: the guard treats a zero tier2Limit as an UNCAPPED Tier-2
 * (`cfg.tier2Limit == 0 || cumulative <= cfg.tier2Limit` → T2), whereas the account (and
 * {@link resolveTier}) fall through to Tier-3. A valid token config may set `tier1Limit > 0,
 * tier2Limit == 0` (T1-capped, T2-uncapped; `_validateTokenConfig` only requires `daily >= tier1`).
 * Use this for the token path; use {@link resolveTier} for ETH/account-tier decisions.
 */
export function resolveTokenTier(value: bigint, config: TierConfig): TierLevel {
  if (config.tier1Limit === 0n && config.tier2Limit === 0n) return 1;
  if (config.tier1Limit > 0n && value <= config.tier1Limit) return 1;
  if (config.tier2Limit === 0n || value <= config.tier2Limit) return 2;
  return 3;
}

/**
 * Get the algorithm ID to use for a given tier.
 *
 * `webAuthn` selects the device-passkey (WebAuthn) cumulative variant for Tier-2/3 — the account
 * approves (and validateUserOp enforces) the EXACT signing algId, and the WebAuthn path signs
 * `0x09`/`0x0a`, NOT the raw-P256 `0x04`/`0x05`. A guard/pre-flight that queries the wrong algId gives a
 * false "algorithm not approved" on device-passkey accounts (#256). Tier-1 is always ECDSA `0x02`
 * (`useWebAuthnPasskey` applies to Tier-2/3 only — the device passkey is the composite P256 factor).
 *
 * - Tier 1: ALG_ECDSA (0x02) — single ECDSA, packed [0x02][r][s][v] (66 bytes); v0.25.0 requires the prefix (#273)
 * - Tier 2: raw ALG_CUMULATIVE_T2 (0x04) · WebAuthn ALG_CUMULATIVE_T2_WA (0x09)
 * - Tier 3: raw ALG_CUMULATIVE_T3 (0x05) · WebAuthn ALG_CUMULATIVE_T3_WA (0x0a)
 */
export function algIdForTier(tier: TierLevel, webAuthn = false): AlgId {
  switch (tier) {
    case 1:
      return ALG_ECDSA;
    case 2:
      return webAuthn ? ALG_CUMULATIVE_T2_WA : ALG_CUMULATIVE_T2;
    case 3:
      return webAuthn ? ALG_CUMULATIVE_T3_WA : ALG_CUMULATIVE_T3;
  }
}
