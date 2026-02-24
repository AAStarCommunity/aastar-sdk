# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.16.23] - 2026-02-24
**SDK Code Integrity Hash**: `9b02e91aaae2081b68b8ddfcf4c3dd52d450b4f368a8746b5896e0024e441db7`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*
### ⛽ Gas Fee Strategy (PaymasterClient)
- **[FIX]** **Testnet/Mainnet Split Gas Pricing**:
  - Testnets (Sepolia, OP-Sepolia, Anvil, chainId 11155111/11155420/31337): apply `0.5 Gwei` floor on `maxPriorityFeePerGas` / `1.0 Gwei` floor on `maxFeePerGas`. Fixes `WaitForUserOperationReceiptTimeoutError` caused by Alchemy bundler's minimum fee requirement being higher than OP Sepolia's near-zero network fee.
  - Mainnet: pure dynamic `estimateFeesPerGas() × 1.2` (reduced from 1.5× — saves ~20% on reported maxFee while maintaining sufficient overhead for OP FIFO sequencer).
  - Strategy applied in both `estimateUserOperationGas` and `submitGaslessUserOperation`.
  - Added diagnostic log: `[PaymasterClient] Gas Pricing: TESTNET (0.5 Gwei floor) | priority=... maxFee=...`
- **[FIX]** **Retry Loop Extended**: max attempts 3→5 (`attempt < 4` guard), handles compound PVG + fee bump errors within a single retry pass.

### 🧰 Keeper (Price Updater)
- **[FIX]** **`cast send` Hang Prevention**: `runCastSend()` now applies a hard 90-second `SIGKILL` timeout. Previously `--timeout 60` only controlled receipt polling, not the subprocess itself—causing the keeper to block indefinitely when Alchemy rate-limited `eth_estimateGas`.
- **[FIX]** **Explicit Gas Price**: before each `sendUpdate`, keeper fetches `getGasPrice()` and passes it via `--gas-price` to `cast send`, eliminating cast's own `eth_estimateGas` call (which was the source of the hang).
- **[IMPROVED]** Print on-chain `priceStalenessThreshold()` for both SuperPaymaster and PaymasterV4 during INIT.
- **[IMPROVED]** Keeper anomaly docs: Chainlink stale + external/Chainlink deviation + external short-term volatility alerts documented.

### 🌐 Network Config
- **[FIX]** OP Sepolia `blockExplorer` URL changed from `optimism-sepolia.blockscout.com` → `sepolia-optimism.etherscan.io`. Affects all scripts/tests that use `getTxUrl('op-sepolia', ...)`.

### 📊 Analytics (Paper3 / Paper7)
- **[ADDED]** `packages/analytics/data/paper_gas_op_mainnet/2026-02-17/`: PaymasterV4 (n=36) and SuperPaymaster (n=43) baseline CSVs with strict single-UserOp + ERC20-transfer filter.
- **[ADDED]** `packages/analytics/data/paper_gas_op_mainnet/2026-02-18/`: Relaxed-filter datasets with sender field; `super_t2_sender.csv` (n=50) satisfies Paper3 SuperPaymaster sample target.
- **[ADDED]** `packages/analytics/data/industry_paymaster_baselines.csv`: Alchemy Gas Manager (n=50, mean=257k gas) and Pimlico ERC-20 PM (n=50, mean=387k gas) on-chain baselines for industry comparison.
- **[ADDED]** `packages/analytics/data/gasless_metrics_detailed.csv`: 21 records with full L1/L2 fee decomposition (L2GasUsed, L1GasUsed, L1FeesPaid, L2FeesPaid, ActualGasUsed).
- **[ADDED]** Paper7 exclusive datasets: credit cycle JSON records and liquidity velocity simulation CSVs under `data/paper7_exclusive/`.
- **[ADDED]** `packages/analytics/run_paper7_exclusive_data.sh` for Paper7 data pipeline.
- **[CHANGED]** `gasless_data_collection.csv` (v1): +31 rows; `gasless_data_collection_v2.csv`: +28 rows including T1=22, T2_SP_Credit=22, T5=20.
- **[ADDED]** `scripts/collect_paymaster_baselines.ts`: reproducible on-chain event collection with `--strict-transfer`, `--single-userop`, `--n`, `--append`, `--dedupe` flags.
- **[ADDED]** `scripts/collect_eoa_erc20_baseline.ts`: raw EOA ERC20 transfer baseline for comparison.
- **[ADDED]** `scripts/compute_cost_summary.ts`: aggregation script for cost breakdown tables.

### 📚 Docs
- **[CHANGED]** Regenerated API markdown output under `docs/api/`.
- **[ADDED]** `docs/guide/keeper.md`: keeper quickstart, anomaly detection, Telegram setup.

