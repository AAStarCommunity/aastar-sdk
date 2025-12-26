/**
 * AAstar V2 Contract Versions
 *
 * IMPORTANT: Contract addresses are defined in contract-addresses.ts
 * This file imports and uses those addresses to maintain a single source of truth.
 *
 * All V2 contracts implement the VERSION interface:
 * - VERSION: string (e.g., "2.0.0")
 * - VERSION_CODE: uint256 (e.g., 20000)
 *
 * Last Updated: 2025-11-01
 */

import {
  CORE_ADDRESSES,
  TOKEN_ADDRESSES,
  TEST_TOKEN_ADDRESSES,
  MONITORING_ADDRESSES,
} from './contract-addresses';

/**
 * Contract version information
 */
export interface ContractVersion {
  /** Contract name */
  name: string;
  /** Semantic version string (e.g., "2.0.0") */
  version: string;
  /** Numeric version code (e.g., 20000) */
  versionCode: number;
  /** Deployment date (YYYY-MM-DD) */
  deployedAt: string;
  /** Contract address on network */
  address: string;
  /** Key features in this version */
  features?: string[];
}

/**
 * V2 Contract Versions on Sepolia
 */
export const SEPOLIA_V2_VERSIONS = {
  // ========================================
  // Core System
  // ========================================
  core: {
    gToken: {
      name: 'GToken',
      version: '2.0.0',
      versionCode: 20000,
      deployedAt: '2025-11-01',
      address: CORE_ADDRESSES.gToken,
      features: [
        'VERSION interface',
        'ERC20 governance token',
        'Mintable with cap',
        'Ownable',
      ],
    } as ContractVersion,

    superPaymaster: {
      name: 'SuperPaymasterV2',
      version: '2.3.3',
      versionCode: 20303,
      deployedAt: '2024-11-24',
      address: CORE_ADDRESSES.superPaymaster,
      features: [
        'VERSION interface',
        'Unified architecture',
        'xPNTs gas token support',
        'Reputation-based pricing',
        'Multi-operator support',
        'registerOperatorWithAutoStake (1-step registration)',
        'CEI pattern fix - state changes before external calls',
        'nonReentrant protection added',
        'Price cache auto-update fix (was broken in v2.3.1)',
        'Storage packing optimization (~800 gas saved)',
        'Batch state updates (~200-400 gas saved)',
        'Total gas optimization: ~5.5-11.2k gas vs v2.3.1',
        'Internal SBT registry - no external balanceOf() calls (~800 gas saved per tx)',
        'MySBT callback pattern: registerSBTHolder() on mint, removeSBTHolder() on burn',
      ],
    } as ContractVersion,

    registry: {
      name: 'Registry',
      version: '2.2.1',
      versionCode: 20201,
      deployedAt: '2025-11-09',
      address: CORE_ADDRESSES.registry,
      features: [
        'VERSION interface',
        'allowPermissionlessMint defaults to true',
        'transferCommunityOwnership',
        'Community registration',
        'GToken staking requirement',
        'Slash mechanism',
        'Uses new GTokenStaking with GToken v2.0.0',
        'isRegistered mapping (duplicate prevention)',
      ],
    } as ContractVersion,

    gTokenStaking: {
      name: 'GTokenStaking',
      version: '2.0.1',
      versionCode: 20001,
      deployedAt: '2025-11-05',
      address: CORE_ADDRESSES.gTokenStaking,
      features: [
        'VERSION interface',
        'User-level slash tracking',
        '1:1 shares model',
        'Lock mechanism',
        'Percentage-based exit fee',
        'Multiple locker support',
        'Uses new GToken v2.0.0',
        'stakeFor() function - stake on behalf of users',
      ],
    } as ContractVersion,

    paymasterFactory: {
      name: 'PaymasterFactory',
      version: '1.0.0',
      versionCode: 10000,
      deployedAt: '2025-11-01',
      address: CORE_ADDRESSES.paymasterFactory,
      features: [
        'EIP-1167 Minimal Proxy',
        'Version management',
        'Permissionless Paymaster deployment',
        'Operator tracking',
        'Gas-efficient (~100k gas per deployment)',
      ],
    } as ContractVersion,
  },

  // ========================================
  // Token System
  // ========================================
  tokens: {
    xPNTsFactory: {
      name: 'xPNTsFactory',
      version: '2.0.0',
      versionCode: 20000,
      deployedAt: '2025-11-01',
      address: TOKEN_ADDRESSES.xPNTsFactory,
      features: [
        'VERSION interface',
        'Unified architecture',
        'Gas token creation',
        'Community-specific tokens',
        'Auto-approved spenders',
      ],
    } as ContractVersion,

    mySBT: {
      name: 'MySBT',
      version: '2.4.5',
      versionCode: 20405,
      deployedAt: '2024-11-24',
      address: CORE_ADDRESSES.mySBT,
      features: [
        'IVersioned interface: version() returns 2004005, versionString() returns "v2.4.5"',
        'VERSION constants: VERSION="2.4.5", VERSION_CODE=20405',
        'NFT architecture refactor',
        'Soulbound token (SBT)',
        'Time-based reputation',
        'Membership management',
        'GToken mint fee (burn)',
        'safeMint() - DAO-only faucet minting',
        'mintWithAutoStake() - FIXED: correct token transfer order for stake + burn',
        'airdropMint() - NEW: Operator-paid batch minting (no user approval needed)',
        'Operator pays all costs: 0.4 GT per user (0.1 burn + 0.3 stake)',
        'True airdrop: Uses stakeFor() to stake on behalf of users',
        'Idempotent: Safe to call multiple times (adds membership if SBT exists)',
        'Size optimized: 21KB bytecode (-21% vs v2.4.4, under 24KB limit)',
        'SuperPaymaster V2.3.3 integration: registerSBTHolder() after mint, removeSBTHolder() before burn',
        'Graceful degradation: try/catch for optional external calls',
        'Fully tested: 14/14 tests passed including IVersioned interface',
      ],
    } as ContractVersion,
  },

  // ========================================
  // Test Tokens (For Development & Testing)
  // ========================================
  testTokens: {
    aPNTs: {
      name: 'aPNTs',
      version: '2.0.0',
      versionCode: 20000,
      deployedAt: '2025-11-01',
      address: TEST_TOKEN_ADDRESSES.aPNTs,
      features: [
        'VERSION interface',
        'AAStar community gas token',
        'Test token for development',
        'Auto-approved spenders',
      ],
    } as ContractVersion,

    bPNTs: {
      name: 'bPNTs',
      version: '2.0.0',
      versionCode: 20000,
      deployedAt: '2025-11-03',
      address: TEST_TOKEN_ADDRESSES.bPNTs,
      features: [
        'VERSION interface',
        'BreadCommunity gas token',
        'Test token for development',
        'Auto-approved spenders',
      ],
    } as ContractVersion,
  },

  // ========================================
  // Monitoring System
  // ========================================
  monitoring: {
    dvtValidator: {
      name: 'DVTValidator',
      version: '2.0.0',
      versionCode: 20000,
      deployedAt: '2025-11-01',
      address: MONITORING_ADDRESSES.dvtValidator,
      features: [
        'VERSION interface',
        'Distributed validator technology',
        'Validator set management',
        'Threshold validation',
      ],
    } as ContractVersion,

    blsAggregator: {
      name: 'BLSAggregator',
      version: '2.0.0',
      versionCode: 20000,
      deployedAt: '2025-11-01',
      address: MONITORING_ADDRESSES.blsAggregator,
      features: [
        'VERSION interface',
        'BLS signature aggregation',
        'Multi-signature support',
        'Gas optimization',
      ],
    } as ContractVersion,
  },
} as const;

