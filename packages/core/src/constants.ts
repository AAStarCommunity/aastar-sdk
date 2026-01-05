import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const network = process.env.NETWORK || 'anvil';
let config: any = {};
try {
  config = require(`../../../config.${network}.json`);
} catch (e) {
  console.warn(`Warning: Could not load config.${network}.json. Contract addresses may be undefined.`);
}

/**
 * Contract Addresses (loaded from config.{network}.json)
 */
export const CONTRACT_SRC_HASH = config.srcHash;
export const REGISTRY_ADDRESS = config.registry as `0x${string}`;
export const GTOKEN_ADDRESS = config.gToken as `0x${string}`;
export const GTOKEN_STAKING_ADDRESS = config.staking as `0x${string}`;
export const SBT_ADDRESS = config.sbt as `0x${string}`;
export const REPUTATION_SYSTEM_ADDRESS = config.reputationSystem as `0x${string}`;
export const SUPER_PAYMASTER_ADDRESS = config.superPaymaster as `0x${string}`;
export const PAYMASTER_FACTORY_ADDRESS = config.paymasterFactory as `0x${string}`;
export const PAYMASTER_V4_IMPL_ADDRESS = config.paymasterV4Impl as `0x${string}`;
export const XPNTS_FACTORY_ADDRESS = config.xPNTsFactory as `0x${string}`;
export const BLS_AGGREGATOR_ADDRESS = config.blsAggregator as `0x${string}`;
export const BLS_VALIDATOR_ADDRESS = config.blsValidator as `0x${string}`;
export const DVT_VALIDATOR_ADDRESS = config.dvtValidator as `0x${string}`;
export const ENTRY_POINT_ADDRESS = config.entryPoint as `0x${string}`;
export const ENTRY_POINT_0_8_ADDRESS = config.entryPoint08 as `0x${string}`;
export const ENTRY_POINT_0_9_ADDRESS = config.entryPoint09 as `0x${string}`;
export const APNTS_ADDRESS = config.aPNTs as `0x${string}`;

/**
 * Common Constants
 */

/**
 * Default faucet API URL for testnet token requests
 */
export const FAUCET_API_URL = "https://faucet-aastar.vercel.app";

/**
 * Service fee rate in basis points (200 = 2%)
 */
export const SERVICE_FEE_RATE = 200;

/**
 * Maximum service fee in basis points (1000 = 10%)
 */
export const MAX_SERVICE_FEE = 1000;

/**
 * Basis points denominator (100% = 10000 basis points)
 */
export const BPS_DENOMINATOR = 10000;

/**
 * Default amount of gas tokens to mint for testing (in token units)
 */
export const DEFAULT_GAS_TOKEN_MINT_AMOUNT = "100";

/**
 * Default amount of USDT to mint for testing (in USDT)
 */
export const DEFAULT_USDT_MINT_AMOUNT = "10";

/**
 * Size of test account pool
 */
export const TEST_ACCOUNT_POOL_SIZE = 20;

/**
 * Minimum stake amounts for different node types (in sGT)
 */
export const NODE_STAKE_AMOUNTS = {
  /** Lite Node: 30 sGT minimum stake */
  LITE: 30,
  /** Standard Node: 100 sGT minimum stake */
  STANDARD: 100,
  /** Super Node: 300 sGT minimum stake */
  SUPER: 300,
  /** Enterprise Node: 1000 sGT minimum stake */
  ENTERPRISE: 1000,
} as const;

/**
 * Default aPNTs price in USD (0.02 USD per aPNT)
 */
export const DEFAULT_APNTS_PRICE_USD = "0.02";

/**
 * Network Chain IDs
 */
export const CHAIN_SEPOLIA = 11155111;
export const CHAIN_MAINNET = 1;

/**
 * Default Values
 */
export const DEFAULT_TOKEN_SYMBOL = 'GT';
export const DEFAULT_TOKEN_NAME = 'Governance Token';

/**
 * Gas Limits
 */
export const DEFAULT_VERIFICATION_GAS_LIMIT = 200000n;
export const DEFAULT_CALL_GAS_LIMIT = 100000n;
export const DEFAULT_PRE_VERIFICATION_GAS = 50000n;

/**
 * Timeouts
 */
export const DEFAULT_TIMEOUT_MS = 30000;
