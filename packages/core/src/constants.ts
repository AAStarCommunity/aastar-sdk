import { CANONICAL_ADDRESSES } from './addresses.js';

const network = process.env.NETWORK || 'anvil';
let internalConfig: any = {};

// 2. Identify Chain ID and resolve canonical defaults
// Use a function or getter to ensure it updates if config updates? 
// For simplicity, we initialize once, and update in applyConfig.
let chainIdStr = process.env.CHAIN_ID || internalConfig.chainId;
let chainId = chainIdStr ? Number(chainIdStr) : (network === 'sepolia' ? 11155111 : (network === 'op-sepolia' ? 11155420 : 0));
let defaults = (CANONICAL_ADDRESSES as any)[chainId] || {};

/**
 * Helper to resolve address
 */
function resolveAddr(envKey: string, configKey: string): `0x${string}` {
    return (process.env[envKey] || internalConfig[configKey] || defaults[configKey]) as `0x${string}`;
}

function resolveVal(envKey: string, configKey: string) {
    return process.env[envKey] || internalConfig[configKey] || defaults[configKey];
}

/**
 * Contract Addresses (Priority: ENV > Local Config > Canonical Defaults)
 */
export let CONTRACT_SRC_HASH = resolveVal('SRC_HASH', 'srcHash');
export let REGISTRY_ADDRESS = resolveAddr('REGISTRY', 'registry');
export let GTOKEN_ADDRESS = resolveAddr('GTOKEN', 'gToken');
export let GTOKEN_STAKING_ADDRESS = resolveAddr('STAKING', 'staking');
export let SBT_ADDRESS = resolveAddr('SBT', 'sbt');
export let REPUTATION_SYSTEM_ADDRESS = resolveAddr('REPUTATION_SYSTEM', 'reputationSystem');
export let SUPER_PAYMASTER_ADDRESS = resolveAddr('SUPER_PAYMASTER', 'superPaymaster');
export let PAYMASTER_FACTORY_ADDRESS = resolveAddr('PAYMASTER_FACTORY', 'paymasterFactory');
export let PAYMASTER_V4_IMPL_ADDRESS = resolveAddr('PAYMASTER_V4_IMPL', 'paymasterV4Impl');
export let XPNTS_FACTORY_ADDRESS = resolveAddr('XPNTS_FACTORY', 'xPNTsFactory');
export let BLS_AGGREGATOR_ADDRESS = resolveAddr('BLS_AGGREGATOR', 'blsAggregator');
export let BLS_VALIDATOR_ADDRESS = resolveAddr('BLS_VALIDATOR', 'blsValidator');
export let DVT_VALIDATOR_ADDRESS = resolveAddr('DVT_VALIDATOR', 'dvtValidator');
export let ENTRY_POINT_ADDRESS = resolveAddr('ENTRY_POINT', 'entryPoint');
export let APNTS_ADDRESS = resolveAddr('APNTS', 'aPNTs');

/**
 * Apply external configuration (for Node.js environment)
 */
export function applyConfig(newConfig: any) {
    internalConfig = newConfig;
    
    // Re-calculate derived values
    chainIdStr = process.env.CHAIN_ID || internalConfig.chainId;
    chainId = chainIdStr ? Number(chainIdStr) : (network === 'sepolia' ? 11155111 : (network === 'op-sepolia' ? 11155420 : 0));
    defaults = (CANONICAL_ADDRESSES as any)[chainId] || {};

    // Re-assign exports
    CONTRACT_SRC_HASH = resolveVal('SRC_HASH', 'srcHash');
    REGISTRY_ADDRESS = resolveAddr('REGISTRY', 'registry');
    GTOKEN_ADDRESS = resolveAddr('GTOKEN', 'gToken');
    GTOKEN_STAKING_ADDRESS = resolveAddr('STAKING', 'staking');
    SBT_ADDRESS = resolveAddr('SBT', 'sbt');
    REPUTATION_SYSTEM_ADDRESS = resolveAddr('REPUTATION_SYSTEM', 'reputationSystem');
    SUPER_PAYMASTER_ADDRESS = resolveAddr('SUPER_PAYMASTER', 'superPaymaster');
    PAYMASTER_FACTORY_ADDRESS = resolveAddr('PAYMASTER_FACTORY', 'paymasterFactory');
    PAYMASTER_V4_IMPL_ADDRESS = resolveAddr('PAYMASTER_V4_IMPL', 'paymasterV4Impl');
    XPNTS_FACTORY_ADDRESS = resolveAddr('XPNTS_FACTORY', 'xPNTsFactory');
    BLS_AGGREGATOR_ADDRESS = resolveAddr('BLS_AGGREGATOR', 'blsAggregator');
    BLS_VALIDATOR_ADDRESS = resolveAddr('BLS_VALIDATOR', 'blsValidator');
    DVT_VALIDATOR_ADDRESS = resolveAddr('DVT_VALIDATOR', 'dvtValidator');
    ENTRY_POINT_ADDRESS = resolveAddr('ENTRY_POINT', 'entryPoint');
    APNTS_ADDRESS = resolveAddr('APNTS', 'aPNTs');
}

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