/**
 * Get all V2 contracts with VERSION interface
 *
 * @returns Array of all V2 contract versions
 *
 * @example
 * ```ts
 * const allV2Contracts = getAllV2Contracts();
 * for (const contract of allV2Contracts) {
 *   console.log(`${contract.name} v${contract.version} at ${contract.address}`);
 * }
 * ```
 */
export function getAllV2Contracts(): ContractVersion[] {
  const contracts: ContractVersion[] = [];

  // Core system
  contracts.push(SEPOLIA_V2_VERSIONS.core.gToken);
  contracts.push(SEPOLIA_V2_VERSIONS.core.superPaymaster);
  contracts.push(SEPOLIA_V2_VERSIONS.core.registry);
  contracts.push(SEPOLIA_V2_VERSIONS.core.gTokenStaking);
  contracts.push(SEPOLIA_V2_VERSIONS.core.paymasterFactory);

  // Token system
  contracts.push(SEPOLIA_V2_VERSIONS.tokens.xPNTsFactory);
  contracts.push(SEPOLIA_V2_VERSIONS.tokens.mySBT);

  // Test tokens
  contracts.push(SEPOLIA_V2_VERSIONS.testTokens.aPNTs);
  contracts.push(SEPOLIA_V2_VERSIONS.testTokens.bPNTs);

  // Monitoring system
  contracts.push(SEPOLIA_V2_VERSIONS.monitoring.dvtValidator);
  contracts.push(SEPOLIA_V2_VERSIONS.monitoring.blsAggregator);

  return contracts;
}

