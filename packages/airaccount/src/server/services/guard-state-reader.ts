import { getContract, zeroAddress, type Address, type PublicClient } from "viem";
// EntryPoint/AirAccount/Guard ABIs are local human-readable signatures (not in @aastar/core);
// parseAbi is required to feed them to viem's getContract during the ethers->viem migration.
// eslint-disable-next-line no-restricted-imports
import { parseAbi } from "viem";
import { AIRACCOUNT_ABI, GLOBAL_GUARD_ABI } from "../constants/entrypoint";

const EXTENDED_GUARD_ABI = [
  ...GLOBAL_GUARD_ABI,
  "function todaySpent() external view returns (uint256)",
  "function tokenTodaySpent(address token) external view returns (uint256)",
  // Per-token limits ARE readable on-chain: the public `tokenConfigs` mapping getter returns the
  // per-token tier thresholds + daily limit (AAStarGlobalGuard). (#176 ERC20 per-token gap.)
  "function tokenConfigs(address token) external view returns (uint128 tier1Limit, uint128 tier2Limit, uint256 dailyLimit)",
  // approvedAlgorithms removed from the guard in v0.17.2-beta.4 — now read from the account.
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

/** Loosely-typed read surface for viem contracts built from human-readable ABIs. */
type ReadMethods = Record<string, (args?: unknown[]) => Promise<unknown>>;

/**
 * GuardStateReader — F6: read AAStarGlobalGuard spending state.
 *
 * Enables UI components to show:
 *   - Daily spend progress bar
 *   - Current required tier (T1/T2/T3) for next transaction
 *   - Per-token limits and remaining allowances
 */
export class GuardStateReader {
  private readonly provider: PublicClient;

  constructor(provider: PublicClient) {
    this.provider = provider;
  }

  private accountContract(accountAddress: string) {
    return getContract({
      address: accountAddress as Address,
      abi: parseAbi(AIRACCOUNT_ABI as readonly string[]),
      client: this.provider,
    });
  }

  private guardContract(guardAddress: string) {
    return getContract({
      address: guardAddress as Address,
      abi: parseAbi(EXTENDED_GUARD_ABI as readonly string[]),
      client: this.provider,
    });
  }

  /**
   * Read the full ETH guard state for an account.
   * Returns null if the account has no guard (dailyLimit=0).
   */
  async getGuardState(accountAddress: string): Promise<GuardState | null> {
    const account = this.accountContract(accountAddress).read as ReadMethods;
    const guardAddress = (await account.guard([])) as string;
    if (guardAddress === zeroAddress) return null;

    const guard = this.guardContract(guardAddress).read as ReadMethods;
    const [dailyLimit, remaining, todaySpent, tier1Limit, tier2Limit, minDailyLimit] =
      await Promise.all([
        guard.dailyLimit([]),
        guard.remainingDailyAllowance([]),
        guard.todaySpent([]),
        guard.tier1Limit([]).catch(() => 0n),
        guard.tier2Limit([]).catch(() => 0n),
        guard.minDailyLimit([]).catch(() => 0n),
      ]);

    return {
      dailyLimit: BigInt(dailyLimit as bigint),
      todaySpent: BigInt(todaySpent as bigint),
      remaining: BigInt(remaining as bigint),
      currentTier: resolveTierFromSpend(
        BigInt(todaySpent as bigint),
        BigInt(tier1Limit as bigint),
        BigInt(tier2Limit as bigint),
      ),
      tier1Limit: BigInt(tier1Limit as bigint),
      tier2Limit: BigInt(tier2Limit as bigint),
      minDailyLimit: BigInt(minDailyLimit as bigint),
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
    const account = this.accountContract(accountAddress).read as ReadMethods;
    const guardAddress = (await account.guard([])) as string;
    if (guardAddress === zeroAddress) return null;

    const guard = this.guardContract(guardAddress).read as ReadMethods;
    try {
      // Read the per-token config (tier1Limit, tier2Limit, dailyLimit) + today's spend. viem returns
      // the multi-value `tokenConfigs` getter as a positional tuple.
      const [config, todaySpentRaw] = await Promise.all([
        guard.tokenConfigs([token as Address]) as Promise<readonly [bigint, bigint, bigint]>,
        guard.tokenTodaySpent([token as Address]),
      ]);
      const [tier1Limit, tier2Limit, dailyLimit] = [BigInt(config[0]), BigInt(config[1]), BigInt(config[2])];

      // All-zero config = this token is not configured on the guard.
      if (tier1Limit === 0n && tier2Limit === 0n && dailyLimit === 0n) return null;

      const todaySpent = BigInt(todaySpentRaw as bigint);
      const remaining = dailyLimit > todaySpent ? dailyLimit - todaySpent : 0n;
      return {
        token,
        todaySpent,
        dailyLimit,
        remaining,
        currentTier: resolveTierFromSpend(todaySpent, tier1Limit, tier2Limit),
        tier1Limit,
        tier2Limit,
      };
    } catch {
      return null;
    }
  }

  /**
   * Determine the minimum tier required to send `amount` of an ERC20 token — the per-token analogue
   * of {@link requiredTierForAmount}. Uses the token's own `tokenConfigs` thresholds (#176 ERC20 gap).
   * Returns 1 (no restriction) if the token is unconfigured or the account has no guard.
   */
  async requiredTierForToken(
    accountAddress: string,
    token: string,
    amount: bigint,
  ): Promise<TierLevel> {
    const state = await this.getTokenGuardState(accountAddress, token);
    if (!state) return 1;
    return resolveTierFromSpend(state.todaySpent + amount, state.tier1Limit, state.tier2Limit);
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
    // v0.17.2-beta.4: the algorithm whitelist lives on the ACCOUNT (single source of
    // truth, enforced in validateUserOp), not the guard.
    const account = this.accountContract(accountAddress).read as ReadMethods;
    // approvedAlgorithms(uint8 algId): viem requires uint args as bigint.
    return (await account.approvedAlgorithms([BigInt(algId)])) as boolean;
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

/** Which signature factors a given tier requires (#176): T1 = passkey; T2 += BLS; T3 += guardian ECDSA. */
export interface TierSignatureNeeds {
  passkey: boolean;
  bls: boolean;
  guardian: boolean;
}

/**
 * Map a resolved tier to the signature factors it needs. This is the fixed on-chain convention
 * (AAStarAirAccountV7.validateUserOp): Tier-1 = passkey only, Tier-2 adds the BLS factor, Tier-3
 * additionally requires guardian ECDSA co-signing. Consumers use this to know, before submitting,
 * whether a Tier-3 transfer still needs guardian signatures collected (#176 fail-fast).
 */
export function tierSignatureRequirements(tier: TierLevel): TierSignatureNeeds {
  return {
    passkey: true,
    bls: tier >= 2,
    guardian: tier >= 3,
  };
}
