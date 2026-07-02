// Unified tier-profile helper (#266): one profile bakes native-ETH + per-ERC-20 (USDC/USDT/custom)
// tier ceilings for a user segment (e.g. Web3 Beginner / Trader / Conservative).
//
// SYMMETRY NOTE: the per-token configs (initialTokenConfigs) are baked at ACCOUNT BIRTH via InitConfig.
// The native-ETH tier1/tier2 are account storage slots 10/11 and — until airaccount-contract#161 folds
// them into InitConfig — must be applied AFTER deploy via `setTierLimits(tier1, tier2)` (onlyOwnerOrSelf).
// `resolveTierProfile` returns BOTH halves so a caller can wire the two steps (and, once #161 lands, the
// ethTierLimits fold into the create params with no API change).
import { parseEther, type Address } from "viem";
import type { TokenConfig } from "@aastar/core";

/** Per-ERC-20 tier ceilings (in the token's own units, e.g. 6-decimal USDC). */
export interface TierProfileToken {
  address: Address;
  /** Tier-1 (passkey-only) ceiling. */
  tier1: bigint;
  /** Tier-2 (+DVT/BLS) ceiling. Over `dailyLimit` is hard-blocked (needs a guardian). */
  tier2: bigint;
  /** Hard daily cap for this token. */
  dailyLimit: bigint;
}

/** A user-segment spending profile: native-ETH ceilings + optional per-ERC-20 ceilings. */
export interface TierProfile {
  /** Native-ETH ceilings (wei). tier1 = passkey-only; tier2 = +DVT; over dailyLimit is hard-blocked. */
  eth: { tier1: bigint; tier2: bigint; dailyLimit: bigint };
  /** Optional per-ERC-20 configs (USDC / USDT / any custom token). */
  tokens?: readonly TierProfileToken[];
}

/** The two halves a TierProfile resolves to: birth-bakeable InitConfig params + the native-ETH tier limits. */
export interface ResolvedTierProfile {
  /** → `PasskeyCreateParams.dailyLimit` (native-ETH daily, baked in InitConfig at birth). */
  dailyLimit: bigint;
  /** → `PasskeyCreateParams.initialTokens` (baked at birth). */
  initialTokens: Address[];
  /** → `PasskeyCreateParams.initialTokenConfigs` (baked at birth). */
  initialTokenConfigs: TokenConfig[];
  /** → `setTierLimits(tier1, tier2)` after deploy (native-ETH tier; folds into InitConfig once #161 lands). */
  ethTierLimits: { tier1: bigint; tier2: bigint };
}

function assertTiering(label: string, tier1: bigint, tier2: bigint, daily: bigint): void {
  // Mirror the contract rules (AAStarGlobalGuard._validateTokenConfig / setTierLimits): non-negative,
  // tier1 <= tier2 (when both set), and a positive tier must sit under a positive daily cap.
  if (tier1 < 0n || tier2 < 0n || daily < 0n) throw new Error(`TierProfile.${label}: limits must be non-negative`);
  if (tier1 > 0n && tier2 > 0n && tier1 > tier2) throw new Error(`TierProfile.${label}: tier1 (${tier1}) must be <= tier2 (${tier2})`);
  if (daily > 0n && tier2 > 0n && tier2 > daily) throw new Error(`TierProfile.${label}: tier2 (${tier2}) must be <= dailyLimit (${daily})`);
  if (daily === 0n && (tier1 > 0n || tier2 > 0n)) throw new Error(`TierProfile.${label}: a positive tier requires dailyLimit > 0`);
}

/**
 * Split a {@link TierProfile} into the birth-bakeable InitConfig params (native-ETH daily + all token
 * configs) and the native-ETH tier1/tier2 (applied via `setTierLimits` until airaccount-contract#161).
 * Validates each config against the contract's tiering rules.
 */
export function resolveTierProfile(profile: TierProfile): ResolvedTierProfile {
  assertTiering("eth", profile.eth.tier1, profile.eth.tier2, profile.eth.dailyLimit);
  if (profile.eth.dailyLimit <= 0n) throw new Error("TierProfile.eth.dailyLimit must be > 0 (enables the on-chain guard)");
  const tokens = profile.tokens ?? [];
  tokens.forEach((t, i) => assertTiering(`tokens[${i}] (${t.address})`, t.tier1, t.tier2, t.dailyLimit));
  return {
    dailyLimit: profile.eth.dailyLimit,
    initialTokens: tokens.map((t) => t.address),
    initialTokenConfigs: tokens.map((t) => ({ tier1Limit: t.tier1, tier2Limit: t.tier2, dailyLimit: t.dailyLimit })),
    ethTierLimits: { tier1: profile.eth.tier1, tier2: profile.eth.tier2 },
  };
}

/**
 * Reference ETH-denominated profiles from aastar-sdk#266. These set only the native-ETH half; add
 * `tokens` (USDC/USDT/custom, in their own units) to bake per-token ceilings in the same profile.
 */
export const REFERENCE_ETH_PROFILES: Readonly<Record<"beginner" | "trader" | "conservative", TierProfile["eth"]>> = {
  beginner: { tier1: parseEther("0.01"), tier2: parseEther("0.1"), dailyLimit: parseEther("0.2") },
  trader: { tier1: parseEther("0.1"), tier2: parseEther("1"), dailyLimit: parseEther("5") },
  conservative: { tier1: parseEther("0.005"), tier2: parseEther("0.05"), dailyLimit: parseEther("0.1") },
};
