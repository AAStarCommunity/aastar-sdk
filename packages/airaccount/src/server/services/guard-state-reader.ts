import { ethers } from "ethers";
import { AIRACCOUNT_ABI, GLOBAL_GUARD_ABI } from "../constants/entrypoint";

const EXTENDED_GUARD_ABI = [
  ...GLOBAL_GUARD_ABI,
  "function todaySpent() external view returns (uint256)",
  "function tokenTodaySpent(address token) external view returns (uint256)",
  "function approvedAlgorithms(uint8 algId) external view returns (bool)",
  "function tier1Limit() external view returns (uint256)",
  "function tier2Limit() external view returns (uint256)",
  "function minDailyLimit() external view returns (uint256)",
];

export type TierLevel = 1 | 2 | 3;

export interface GuardState {
  /** ETH daily limit in wei */
  dailyLimit: bigint;
  /** ETH already spent today in wei */
  todaySpent: bigint;
  /** ETH remaining for today in wei */
  remaining: bigint;
  /** Current tier based on spent amount */
  currentTier: TierLevel;
  /** Tier 1 max spend threshold in wei (single sig) */
  tier1Limit: bigint;
  /** Tier 2 max spend threshold in wei (dual sig) */
  tier2Limit: bigint;
  /** Minimum daily limit floor (cannot decrease below this) */
  minDailyLimit: bigint;
  /** Guard contract address */
  guardAddress: string;
}

export interface TokenGuardState {
  token: string;
  todaySpent: bigint;
  dailyLimit: bigint;
  remaining: bigint;
  currentTier: TierLevel;
  tier1Limit: bigint;
  tier2Limit: bigint;
}

/**
 * GuardStateReader — F6: read AAStarGlobalGuard spending state.
 *
 * Enables UI components to show:
 *   - Daily spend progress bar
 *   - Current required tier (T1/T2/T3) for next transaction
 *   - Per-token limits and remaining allowances
 */
export class GuardStateReader {
  private readonly provider: ethers.JsonRpcProvider;

  constructor(provider: ethers.JsonRpcProvider) {
    this.provider = provider;
  }

  /**
   * Read the full ETH guard state for an account.
   * Returns null if the account has no guard (dailyLimit=0).
   */
  async getGuardState(accountAddress: string): Promise<GuardState | null> {
    const account = new ethers.Contract(accountAddress, AIRACCOUNT_ABI, this.provider);
    const guardAddress: string = await account.guard();
    if (guardAddress === ethers.ZeroAddress) return null;

    const guard = new ethers.Contract(guardAddress, EXTENDED_GUARD_ABI, this.provider);
    const [dailyLimit, remaining, todaySpent, tier1Limit, tier2Limit, minDailyLimit] =
      await Promise.all([
        guard.dailyLimit(),
        guard.remainingDailyAllowance(),
        guard.todaySpent(),
        guard.tier1Limit().catch(() => 0n),
        guard.tier2Limit().catch(() => 0n),
        guard.minDailyLimit().catch(() => 0n),
      ]);

    return {
      dailyLimit: BigInt(dailyLimit),
      todaySpent: BigInt(todaySpent),
      remaining: BigInt(remaining),
      currentTier: resolveTierFromSpend(BigInt(todaySpent), BigInt(tier1Limit), BigInt(tier2Limit)),
      tier1Limit: BigInt(tier1Limit),
      tier2Limit: BigInt(tier2Limit),
      minDailyLimit: BigInt(minDailyLimit),
      guardAddress,
    };
  }

  /**
   * Read per-token guard state.
   * Returns null if the token is not configured on the guard.
   */
  async getTokenGuardState(
    accountAddress: string,
    token: string,
  ): Promise<TokenGuardState | null> {
    const account = new ethers.Contract(accountAddress, AIRACCOUNT_ABI, this.provider);
    const guardAddress: string = await account.guard();
    if (guardAddress === ethers.ZeroAddress) return null;

    const guard = new ethers.Contract(guardAddress, EXTENDED_GUARD_ABI, this.provider);
    try {
      const todaySpent = await guard.tokenTodaySpent(token);
      // TokenConfig is not directly readable on-chain per token; limits are not fully implemented.
      return {
        token,
        todaySpent: BigInt(todaySpent),
        dailyLimit: 0n, // token daily limit not directly exposed
        remaining: 0n,
        currentTier: 1 as TierLevel,
        tier1Limit: 0n,
        tier2Limit: 0n,
      };
    } catch {
      return null;
    }
  }

  /**
   * Determine the minimum tier required to send a given ETH amount.
   * Useful for showing "this transfer needs 2 signatures" before submission.
   */
  async requiredTierForAmount(
    accountAddress: string,
    amountWei: bigint,
  ): Promise<TierLevel> {
    const state = await this.getGuardState(accountAddress);
    if (!state) return 1; // No guard = no tier restriction

    const projectedSpend = state.todaySpent + amountWei;
    return resolveTierFromSpend(projectedSpend, state.tier1Limit, state.tier2Limit);
  }

  /**
   * Check if a given algorithm ID is approved on the guard.
   */
  async isAlgorithmApproved(accountAddress: string, algId: number): Promise<boolean> {
    const account = new ethers.Contract(accountAddress, AIRACCOUNT_ABI, this.provider);
    const guardAddress: string = await account.guard();
    if (guardAddress === ethers.ZeroAddress) return true;

    const guard = new ethers.Contract(guardAddress, EXTENDED_GUARD_ABI, this.provider);
    return guard.approvedAlgorithms(algId) as Promise<boolean>;
  }
}

/**
 * Resolve required tier from cumulative spend vs tier thresholds.
 *
 * tier1Limit=0 means no Tier-1 cap (everything is Tier 1).
 * tier2Limit=0 means no Tier-2 cap (anything above tier1 is Tier 2).
 */
function resolveTierFromSpend(
  spent: bigint,
  tier1Limit: bigint,
  tier2Limit: bigint,
): TierLevel {
  if (tier1Limit === 0n) return 1;
  if (spent < tier1Limit) return 1;
  if (tier2Limit === 0n || spent < tier2Limit) return 2;
  return 3;
}