### 🗂️ Analytics Consolidation
- **[REFACTOR]** Moved all data collection scripts from `scripts/` root into `packages/analytics/scripts/` (git mv, history preserved):
  `collect_paymaster_baselines`, `collect_eoa_erc20_baseline`, `collect_industry_baseline`, `compute_cost_summary`, `gasless-collect`, `paper7-exclusive-data`, `paper7_credit_loop`, `paper7_reputation_credit`, `run_analytics_coordinator`, `run_paper7_exclusive_data.sh`, `fetch-tx-hashes`
- **[ADDED]** `packages/analytics/docs/OP_Mainnet_Gas_Analysis_Report.md`: gas cost evidence for Paper3/Paper7 (L1/L2 breakdown, PVG analysis, industry comparison, Mermaid pie charts).
- **[UPDATED]** `packages/analytics/README.md`: new directory tree, updated all command paths to `packages/analytics/scripts/...`.
- **Note**: Root shell scripts (`run-keeper-main.sh`, `run-optimism-tx-data.sh`, etc.) are unaffected — they only call `scripts/l4-*.ts` and `scripts/keeper.ts` which remain in place.

### 🔒 SDK Integrity
**SDK Code Integrity Hash**: `cebb1de2edab0fb63cd47684ab977488410262fa50e485045abc5901894a3f6f`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*


## [0.16.22] - 2026-02-11
**SDK Code Integrity Hash**: `89da8c80ebe6ad8b06adbd4946a00817b18ae79296550709b20bd9ca3af424f9`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

### 🌍 Multi-Chain & Infrastructure
- **[FEATURE]** **Optimism Mainnet Canonical Addresses**:
  - Embedded canonical contract addresses for Optimism (Chain ID: 10) in `@aastar/core`.
  - `NETWORK=optimism` now resolves `CHAIN_ID=10` by default when `CHAIN_ID` is not provided.

## [0.16.21] - 2026-02-11
**SDK Code Integrity Hash**: `8d5b71dda17e2cb746e4a70a98020b9c7a4f2b390a82804f7e5924b0bf5a51d5`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

### ⚡ Gasless Execution
- **[FIX]** **Paymaster V4 Cached Price Staleness**:
  - `PaymasterClient` now treats stale `cachedPrice` as invalid.
  - Testnets auto-refresh via `updatePrice()` when needed; mainnet requires a running keeper.
- **[FIX]** **Native UserOp Gas Defaults**:
  - Reduced `UserOpScenarioType.NATIVE` `verificationGasLimit` to a more realistic default.

### 🧰 Tooling & Regression
- **[ADDED]** EIP-2537 precompile verification script and historical check dataset.

## [0.16.20] - 2026-02-07
**SDK Code Integrity Hash**: `0a9c8a4a778bb1b64fac6fd29d8a61b2f9b02566f33b2de65e2c26e536f9fff8`
*(Excludes metadata/markdown to ensure stability / 排除文档文件以确保哈希稳定)*

### 🌍 Infrastructure & Distribution
- **[FEATURE]** **Canonical Address Solidification**: 
  - Hardcoded canonical contract addresses for Sepolia and OP Sepolia within `@aastar/core`.
  - SDK is now self-contained and ready for NPM distribution without requiring local JSON configuration files.
  - Maintained三级优先级 (ENV > Local Config > Canonical Defaults) to support flexible development.
- **[FIX]** **SuperPaymaster Price Refresh**: 
  - Fixed "UserOperation expired" errors by enabling automated owner-based price refreshes in `l4-setup.ts`.
  - Added Chainlink fallback logic for robust price synchronization on testnets.

### 🛡️ Integrity
- **[ADDED]** **SDK Source Integrity Monitoring**: 
  - Introduced a unique SHA-256 hash for the entire SDK source tree to ensure verifiable releases.

## [0.16.17] - 2026-02-07

### 🌍 Infrastructure & Compatibility
- **[FEATURE]** **Universal Browser Support**:
  - Refactored `@aastar/core` to support dual entry points via `package.json` exports.
  - **Browser**: Adds `dist/index.js` (Pure ESM) which is free of Node.js specific code (`createRequire`, `fs`), ensuring seamless integration with Vite/Next.js.
  - **Node.js**: Adds `dist/index.node.js` which automatically loads local `config.{network}.json` for backward compatibility.
  - Refactored `constants.ts` to support dynamic configuration injection via `applyConfig()`.

## 🛡️ SDK Integrity Verification

> [!IMPORTANT]
> **Security First**: To ensure you are using an official release and protect your private keys, always verify the integrity of the SDK code immediately after installation.

**Current Code Integrity Hash (v0.16.22)**:
`89da8c80ebe6ad8b06adbd4946a00817b18ae79296550709b20bd9ca3af424f9`

To verify, run this stable command (excludes non-code markdown files):
```bash
git ls-files -z | grep -zvE '\.md$' | xargs -0 sha256sum | sha256sum
```
The resulting hash must match the one listed in the [Changelog](./CHANGELOG.md).

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
