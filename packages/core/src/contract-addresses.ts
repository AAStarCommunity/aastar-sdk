/**
 * Contract Addresses - Single Source of Truth
 * All contract addresses for Sepolia testnet
 *
 * This file serves as the single source of truth for all contract addresses.
 * All other files reference these constants to avoid duplication.
 */

import { type Address } from 'viem';
import {
  REGISTRY_ADDRESS,
  GTOKEN_ADDRESS,
  GTOKEN_STAKING_ADDRESS,
  SUPER_PAYMASTER_ADDRESS,
  PAYMASTER_FACTORY_ADDRESS,
  PAYMASTER_V4_IMPL_ADDRESS,
  APNTS_ADDRESS,
  SBT_ADDRESS,
  DVT_VALIDATOR_ADDRESS,
  ENTRY_POINT_ADDRESS,
  XPNTS_FACTORY_ADDRESS,
  BLS_AGGREGATOR_ADDRESS,
  REPUTATION_SYSTEM_ADDRESS
} from './constants.js';

/**
 * Core System Addresses
 */
export const CORE_ADDRESSES = {
  registry: REGISTRY_ADDRESS,
  gToken: GTOKEN_ADDRESS,
  gTokenStaking: GTOKEN_STAKING_ADDRESS,
  superPaymaster: SUPER_PAYMASTER_ADDRESS,
  paymasterFactory: PAYMASTER_FACTORY_ADDRESS,
  aPNTs: APNTS_ADDRESS,
  mySBT: SBT_ADDRESS,
  // Fallback to Env if not in config (or use Implementation)
  paymasterV4: (process.env.PAYMASTER_V4_PROXY || PAYMASTER_V4_IMPL_ADDRESS) as Address,
  dvtValidator: DVT_VALIDATOR_ADDRESS,
  entryPoint: ENTRY_POINT_ADDRESS,
  xPNTsFactory: XPNTS_FACTORY_ADDRESS,
  reputationSystem: (process.env.REPUTATION_SYSTEM_ADDRESS || REPUTATION_SYSTEM_ADDRESS) as Address,
} as const;

/**
 * Token System Addresses
 */
export const TOKEN_ADDRESSES = {
  xPNTsFactory: XPNTS_FACTORY_ADDRESS,
  aPNTs: APNTS_ADDRESS,
  gToken: GTOKEN_ADDRESS,
  pimToken: (process.env.PIM_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000') as Address, // Often custom per deployment
} as const;

/**
 * Test Token Addresses (For Development & Testing)
 */
export const TEST_TOKEN_ADDRESSES = {
  mockUSDT: process.env.TEST_MOCK_USDT as Address,
  apnts: APNTS_ADDRESS,
  gToken: GTOKEN_ADDRESS,
  bpnts: GTOKEN_ADDRESS, // bPNTs is often GToken in simple setups
  pimToken: TOKEN_ADDRESSES.pimToken,
} as const;

/**
 * Test Account Addresses (For Development & Testing)
 */
export const TEST_ACCOUNT_ADDRESSES = {
  // Official EntryPoint 0.6 Factory for Sepolia
  simpleAccountFactory: (process.env.SIMPLE_ACCOUNT_FACTORY || '0x9406Cc6185a346906296840746125a0E44976454') as Address,
} as const;

/**
 * Paymaster Addresses
 */
export const PAYMASTER_ADDRESSES = {
  paymasterV4_1: process.env.PAYMASTER_V4_ADDRESS as Address,
  paymasterV4_1iImplementation: PAYMASTER_V4_IMPL_ADDRESS,
} as const;

/**
 * Monitoring System Addresses
 */
export const MONITORING_ADDRESSES = {
  dvtValidator: DVT_VALIDATOR_ADDRESS,
  blsAggregator: BLS_AGGREGATOR_ADDRESS,
} as const;

/**
 * Official Contract Addresses
 */
export const OFFICIAL_ADDRESSES = {
  entryPoint: (ENTRY_POINT_ADDRESS || '0x0000000071727De22E5E9d8BAf0edAc6f37da032') as Address,
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
