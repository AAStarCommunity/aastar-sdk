# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

AAStar SDK is a TypeScript monorepo for building Mycelium Network applications using ERC-4337 Account Abstraction. The SDK provides base configurations and wrappers for `viem` and includes SuperPaymaster V3 middleware for asset-based gas sponsorship.

This repository also contains experimental scripts for PhD research on account abstraction gas efficiency comparisons.

## Common Commands

### Build
```bash
pnpm install        # Install dependencies
pnpm build          # Build all packages
```

### Running Scripts
```bash
# Run experiment data collection (PhD research)
npx tsx scripts/run_experiment_data.ts

# Run account preparation script
npx tsx scripts/01_prepare_all.ts

# Run daily experiments
npx tsx scripts/run_daily_experiment.ts

# Run specific test scripts
npx tsx scripts/02_test_eoa.ts
npx tsx scripts/03_test_standard_aa.ts
npx tsx scripts/04_test_paymaster_v4.ts
npx tsx scripts/05_test_superpaymaster.ts
```

### Testing & Quality
The root package.json defines these scripts:
```bash
pnpm test           # Run tests in all packages (currently not implemented)
pnpm lint           # Run linting in all packages (currently not implemented)
```

## Repository Architecture

### Monorepo Structure
This is a pnpm workspace monorepo with packages in `packages/*`:

- **`@aastar/core`**: Base client wrappers around `viem` for Public, Wallet, and Bundler clients. Re-exports chain configurations (Sepolia, Optimism) and contract addresses from `@aastar/shared-config`.

- **`@aastar/superpaymaster`**: Middleware for SuperPaymaster V3 that constructs the specialized `paymasterAndData` format. Includes eligibility checking (SBT + xPNTs balance validation).

- **`aastar` (sdk package)**: Umbrella package that re-exports both `@aastar/core` and `@aastar/superpaymaster` for simplified imports.

- **Other packages**: `airaccount`, `arcadia`, `cometens`, `cos72`, `opencards`, `openpnts` (currently empty placeholder directories).

### Key Architecture Patterns

#### 1. Viem-Based ERC-4337 Implementation
The SDK wraps `viem` v2.7+ and uses its native `bundlerActions` extension for Account Abstraction support (ERC-4337 v0.7). Key functions:
- `createAAStarPublicClient()` - Standard RPC client
- `createAAStarWalletClient()` - EOA transaction signing
- `createAAStarBundlerClient()` - Extended with `sendUserOperation()` and other bundler methods

#### 2. SuperPaymaster V3 Data Format
SuperPaymaster uses a packed 92-byte `paymasterAndData` format:
```
[0:20]   Paymaster Address (20 bytes)
[20:36]  Verification Gas Limit (16 bytes, uint128, default: 160000)
[36:52]  PostOp Gas Limit (16 bytes, uint128, default: 10000)
[52:72]  Community/Operator Address (20 bytes)
[72:92]  xPNTs/Token Address (20 bytes)
```

This format is constructed by `getPaymasterAndData()` in `@aastar/superpaymaster/src/index.ts`.

#### 3. Viem v0.7 UserOperation Handling
The SDK works with **PackedUserOperation** (v0.7 format) which packs gas limits and fees into bytes32:
- `accountGasLimits` = [verificationGasLimit (16) + callGasLimit (16)]
- `gasFees` = [maxPriorityFeePerGas (16) + maxFeePerGas (16)]
- `initCode` = [factory (20) + factoryData (rest)]

The `formatUserOpToBundlerV07()` utility in `@aastar/core/src/utils.ts` unpacks these for bundlers (like Alchemy) that require the unpacked format.

#### 4. Experimental Research Framework
The `scripts/` directory contains a 3-group comparison framework for PhD research:

- **Group A (EOA Baseline)**: Traditional externally-owned account using `eth_sendTransaction`
- **Group B (Standard AA)**: ERC-4337 with third-party paymaster (Alchemy/Pimlico)
- **Group C (SuperPaymaster)**: ERC-4337 with SuperPaymaster V3 (asset-based sponsorship)

Each group uses different accounts with specific setup requirements (see `scripts/01_prepare_all.ts`).

