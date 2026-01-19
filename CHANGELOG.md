# Changelog

All notable changes to this project will be documented in this file.

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
