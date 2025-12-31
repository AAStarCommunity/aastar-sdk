/**
 * Contract Addresses - Single Source of Truth
 * All contract addresses for Sepolia testnet
 *
 * This file serves as the single source of truth for all contract addresses.
 * All other files reference these constants to avoid duplication.
 */

import { type Address } from 'viem';

/**
 * Core System Addresses
 */
export const CORE_ADDRESSES = {
  registry: process.env.REGISTRY_ADDRESS as Address,
  gToken: process.env.GTOKEN_ADDRESS as Address,
  gTokenStaking: process.env.GTOKENSTAKING_ADDRESS as Address,
  superPaymaster: process.env.SUPER_PAYMASTER as Address,
  paymasterFactory: process.env.PAYMASTER_FACTORY_ADDRESS as Address,
  aPNTs: process.env.APNTS_ADDRESS as Address,
  mySBT: process.env.MYSBT_ADDRESS as Address,
  paymasterV4: process.env.PAYMASTER_ADDRESS as Address,
  dvtValidator: process.env.DVT_VALIDATOR_ADDR as Address,
  entryPoint: process.env.ENTRY_POINT_ADDR as Address,
  xPNTsFactory: process.env.XPNTS_FACTORY_ADDRESS as Address,
} as const;

/**
 * Token System Addresses
 */
export const TOKEN_ADDRESSES = {
  xPNTsFactory: process.env.XPNTS_FACTORY_ADDRESS as Address,
} as const;

/**
 * Test Token Addresses (For Development & Testing)
 */
export const TEST_TOKEN_ADDRESSES = {
  mockUSDT: process.env.TEST_MOCK_USDT as Address,
  aPNTs: process.env.TEST_APNTS as Address,
  bPNTs: process.env.TEST_BPNTS as Address,
} as const;

/**
 * Test Account Addresses (For Development & Testing)
 */
export const TEST_ACCOUNT_ADDRESSES = {
  simpleAccountFactory: process.env.SIMPLE_ACCOUNT_FACTORY as Address,
} as const;

/**
 * Paymaster Addresses
 */
export const PAYMASTER_ADDRESSES = {
  paymasterV4_1: process.env.PAYMASTER_V4_ADDRESS as Address,
  paymasterV4_1iImplementation: process.env.PAYMASTER_V4_IMPL as Address,
} as const;

/**
 * Monitoring System Addresses
 */
export const MONITORING_ADDRESSES = {
  dvtValidator: process.env.DVT_VALIDATOR_ADDRESS as Address,
  blsAggregator: process.env.BLS_AGGREGATOR_ADDRESS as Address,
} as const;

/**
 * Official Contract Addresses
 */
export const OFFICIAL_ADDRESSES = {
  entryPoint: (process.env.ENTRYPOINT_ADDRESS || '0x0000000071727De22E5E9d8BAf0edAc6f37da032') as Address,
} as const;

/**
 * Community Owner Addresses
 */
export const COMMUNITY_OWNERS = {
  aastarOwner: '0x411BD567E46C0781248dbB6a9211891C032885e5', // Deployer 1
  breadCommunityOwner: '0xe24b6f321B0140716a2b671ed0D983bb64E7DaFA', // OWNER2
} as const;

/**
 * Test Community Addresses (Registered in Registry v2.2.0 on 2025-11-08)
 */
export const TEST_COMMUNITIES = {
  aastar: process.env.TEST_COMMUNITY_AASTAR as Address,
  bread: process.env.TEST_COMMUNITY_BREAD as Address,
  mycelium: process.env.TEST_COMMUNITY_MYCELIUM as Address,
} as const;

/**
 * All Addresses Combined (for reference)
 */
export const ALL_ADDRESSES = {
  ...CORE_ADDRESSES,
  ...TOKEN_ADDRESSES,
  ...TEST_TOKEN_ADDRESSES,
  ...TEST_ACCOUNT_ADDRESSES,
  ...PAYMASTER_ADDRESSES,
  ...MONITORING_ADDRESSES,
  ...OFFICIAL_ADDRESSES,
} as const;
