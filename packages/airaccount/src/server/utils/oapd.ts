import { ethers } from "ethers";
import { AIRACCOUNT_ADDRESSES, AIRACCOUNT_FACTORY_ABI } from "../constants/entrypoint";

/**
 * OAPD — One Account Per DApp address derivation (F7).
 *
 * Each DApp gets a unique counterfactual AirAccount address derived from:
 *   salt = keccak256(owner ‖ dappId)
 *
 * This prevents DApps from correlating user activity across sites while
 * sharing the same underlying owner key and guardians.
 *
 * The OAPD address is a standard AirAccount clone — it has its own guard,
 * its own daily limits, and can be funded independently.
 */

export interface OapdConfig {
  /** Account owner address */
  owner: string;
  /** DApp identifier — use the DApp's domain or contract address */
  dappId: string;
  /** Factory address (defaults to M7 Sepolia) */
  factoryAddress?: string;
  /**
   * InitConfig for the OAPD account.
   * Typically lower daily limits than the main account.
   */
  initConfig: {
    guardians: [string, string, string];
    dailyLimit: bigint;
    approvedAlgIds: number[];
    minDailyLimit: bigint;
    initialTokens: string[];
    initialTokenConfigs: Array<{
      tier1Limit: bigint;
      tier2Limit: bigint;
      dailyLimit: bigint;
    }>;
  };
}

/**
 * Compute the numeric salt for an OAPD address.
 * salt = uint256(keccak256(abi.encodePacked(owner, dappId)))
 */
export function computeOapdSalt(owner: string, dappId: string): bigint {
  const packed = ethers.solidityPacked(["address", "string"], [owner, dappId]);
  return BigInt(ethers.keccak256(packed));
}

/**
 * Predict the counterfactual OAPD address without deploying.
 * Uses the factory's getAddress() view function.
 */
export async function getOapdAddress(
  provider: ethers.JsonRpcProvider,
  config: OapdConfig,
): Promise<string> {
  const factoryAddress = config.factoryAddress ?? AIRACCOUNT_ADDRESSES.sepolia.factory;
  const factory = new ethers.Contract(factoryAddress, AIRACCOUNT_FACTORY_ABI, provider);
  const salt = computeOapdSalt(config.owner, config.dappId);

  return factory.getFunction("getAddress")(config.owner, salt, config.initConfig) as Promise<string>;
}

/**
 * Get the OAPD address and its ERC-7828 chain-qualified identifier.
 */
export async function getOapdAddressWithChainId(
  provider: ethers.JsonRpcProvider,
  config: OapdConfig,
): Promise<{ address: string; chainQualified: string }> {
  const factoryAddress = config.factoryAddress ?? AIRACCOUNT_ADDRESSES.sepolia.factory;
  const factory = new ethers.Contract(factoryAddress, AIRACCOUNT_FACTORY_ABI, provider);
  const salt = computeOapdSalt(config.owner, config.dappId);

  const result = await factory.getFunction("getAddressWithChainId")(
    config.owner,
    salt,
    config.initConfig,
  );
  return { address: result[0] as string, chainQualified: result[1] as string };
}

/**
 * Check if an OAPD account has been deployed yet.
 */
export async function isOapdDeployed(
  provider: ethers.JsonRpcProvider,
  config: OapdConfig,
): Promise<boolean> {
  const address = await getOapdAddress(provider, config);
  const code = await provider.getCode(address);
  return code !== "0x";
}