/**
 * Get V2 contract by name
 *
 * @param name - Contract name
 * @returns Contract version info or undefined
 *
 * @example
 * ```ts
 * const contract = getV2ContractByName('SuperPaymasterV2');
 * if (contract) {
 *   console.log(`Version: ${contract.version}`);
 * }
 * ```
 */
export function getV2ContractByName(name: string): ContractVersion | undefined {
  const all = getAllV2Contracts();
  return all.find(c => c.name === name);
}

/**
 * Get V2 contract by address
 *
 * @param address - Contract address (case-insensitive)
 * @returns Contract version info or undefined
 *
 * @example
 * ```ts
 * const contract = getV2ContractByAddress('0xB97A20aca3D6770Deca299a1aD9DAFb12d1e5eCf');
 * if (contract) {
 *   console.log(`Found: ${contract.name} v${contract.version}`);
 * }
 * ```
 */
export function getV2ContractByAddress(address: string): ContractVersion | undefined {
  const all = getAllV2Contracts();
  return all.find(c => c.address.toLowerCase() === address.toLowerCase());
}

/**
 * Check if an address is a V2 contract
 *
 * @param address - Contract address to check
 * @returns True if address is a V2 contract
 *
 * @example
 * ```ts
 * if (isV2Contract('0xB97A20aca3D6770Deca299a1aD9DAFb12d1e5eCf')) {
 *   console.log('This is a V2 contract with VERSION interface');
 * }
 * ```
 */
export function isV2Contract(address: string): boolean {
  return getV2ContractByAddress(address) !== undefined;
}

/**
 * Get all V2 contracts deployed on a specific date
 *
 * @param date - Deployment date (YYYY-MM-DD)
 * @returns Array of contracts deployed on that date
 *
 * @example
 * ```ts
 * const contracts = getV2ContractsByDate('2025-11-01');
 * console.log(`${contracts.length} contracts deployed on 2025-11-01`);
 * ```
 */
export function getV2ContractsByDate(date: string): ContractVersion[] {
  const all = getAllV2Contracts();
  return all.filter(c => c.deployedAt === date);
}

/**
 * V2 Contract Summary
 */
export const V2_SUMMARY = {
  totalContracts: 11,
  categories: {
    core: 5, // GToken, SuperPaymasterV2, Registry, GTokenStaking, PaymasterFactory
    tokens: 2, // xPNTsFactory, MySBT
    testTokens: 2, // aPNTs, bPNTs
    monitoring: 2, // DVTValidator, BLSAggregator
  },
  latestDeployment: '2025-11-09',
  allContractsHaveVersion: true, // All V2 contracts now have VERSION interface
} as const;
