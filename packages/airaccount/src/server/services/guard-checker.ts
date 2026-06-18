import { getContract, zeroAddress, type Address } from "viem";
// GLOBAL_GUARD_ABI is a local human-readable signature array (not in @aastar/core);
// parseAbi is required to feed it to viem's getContract during the ethers->viem migration.
// eslint-disable-next-line no-restricted-imports
import { parseAbi } from "viem";
import { EthereumProvider } from "../providers/ethereum-provider";
import { GLOBAL_GUARD_ABI } from "../constants/entrypoint";
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
    const account = this.ethereum.getAccountContract(accountAddress);

    const [tier1Limit, tier2Limit] = await Promise.all([
      account.read.tier1Limit([]),
      account.read.tier2Limit([]),
    ]);

    return {
      tier1Limit: BigInt(tier1Limit as bigint),
      tier2Limit: BigInt(tier2Limit as bigint),
    };
  }

  /**
   * Fetch guard status from the account's GlobalGuard.
   */
  async fetchGuardStatus(accountAddress: string): Promise<GuardStatus> {
    const account = this.ethereum.getAccountContract(accountAddress);

    // getConfigDescription returns a single tuple struct; viem decodes it to an object
    // with named fields (matching ethers' named-field access on the result).
    const config = (await account.read.getConfigDescription([])) as {
      guardAddress: Address;
    };
    const guardAddress = config.guardAddress;

    if (guardAddress === zeroAddress) {
      return {
        hasGuard: false,
        guardAddress: zeroAddress,
        dailyLimit: 0n,
        dailyRemaining: 0n,
      };
    }

    const guard = getContract({
      address: guardAddress,
      abi: parseAbi(GLOBAL_GUARD_ABI),
      client: this.ethereum.getProvider(),
    });
    const [dailyLimit, dailyRemaining] = await Promise.all([
      guard.read.dailyLimit(),
      guard.read.remainingDailyAllowance(),
    ]);

    return {
      hasGuard: true,
      guardAddress,
      dailyLimit: BigInt(dailyLimit as bigint),
      dailyRemaining: BigInt(dailyRemaining as bigint),
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

    // Check algorithm approval. v0.17.2-beta.4: the algorithm whitelist is the single
    // source of truth on the ACCOUNT (enforced in validateUserOp), not the guard.
    const accountContract = this.ethereum.getAccountContract(accountAddress);
    const isApproved = (await accountContract.read.approvedAlgorithms([algId])) as boolean;

    if (!isApproved) {
      errors.push(
        `Algorithm ${ALG_NAMES[algId] ?? `0x${algId.toString(16)}`} is not approved by the account`
      );
    }

    if (errors.length > 0) {
      this.logger.warn(`Pre-check failed for ${accountAddress}: ${errors.join("; ")}`);
    }

    return { ok: errors.length === 0, errors, tier, algId };
  }
}
