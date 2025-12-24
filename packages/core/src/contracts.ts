/**
 * AAstar Smart Contract Addresses
 *
 * IMPORTANT: Contract addresses are defined in contract-addresses.ts
 * This file imports and uses those addresses to maintain a single source of truth.
 *
 * For detailed version information (VERSION, VERSION_CODE, features),
 * see contract-versions.ts
 */

import {
  CORE_ADDRESSES,
  TOKEN_ADDRESSES,
  TEST_TOKEN_ADDRESSES,
  TEST_ACCOUNT_ADDRESSES,
  PAYMASTER_ADDRESSES,
  MONITORING_ADDRESSES,
  OFFICIAL_ADDRESSES,
  COMMUNITY_OWNERS,
} from './contract-addresses';

/**
 * Contract category types
 */
export type ContractCategory =
  | 'core'          // SuperPaymaster V2, Registry, GToken, GTokenStaking, PaymasterFactory
  | 'tokens'        // xPNTsFactory, MySBT
  | 'testTokens'    // Mock tokens for testing (USDT, aPNTs, bPNTs)
  | 'testAccounts'  // Test accounts for development (SimpleAccountFactory)
  | 'paymaster'     // PaymasterV4_1 (AOA mode)
  | 'monitoring'    // DVT, BLS
  | 'official'      // EntryPoint
  | 'communities';  // Registered communities (AAStar, BuilderDAO)

/**
 * Sepolia Testnet Contracts
 */
export const SEPOLIA_CONTRACTS = {
  // ========================================
  // Core System (AOA+ Mode)
  // ========================================
  core: CORE_ADDRESSES,

  // ========================================
  // Token System
  // ========================================
  tokens: TOKEN_ADDRESSES,

  // ========================================
  // Test Tokens (For Development & Testing)
  // ========================================
  testTokens: TEST_TOKEN_ADDRESSES,

  // ========================================
  // Test Accounts (For Development & Testing)
  // ========================================
  testAccounts: TEST_ACCOUNT_ADDRESSES,

  // ========================================
  // Paymaster V4_1 (AOA Mode - Independent Paymaster)
  // ========================================
  paymaster: PAYMASTER_ADDRESSES,

  // ========================================
  // DVT/BLS Monitoring System
  // ========================================
  monitoring: MONITORING_ADDRESSES,

  // ========================================
  // Official Dependencies
  // ========================================
  official: OFFICIAL_ADDRESSES,

  // ========================================
  // Test Communities (For Development & Testing)
  // ========================================
  communities: {
    /** AAStar Community - Test community for development (registered: 2025-11-01) */
    aastar: {
      owner: COMMUNITY_OWNERS.aastarOwner,
      gasToken: TEST_TOKEN_ADDRESSES.aPNTs,
      ensName: 'aastar.eth',
      name: 'AAStar',
      stake: '50', // 50 GToken staked in Registry
    },

    /** BreadCommunity - Test community for development (registered: 2025-11-03) */
    breadCommunity: {
      owner: COMMUNITY_OWNERS.breadCommunityOwner,
      gasToken: TEST_TOKEN_ADDRESSES.bPNTs,
      ensName: 'bread.eth',
      name: 'BreadCommunity',
      stake: '50', // 50 GToken staked in Registry
    },
  },
} as const;

/**
 * All supported networks
 */
export const CONTRACTS = {
  sepolia: SEPOLIA_CONTRACTS,
  // Future networks can be added here:
  // optimism: OPTIMISM_CONTRACTS,
  // mainnet: MAINNET_CONTRACTS,
} as const;

/**
 * Supported network types for contracts
 */
export type ContractNetwork = keyof typeof CONTRACTS;

/**
 * Contract addresses for a specific network
 */
export type NetworkContracts = typeof SEPOLIA_CONTRACTS;

/**
 * Get all contracts for a specific network
 *
 * @param network - Network name (e.g., 'sepolia')
 * @returns All contract addresses for the network
 *
 * @example
 * ```ts
 * const contracts = getContracts('sepolia');
 * console.log(contracts.core.superPaymasterV2);
 * ```
 */
export function getContracts(network: ContractNetwork): NetworkContracts {
  const contracts = CONTRACTS[network];
  if (!contracts) {
    throw new Error(`Network '${network}' is not supported`);
  }
  return contracts;
}

/**
 * Get a specific contract address
 *
 * @param network - Network name
 * @param category - Contract category
 * @param name - Contract name
 * @returns Contract address
 *
 * @example
 * ```ts
 * const address = getContract('sepolia', 'core', 'superPaymasterV2');
 * ```
 */
export function getContract(
  network: ContractNetwork,
  category: ContractCategory,
  name: string
): string {
  const contracts = getContracts(network);
  const categoryContracts = contracts[category] as Record<string, string>;

  if (!categoryContracts) {
    throw new Error(`Category '${category}' not found in network '${network}'`);
  }

  const address = categoryContracts[name];
  if (!address) {
    throw new Error(`Contract '${name}' not found in category '${category}' for network '${network}'`);
  }

  return address;
}

/**
 * Get core system contracts
 *
 * @param network - Network name
 * @returns Core contract addresses
 *
 * @example
 * ```ts
 * const core = getCoreContracts('sepolia');
 * console.log(core.superPaymasterV2);
 * console.log(core.registry);
 * ```
 */
export function getCoreContracts(network: ContractNetwork) {
  return getContracts(network).core;
}

/**
 * Get token system contracts
 *
 * @param network - Network name
 * @returns Token contract addresses
 *
 * @example
 * ```ts
 * const tokens = getTokenContracts('sepolia');
 * console.log(tokens.xPNTsFactory);
 * console.log(tokens.mySBT);
 * ```
 */
