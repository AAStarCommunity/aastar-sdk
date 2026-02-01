import { createRequire } from 'module';
import { CANONICAL_ADDRESSES } from './addresses.js';

const require = createRequire(import.meta.url);

const network = process.env.NETWORK || 'anvil';
let config: any = {};

// 1. Try to load local config (for development/monorepo use)
try {
  config = require(`../../../config.${network}.json`);
} catch (e) {
  // console.warn(`Warning: Could not load config.${network}.json. Falling back to code defaults.`);
}

// 2. Identify Chain ID and resolve canonical defaults
const chainIdStr = process.env.CHAIN_ID || config.chainId;
const chainId = chainIdStr ? Number(chainIdStr) : (network === 'sepolia' ? 11155111 : (network === 'op-sepolia' ? 11155420 : 0));
const defaults = (CANONICAL_ADDRESSES as any)[chainId] || {};

/**
 * Contract Addresses (Priority: ENV > Local Config > Canonical Defaults)
 */
export const CONTRACT_SRC_HASH = process.env.SRC_HASH || config.srcHash || defaults.srcHash;
export const REGISTRY_ADDRESS = (process.env.REGISTRY || config.registry || defaults.registry) as `0x${string}`;
export const GTOKEN_ADDRESS = (process.env.GTOKEN || config.gToken || defaults.gToken) as `0x${string}`;
export const GTOKEN_STAKING_ADDRESS = (process.env.STAKING || config.staking || defaults.staking) as `0x${string}`;
export const SBT_ADDRESS = (process.env.SBT || config.sbt || defaults.sbt) as `0x${string}`;
export const REPUTATION_SYSTEM_ADDRESS = (process.env.REPUTATION_SYSTEM || config.reputationSystem || defaults.reputationSystem) as `0x${string}`;
export const SUPER_PAYMASTER_ADDRESS = (process.env.SUPER_PAYMASTER || config.superPaymaster || defaults.superPaymaster) as `0x${string}`;
export const PAYMASTER_FACTORY_ADDRESS = (process.env.PAYMASTER_FACTORY || config.paymasterFactory || defaults.paymasterFactory) as `0x${string}`;
export const PAYMASTER_V4_IMPL_ADDRESS = (process.env.PAYMASTER_V4_IMPL || config.paymasterV4Impl || defaults.paymasterV4Impl) as `0x${string}`;
export const XPNTS_FACTORY_ADDRESS = (process.env.XPNTS_FACTORY || config.xPNTsFactory || defaults.xPNTsFactory) as `0x${string}`;
export const BLS_AGGREGATOR_ADDRESS = (process.env.BLS_AGGREGATOR || config.blsAggregator || defaults.blsAggregator) as `0x${string}`;
export const BLS_VALIDATOR_ADDRESS = (process.env.BLS_VALIDATOR || config.blsValidator || defaults.blsValidator) as `0x${string}`;
export const DVT_VALIDATOR_ADDRESS = (process.env.DVT_VALIDATOR || config.dvtValidator || defaults.dvtValidator) as `0x${string}`;
export const ENTRY_POINT_ADDRESS = (process.env.ENTRY_POINT || config.entryPoint || defaults.entryPoint) as `0x${string}`;
export const APNTS_ADDRESS = (process.env.APNTS || config.aPNTs || defaults.aPNTs) as `0x${string}`;

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
