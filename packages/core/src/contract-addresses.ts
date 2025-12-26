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
  registry: (process.env.REGISTRY_ADDRESS || '0x0165878A594ca255338adfa4d48449f69242Eb8F') as Address,
  gToken: (process.env.GTOKEN_ADDRESS || '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0') as Address,
  gTokenStaking: (process.env.GTOKENSTAKING_ADDRESS || '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9') as Address,
  superPaymaster: (process.env.SUPER_PAYMASTER || '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e') as Address,
  paymasterFactory: (process.env.PAYMASTER_FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000') as Address,
  aPNTs: (process.env.APNTS_ADDRESS || undefined) as Address | undefined,
  mySBT: (process.env.MYSBT_ADDRESS || '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707') as Address,
 // MySBT v2.4.5-optimized (2024-11-24) - Size optimized (21KB), SuperPaymaster callbacks, external extensions
} as const;

/**
 * Token System Addresses
 */
export const TOKEN_ADDRESSES = {
  xPNTsFactory: '0x9dD72cB42427fC9F7Bf0c949DB7def51ef29D6Bd',
} as const;

/**
 * Test Token Addresses (For Development & Testing)
 */
export const TEST_TOKEN_ADDRESSES = {
  mockUSDT: '0x14EaC6C3D49AEDff3D59773A7d7bfb50182bCfDc',
  aPNTs: '0xBD0710596010a157B88cd141d797E8Ad4bb2306b',
  bPNTs: '0x70Da2c1B7Fcf471247Bc3B09f8927a4ab1751Ba3',
} as const;

/**
 * Test Account Addresses (For Development & Testing)
 */
export const TEST_ACCOUNT_ADDRESSES = {
  simpleAccountFactory: '0x8B516A71c134a4b5196775e63b944f88Cc637F2b',
} as const;

/**
 * Paymaster Addresses
 */
export const PAYMASTER_ADDRESSES = {
  paymasterV4_1: '0x4D6A367aA183903968833Ec4AE361CFc8dDDBA38',
  paymasterV4_1iImplementation: '0x3E1C6a741f4b3f8bE24f324342539982324a6f8a',
} as const;

/**
 * Monitoring System Addresses
 */
export const MONITORING_ADDRESSES = {
  dvtValidator: '0x937CdD172fb0674Db688149093356F6dA95498FD',
  blsAggregator: '0x3Cf0587912c692aa0f5FEEEDC52959ABEEEFaEc6',
} as const;

/**
 * Official Contract Addresses
 */
export const OFFICIAL_ADDRESSES = {
  entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
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
  aastar: '0x411BD567E46C0781248dbB6a9211891C032885e5', // AAstar community (PAYMASTER_SUPER, aPNTs, MySBT, 50 GT staked)
  bread: '0xe24b6f321B0140716a2b671ed0D983bb64E7DaFA', // Bread community (PAYMASTER_AOA, bPNTs, MySBT, 50 GT staked)
  mycelium: '0x411BD567E46C0781248dbB6a9211891C032885e5', // Legacy alias for aastar
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
