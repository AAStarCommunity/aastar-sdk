/**
 * AAStar Shared Configuration Package
 *
 * @packageDocumentation
 */

export * from './branding.js';
export * from './contract-addresses.js'; // Single source of truth for all contract addresses
export * from './contracts.js';
export * from './contract-versions.js';
export * from './networks.js';
export * from './constants.js';
export * from './communities.js'; // Community configurations
export * from './abis/index.js'; // Assuming abis is a folder with index.ts
export * from './clients.js';
export * from './clients/types.js';
export * from './clients/BaseClient.js';
export * from './clients/BundlerClient.js';
export * from './actions/index.js';
export * from './crypto/index.js';
export * from './roles.js'; // Role system
export * from './requirementChecker.js'; // Requirement validation
export * from './config/ContractConfigManager.js';
