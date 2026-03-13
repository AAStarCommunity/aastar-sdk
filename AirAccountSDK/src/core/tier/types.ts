// ─── Algorithm IDs (matches AAStarAirAccountBase constants) ─────

export const ALG_BLS = 0x01;
export const ALG_ECDSA = 0x02;
export const ALG_P256 = 0x03;
export const ALG_CUMULATIVE_T2 = 0x04; // P256 + BLS
export const ALG_CUMULATIVE_T3 = 0x05; // P256 + BLS + Guardian ECDSA

export type AlgId =
  | typeof ALG_BLS
  | typeof ALG_ECDSA
  | typeof ALG_P256
  | typeof ALG_CUMULATIVE_T2
  | typeof ALG_CUMULATIVE_T3;

// ─── Tier Levels ───────────────────────────────────────────────

export type TierLevel = 1 | 2 | 3;

export interface TierConfig {
  /** Max value for Tier 1 (single ECDSA/Passkey). 0 = no enforcement. */
  tier1Limit: bigint;
  /** Max value for Tier 2 (P256 + BLS). 0 = no enforcement. */
  tier2Limit: bigint;
}

// ─── Guard Status ──────────────────────────────────────────────

export interface GuardStatus {
  hasGuard: boolean;
  guardAddress: string;
  dailyLimit: bigint;
  dailyRemaining: bigint;
}

// ─── Pre-check result ──────────────────────────────────────────

export interface PreCheckResult {
  ok: boolean;
  errors: string[];
  tier: TierLevel;
  algId: AlgId;
}
