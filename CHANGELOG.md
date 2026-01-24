# Changelog

All notable changes to this project will be documented in this file.

## [0.16.14] - 2026-01-24

### 🌍 Multi-Chain & Infrastructure
- **[FEATURE]** **Standardized Config Loader**: 
  - Restructured `config.ts` to implement a robust multi-chain loading priority.
  - Internal Protocol Contracts (Registry, Paymasters, GToken) now strictly prioritize `config.{network}.json`.
  - Infrastructure Contracts (EntryPoint, PriceFeed) and URLs (RPC, Bundler) are now sourced primarily from `.env.{network}`.
- **[FIX]** **Hardcoded Dependencies Cleanup**: 
  - Successfully removed all remaining hardcoded `0x` addresses and `sepolia` string literals across all `tests/` and `examples/` scripts.
  - Every script now supports the `--network` parameter for dynamic environment switching.
- **[REPAIR]** **Reputation Activity Metrics**: Corrected the `opName` lookup string in `l4-reputation-tiers.ts` to align with the latest `l4-setup.ts` state files.

### ⚡ Gasless Execution Efficiency
- **[IMPROVED]** **SuperPaymaster Verification Tuning**: 
  - Implemented "Dynamic Nominal Gas Tuning" in `SuperPaymasterClient` to optimize `paymasterVerificationGasLimit`.
  - Resolved "Efficiency too low" (AA30) errors on Alchemy/Optimism-Sepolia by maintaining a strict balance between execution safety and bundler efficiency ratios (>= 0.4).

## [0.16.13] - 2026-01-23

### 🛡️ Security & Stability
- **[SECURITY]** **Strict Address Resolution**: 
  - Enforced strict environment variable lookup for third-party contract addresses (`entryPoint`, `simpleAccountFactory`, `priceFeed`) on non-Anvil networks.
  - Eliminated fallback to outdated `config.json` files to prevent deployment misconfigurations.
- **[SECURITY]** **Token Transfer Limits**:
  - Updated ABI to reflect new `MAX_SINGLE_TX_LIMIT` enforcement in `xPNTsToken`. SDK transactions respecting standard limits will continue to work; anomalous high-value transfers may now revert at the contract level.
- **[SECURITY]** **Operator Firewall**:
  - Updated ABI to reflect `autoApprovedSpenders` logic. 

### ⚙️ Core Improvements
- **[FIX]** **xPNTsToken Initialization**: Adjusted factory logic to support EIP-1167 Minimal Clones using `initialize()` pattern.
- **[SYNC]** **Contract ABIs**: Synchronized all ABIs with `SuperPaymaster` `v3.6.3`, including new governance functions `renounceFactory` and `emergencyRevokePaymaster`.


## [0.16.11] - 2026-01-19

### 📊 Gas Analytics & Reporting (New Package)
- **[NEW]** Added `@aastar/analytics` package for comprehensive gas analysis.
- **[FEATURE]** `CostCalculator`: Calculates true L1/L2 gas costs, protocol profit (10% premium + buffer), and user savings.
- **[FEATURE]** `AttributionAnalyzer`: Simulates L2 costs (Optimism model) to provide "Apple-to-Apple" competitiveness comparisons.
- **[REPORT]** `gas-analyzer-v4.ts`: Generates detailed reports showing ~28% protocol profit margin and ~400x savings vs. Ethereum L1.

### SDK & Core Enhancements
- **[FIX]** **Anni Gasless Fix**: Updated `l4-setup.ts` to use `updatePriceDVT` for refreshing stale SuperPaymaster price cache, preventing "UserOperation expired" errors.
- **[FIX]** **Duplicate Build Fix**: Resolved merge conflicts and duplicate identifiers in `packages/core` actions (e.g., `contracts.ts`, `actions/index.ts`).
- **[FIX]** **Build System**: Removed residual `*.test.ts` files in modification directories to ensure clean `tsc` builds.

### Regression & Testing
- **[IMPROVED]** `L4 Regression`: Full automation for Setup -> Funding -> Gasless Transactions -> Analytics.
- **[FEATURE]** `DVT Price Update`: Integrated DVT signature generation in test setup to simulate authenticated price updates.

- **[BREAKING]** Decoupled development and production build configurations.
  - Added `tsconfig.build.json` for strictly clean production builds (`pnpm build`).
  - Updated root `tsconfig.json` to retain `paths` mappings for rapid development (`tsx`).
  - Updated all `packages/*/tsconfig.json` to extend the build configuration.
- Fixed `packages/core` build output to correctly generate type definitions (`.d.ts`).

### SDK Core (`@aastar/core`)
- **[CHANGED]** `BaseClient` visibility update.
  - Changed `client` and `getStartPublicClient` from `protected` to `public` to allow easier extension and debugging in consuming applications.
- **[Check]** Standardized ABI exports.
  - Updated `abis/index.ts` to support both array-based and object-based (`{ abi: [] }`) ABI JSON formats, resolving compatibility issues with external artifacts.

### SDK Operator (`@aastar/operator`)
- **[FIXED]** ABI Property Access.
  - Fixed runtime error where `PaymasterOperatorClient` attempted to access `.abi` on a raw ABI array. Now uses the standardized `PaymasterABI` export.

### SDK EndUser (`@aastar/enduser`)
- **[FIXED]** `UserClient` build failure due to `BaseClient` visibility issues.

### Testing & Regression
- **[ADDED]** `run_sdk_regression.sh` now supports a strict `sepolia` environment mode with correct `.env` loading (`set -a`).
- **[ADDED]** `extract_v3_abis.sh` integration for reliable ABI synchronization from the SuperPaymaster project.
