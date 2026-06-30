// eslint-disable-next-line no-restricted-imports -- AIRACCOUNT_FACTORY_ABI is a local human-readable string[] (not in @aastar/core); parseAbi is required to feed it to viem readContract.
import { parseAbi, type PublicClient } from "viem";
import { keccak256 } from "../../migration/viem/hashing";
import { solidityPacked } from "../../migration/viem/abi-encoding";
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

// Parse the local human-readable factory ABI once so viem reads can consume it.
const FACTORY_ABI = parseAbi(AIRACCOUNT_FACTORY_ABI);
// v0.22.0 getAddress/getAddressWithChainId are 5-arg; OAPD accounts carry no birth-injected passkey.
const OAPD_ZERO_BYTES32 = `0x${"00".repeat(32)}` as `0x${string}`;

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
    // v0.20.0 (#120): P-256 guardian keys (bytes32[3] each), inserted after `guardians`.
    // ECDSA-only OAPD accounts pass three zero words for each.
    guardianP256X: [string, string, string];
    guardianP256Y: [string, string, string];
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
  const packed = solidityPacked(["address", "string"], [owner, dappId]);
  return BigInt(keccak256(packed));
}

/**
 * Predict the counterfactual OAPD address without deploying.
 * Uses the factory's getAddress() view function.
 */
export async function getOapdAddress(
  provider: PublicClient,
  config: OapdConfig,
): Promise<string> {
  const factoryAddress = config.factoryAddress ?? AIRACCOUNT_ADDRESSES.sepolia.factory;
  const salt = computeOapdSalt(config.owner, config.dappId);

  return provider.readContract({
    address: factoryAddress as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: "getAddress",
    args: [config.owner as `0x${string}`, salt, config.initConfig, OAPD_ZERO_BYTES32, OAPD_ZERO_BYTES32],
  }) as Promise<string>;
}

/**
 * Get the OAPD address and its ERC-7828 chain-qualified identifier.
 */
export async function getOapdAddressWithChainId(
  provider: PublicClient,
  config: OapdConfig,
): Promise<{ address: string; chainQualified: string }> {
  const factoryAddress = config.factoryAddress ?? AIRACCOUNT_ADDRESSES.sepolia.factory;
  const salt = computeOapdSalt(config.owner, config.dappId);

  const result = (await provider.readContract({
    address: factoryAddress as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: "getAddressWithChainId",
    args: [config.owner as `0x${string}`, salt, config.initConfig, OAPD_ZERO_BYTES32, OAPD_ZERO_BYTES32],
  })) as readonly [string, string];
  return { address: result[0], chainQualified: result[1] };
}

/**
 * Check if an OAPD account has been deployed yet.
 */
export async function isOapdDeployed(
  provider: PublicClient,
  config: OapdConfig,
): Promise<boolean> {
  const address = await getOapdAddress(provider, config);
  // viem getCode returns the deployed bytecode, or `undefined` when the
  // address has no code (the ethers equivalent returned "0x").
  const code = await provider.getCode({ address: address as `0x${string}` });
  return code !== undefined && code !== "0x";
}
