import { ethers } from "ethers";
import { EthereumProvider } from "../providers/ethereum-provider";
import { AIRACCOUNT_ABI, GLOBAL_GUARD_ABI } from "../constants/entrypoint";
import {
  TierConfig,
  GuardStatus,
  PreCheckResult,
  ALG_ECDSA,
  ALG_P256,
  ALG_BLS,
  ALG_CUMULATIVE_T2,
  ALG_CUMULATIVE_T3,
} from "../../core/tier";
import { resolveTier, algIdForTier } from "../../core/tier";
import { ILogger, ConsoleLogger } from "../interfaces/logger";

const ALG_NAMES: Record<number, string> = {
  [ALG_BLS]: "BLS (0x01)",
  [ALG_ECDSA]: "ECDSA (0x02)",
  [ALG_P256]: "P256 (0x03)",
  [ALG_CUMULATIVE_T2]: "Cumulative T2 (0x04)",
  [ALG_CUMULATIVE_T3]: "Cumulative T3 (0x05)",
};

/**
 * Pre-checks transactions against GlobalGuard before submitting on-chain.
 * Avoids wasted gas from predictable reverts.
 */
export class GuardChecker {
  private readonly logger: ILogger;

  constructor(
    private readonly ethereum: EthereumProvider,
    logger?: ILogger
  ) {
    this.logger = logger ?? new ConsoleLogger("[GuardChecker]");
  }

  /**
   * Fetch tier limits from an AirAccount contract.
   */
  async fetchTierConfig(accountAddress: string): Promise<TierConfig> {
    const provider = this.ethereum.getProvider();
    const account = new ethers.Contract(accountAddress, AIRACCOUNT_ABI, provider);

    const [tier1Limit, tier2Limit] = await Promise.all([
      account.tier1Limit(),
      account.tier2Limit(),
    ]);

    return {
      tier1Limit: BigInt(tier1Limit),
      tier2Limit: BigInt(tier2Limit),
    };
  }

  /**
   * Fetch guard status from the account's GlobalGuard.
   */
  async fetchGuardStatus(accountAddress: string): Promise<GuardStatus> {
    const provider = this.ethereum.getProvider();
    const account = new ethers.Contract(accountAddress, AIRACCOUNT_ABI, provider);

    const config = await account.getConfigDescription();
    const guardAddress = config.guardAddress;

    if (guardAddress === ethers.ZeroAddress) {
      return {
        hasGuard: false,
        guardAddress: ethers.ZeroAddress,
        dailyLimit: 0n,
        dailyRemaining: 0n,
      };
    }

    const guard = new ethers.Contract(guardAddress, GLOBAL_GUARD_ABI, provider);
    const [dailyLimit, dailyRemaining] = await Promise.all([
      guard.dailyLimit(),
      guard.remainingDailyAllowance(),
    ]);

    return {
      hasGuard: true,
      guardAddress,
      dailyLimit: BigInt(dailyLimit),
      dailyRemaining: BigInt(dailyRemaining),
    };
  }

  /**
   * Pre-check a transaction: determine tier, check guard limits and algorithm approval.
   * Returns errors array (empty = OK to proceed).
   */
  async preCheck(accountAddress: string, value: bigint): Promise<PreCheckResult> {
    const errors: string[] = [];

    // Fetch tier config → resolve tier → get algId
    const tierConfig = await this.fetchTierConfig(accountAddress);
    const tier = resolveTier(value, tierConfig);
    const algId = algIdForTier(tier);

    // Fetch guard status
    const guard = await this.fetchGuardStatus(accountAddress);

    if (!guard.hasGuard) {
      return { ok: true, errors: [], tier, algId };
    }

    // Check daily allowance
    if (guard.dailyLimit > 0n && value > guard.dailyRemaining) {
      errors.push(
        `Daily limit exceeded: requesting ${value} wei but only ${guard.dailyRemaining} remaining (limit: ${guard.dailyLimit})`
      );
    }

    // Check algorithm approval
    const provider = this.ethereum.getProvider();
    const guardContract = new ethers.Contract(guard.guardAddress, GLOBAL_GUARD_ABI, provider);
    const isApproved = await guardContract.approvedAlgorithms(algId);

    if (!isApproved) {
      errors.push(
        `Algorithm ${ALG_NAMES[algId] ?? `0x${algId.toString(16)}`} is not approved by the guard`
      );
    }

    if (errors.length > 0) {
      this.logger.warn(`Pre-check failed for ${accountAddress}: ${errors.join("; ")}`);
    }

    return { ok: errors.length === 0, errors, tier, algId };
  }
}