export function getTokenContracts(network: ContractNetwork) {
  return getContracts(network).tokens;
}

/**
 * Get test token contracts (for development & testing)
 *
 * @param network - Network name
 * @returns Test token contract addresses
 *
 * @example
 * ```ts
 * const testTokens = getTestTokenContracts('sepolia');
 * console.log(testTokens.mockUSDT);
 * ```
 */
export function getTestTokenContracts(network: ContractNetwork) {
  return getContracts(network).testTokens;
}

/**
 * Get PaymasterV4_1 address (AOA mode)
 *
 * @param network - Network name
 * @returns PaymasterV4_1 address
 *
 * @example
 * ```ts
 * const paymaster = getPaymasterV4_1('sepolia');
 * ```
 */
export function getPaymasterV4_1(network: ContractNetwork): string {
  return getContracts(network).paymaster.paymasterV4_1;
}

/**
 * Get test account contracts (SimpleAccountFactory, etc.)
 *
 * @param network - Network name
 * @returns Test account contract addresses
 *
 * @example
 * ```ts
 * const testAccounts = getTestAccounts('sepolia');
 * console.log(testAccounts.simpleAccountFactory);
 * ```
 */
export function getTestAccounts(network: ContractNetwork) {
  return getContracts(network).testAccounts;
}

/**
 * Get SimpleAccountFactory address
 *
 * @param network - Network name
 * @returns SimpleAccountFactory address
 *
 * @example
 * ```ts
 * const factory = getSimpleAccountFactory('sepolia');
 * ```
 */
export function getSimpleAccountFactory(network: ContractNetwork): string {
  return getContracts(network).testAccounts.simpleAccountFactory;
}

/**
 * Get SuperPaymaster V2 address (AOA+ mode)
 *
 * @param network - Network name
 * @returns SuperPaymaster V2 address
 *
 * @example
 * ```ts
 * const superPaymaster = getSuperPaymasterV2('sepolia');
 * ```
 */
export function getSuperPaymasterV2(network: ContractNetwork): string {
  return getContracts(network).core.superPaymasterV2;
}

/**
 * Get EntryPoint v0.7 address
 *
 * @param network - Network name
 * @returns EntryPoint address
 *
 * @example
 * ```ts
 * const entryPoint = getEntryPoint('sepolia');
 * ```
 */
export function getEntryPoint(network: ContractNetwork): string {
  return getContracts(network).official.entryPoint;
}

/**
 * Check if a network is supported for contracts
 *
 * @param network - Network name to check
 * @returns True if network is supported
 *
 * @example
 * ```ts
 * if (isContractNetworkSupported('sepolia')) {
 *   const contracts = getContracts('sepolia');
 * }
 * ```
 */
export function isContractNetworkSupported(network: string): network is ContractNetwork {
  return network in CONTRACTS;
}

/**
 * Get all supported contract network names
 *
 * @returns Array of supported network names
 *
 * @example
 * ```ts
 * const networks = getContractNetworks();
 * // ['sepolia']
 * ```
 */
export function getContractNetworks(): ContractNetwork[] {
  return Object.keys(CONTRACTS) as ContractNetwork[];
}

/**
 * Contract deployment metadata
 */
export const CONTRACT_METADATA = {
  sepolia: {
    lastUpdated: '2025-11-02',
    networkId: 11155111,
    deploymentDates: {
      // Core System
      gToken: '2025-11-01',            // v2.0.0 with VERSION interface
      superPaymasterV2: '2025-11-01',  // v2.0.0 with VERSION interface
      registry: '2025-11-02',          // v2.1.4 with allowPermissionlessMint default true
      gTokenStaking: '2025-11-01',     // v2.0.0 with VERSION interface

      // Tokens
      xPNTsFactory: '2025-11-01',      // v2.0.0 with VERSION interface
      mySBT: '2025-11-01',             // v2.4.0 with VERSION interface + NFT refactor

      // Paymaster
      paymasterV4_1: '2025-10-15',

      // Tokens
      aPNTs: '2025-10-30',

      // Factories
      paymasterFactory: '2025-11-01',      // v1.0.0

      // Monitoring
      dvtValidator: '2025-11-01',      // v2.0.0 with VERSION interface
      blsAggregator: '2025-11-01',     // v2.0.0 with VERSION interface
    },
  },
} as const;

/**
 * Get contract deployment date
 *
 * @param network - Network name
 * @param contractName - Contract name
 * @returns Deployment date string (YYYY-MM-DD)
 *
 * @example
 * ```ts
 * const date = getDeploymentDate('sepolia', 'superPaymasterV2');
 * // '2025-10-25'
 * ```
 */
export function getDeploymentDate(network: ContractNetwork, contractName: string): string | undefined {
  const metadata = CONTRACT_METADATA[network];
  if (!metadata) return undefined;

  return (metadata.deploymentDates as Record<string, string>)[contractName];
}

/**
 * Get registered communities
 *
 * @param network - Network name
 * @returns Communities object
 *
 * @example
 * ```ts
 * const communities = getCommunities('sepolia');
 * console.log(communities.aastar.owner);
 * ```
 */
export function getCommunities(network: ContractNetwork) {
  return getContracts(network).communities;
}

/**
 * Get a specific community
 *
 * @param network - Network name
 * @param communityName - Community name (aastar, builderDao)
 * @returns Community information
 *
 * @example
 * ```ts
 * const aastar = getCommunity('sepolia', 'aastar');
 * console.log(aastar.gasToken); // aPNTs address
 * ```
 */
export function getCommunity(network: ContractNetwork, communityName: 'aastar' | 'breadCommunity') {
  return getCommunities(network)[communityName];
}