## Environment Configuration

The project uses environment variables loaded from `.env` (root) or `../../env/.env` (from scripts). Key variables:

### RPC URLs
- `SEPOLIA_RPC_URL` - Public Sepolia RPC endpoint
- `ALCHEMY_BUNDLER_RPC_URL` - Alchemy AA Bundler endpoint (supports v0.7)

### Private Keys
- `PRIVATE_KEY` - Main EOA deployer/supplier key
- `PRIVATE_KEY_JASON` - Operator/test account owner key
- `PRIVATE_KEY_SUPPLIER` - Funding account for test setup
- `OWNER_PRIVATE_KEY` - Standard AA owner (Group B)
- `OWNER2_PRIVATE_KEY` - SuperPaymaster AA owner (Group C)

### Contract Addresses (Sepolia)
Most contracts are defined in `@aastar/shared-config` package but can be overridden via env:
- `SUPER_PAYMASTER_ADDRESS` - SuperPaymaster V3 contract
- `MYSBT_ADDRESS` - MySBT (Soulbound Token) contract
- `GTOKEN_ADDRESS` / `GAS_TOKEN_ADDRESS` - xPNTs/GToken for gas sponsorship
- `OPERATOR_ADDRESS` - Community operator address
- `PAYMASTER_FACTORY_ADDRESS` - Factory for deploying V4 paymasters
- `TEST_SIMPLE_ACCOUNT_A/B/C` - Pre-calculated SimpleAccount addresses for experiments

### Entry Points & Factories
- Entry Point v0.7: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`
- SimpleAccountFactory v0.7: `0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985`

## Development Notes

### TypeScript Configuration
- Base `tsconfig.json` uses ES2020 target with ESNext modules
- Individual packages override `noEmit: false` to generate `dist/` output
- Path aliases defined for `@aastar/core` and `@aastar/superpaymaster` in root config

### Package Manager
Uses pnpm 10.6.3+ with workspace protocol (`workspace:*`) for internal dependencies.

### Running Individual Scripts with tsx
Scripts use ES modules (`import` syntax) and can be executed directly with `npx tsx <script>`. Most scripts in the `scripts/` directory:
1. Load environment variables from `../../env/.env` or root `.env`
2. Import from `@aastar/*` packages using path aliases
3. Use `@ts-ignore` for `@aastar/shared-config` imports due to typing issues

### SuperPaymaster Eligibility Requirements
For Group C experiments (SuperPaymaster), accounts must:
1. Own a MySBT token (checked via `balanceOf(address) > 0`)
2. Have sufficient xPNTs/GToken balance to cover gas costs

Use `checkEligibility()` from `@aastar/superpaymaster` to verify before submitting UserOperations.

## Important Behavioral Guidelines

### When Working with Scripts
- Scripts expect relative env paths (commonly `../../env/.env` from scripts directory)
- Always check if contracts are loaded from `@aastar/shared-config` before using env fallbacks
- Use `privateKeyToAccount()` from `viem/accounts` for key handling
- Prefix checks for private keys: add `0x` if 64-char hex without prefix

### When Modifying SDK Packages
- After changes to `@aastar/core` or `@aastar/superpaymaster`, run `pnpm build` from root
- The `aastar` SDK package depends on workspace versions of both packages
- All packages export as ES modules (`"type": "module"`)

### Working with UserOperations
- Use `formatUserOpToBundlerV07()` when working with Alchemy bundler
- SuperPaymaster requires the packed format - use `getPaymasterAndData()`
- Never manually construct initCode - use `concat([factory, encodeFunctionData(...)])`

### Experiment Data Collection
- `run_experiment_data.ts` outputs to `real_tx_data.csv`
- Data collection runs 30 iterations by default (configurable via `RUNS` constant)
- Each run records `gasUsed`, `effectiveGasPrice`, and transaction success

## Project Context

This SDK was developed as part of PhD research on Account Abstraction efficiency and the Mycelium Network concept. The SuperPaymaster V3 design enables community-based gas sponsorship using asset-based validation (SBT + xPNTs) rather than traditional signature-based paymaster verification.
