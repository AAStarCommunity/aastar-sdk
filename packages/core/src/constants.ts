import { CANONICAL_ADDRESSES } from './addresses.js';

// Browser-safe network detection
const network = (typeof process !== 'undefined' && process.env && process.env.NETWORK) || 'anvil';
let internalConfig: any = {};

// 2. Identify Chain ID and resolve canonical defaults
let chainIdStr = (typeof process !== 'undefined' && process.env && process.env.CHAIN_ID) || internalConfig.chainId;
let chainId = chainIdStr ? Number(chainIdStr) : (network === 'optimism' ? 10 : (network === 'mainnet' ? 1 : (network === 'sepolia' ? 11155111 : (network === 'op-sepolia' ? 11155420 : 0))));
let defaults = (CANONICAL_ADDRESSES as any)[chainId] || {};

/**
 * Helper to resolve address
 */
function resolveAddr(envKey: string, configKey: string): `0x${string}` {
    const envVal = (typeof process !== 'undefined' && process.env) ? process.env[envKey] : undefined;
    return (envVal || internalConfig[configKey] || defaults[configKey]) as `0x${string}`;
}

function resolveVal(envKey: string, configKey: string) {
    const envVal = (typeof process !== 'undefined' && process.env) ? process.env[envKey] : undefined;
    return envVal || internalConfig[configKey] || defaults[configKey];
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
export let PAYMASTER_V4_ADDRESS = resolveAddr('PAYMASTER_V4', 'paymasterV4');
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
    const envChainId = (typeof process !== 'undefined' && process.env) ? process.env.CHAIN_ID : undefined;
    chainIdStr = envChainId || internalConfig.chainId;
    chainId = chainIdStr ? Number(chainIdStr) : (network === 'optimism' ? 10 : (network === 'mainnet' ? 1 : (network === 'sepolia' ? 11155111 : (network === 'op-sepolia' ? 11155420 : 0))));
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
    PAYMASTER_V4_ADDRESS = resolveAddr('PAYMASTER_V4', 'paymasterV4');
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
export const FAUCET_API_URL = "https://faucet-aastar.vercel.app";
export const SERVICE_FEE_RATE = 200;
export const MAX_SERVICE_FEE = 1000;
export const BPS_DENOMINATOR = 10000;
export const DEFAULT_GAS_TOKEN_MINT_AMOUNT = "100";
export const DEFAULT_USDT_MINT_AMOUNT = "10";
export const TEST_ACCOUNT_POOL_SIZE = 20;

export const NODE_STAKE_AMOUNTS = {
  LITE: 30,
  STANDARD: 100,
  SUPER: 300,
  ENTERPRISE: 1000,
} as const;

export const DEFAULT_APNTS_PRICE_USD = "0.02";
export const CHAIN_SEPOLIA = 11155111;
export const CHAIN_MAINNET = 1;
export const DEFAULT_TOKEN_SYMBOL = 'GT';
export const DEFAULT_TOKEN_NAME = 'Governance Token';
export const DEFAULT_VERIFICATION_GAS_LIMIT = 200000n;
export const DEFAULT_CALL_GAS_LIMIT = 100000n;
export const DEFAULT_PRE_VERIFICATION_GAS = 50000n;
export const DEFAULT_TIMEOUT_MS = 30000;
