# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AAStar SDK is a TypeScript monorepo for the Mycelium Network — a comprehensive Account Abstraction (ERC-4337) infrastructure SDK. It provides gasless transaction support, community economies, reputation-based credit systems, and role-based access through SuperPaymaster contracts on Optimism and Ethereum testnets.

Current version: **v0.18.0** | Package manager: **pnpm only** | Runtime: **Node.js with ESM**

## Common Commands

```bash
# Install dependencies
pnpm install

# Build all packages (required before running scripts/tests)
pnpm -r build

# Run unit tests (vitest)
pnpm -r test                          # All packages
pnpm --filter @aastar/core test       # Single package

# Run test coverage
pnpm run test:coverage

# Lint
pnpm -r lint

# Full SDK regression (starts Anvil, deploys contracts, runs L1-L3 tests)
./run_sdk_regression.sh               # Default: anvil
./run_sdk_regression.sh --env sepolia  # Against Sepolia

# Run individual regression steps
pnpm tsx tests/regression/index.ts --network=anvil
pnpm tsx tests/regression/index.ts --network=op-sepolia

# Run numbered regression scripts
pnpm run test:regression              # Sequential: 00 through 05 + BLS

# Run a single script
pnpm exec tsx scripts/06_local_test_v3_full.ts

# Run a single unit test file (vitest)
pnpm exec vitest run packages/core/src/actions/account.test.ts

# ABI / contract address sync (after SuperPaymaster contract changes)
pnpm run audit:abi                    # Validate ABI consistency
pnpm exec tsx scripts/sync_contract_addresses.ts

# Generate API docs (typedoc → docs/api/)
pnpm run docs:generate

# Keeper (price oracle updater)
pnpm run keeper:op-sepolia
pnpm exec tsx scripts/keeper.ts --network op-sepolia --once --dry-run
```

## Architecture

### L1-L4 Layered Abstraction

| Tier | Purpose | Location |
|------|---------|----------|
| **L1** Base API | Raw contract wrappers (Registry, Paymaster, SBT) | `packages/core/src/actions/` |
| **L2** Workflows | Atomic multi-step tasks (onboardOperator, deployXPNTs) | `packages/{enduser,operator,community}/src/` |
| **L3** Scenarios | End-to-end journeys (submitGaslessUserOperation) | `packages/sdk/src/clients/` |
| **L4** Regression | Full lifecycle verification on Anvil/Optimism | `tests/regression/`, `scripts/` |

### Monorepo Package Dependency Graph

```
@aastar/core  ← foundation: ABIs, addresses, config, viem action factories
    ↑
    ├── @aastar/account     (smart accounts, UserOp packing)
    ├── @aastar/paymaster   (SuperPaymaster middleware, gas sponsorship)
    ├── @aastar/identity    (SBT, reputation scoring, credit limits)
    ├── @aastar/tokens      (GToken, aPNTs, xPNTs staking/finance)
    ├── @aastar/community   (DAO management, depends on tokens)
    ├── @aastar/enduser     (user lifecycle)
    ├── @aastar/operator    (operator lifecycle)
    ├── @aastar/admin       (protocol governance)
    ├── @aastar/dapp        (React hooks/components, depends on paymaster)
    ├── @aastar/analytics   (on-chain analytics, depends on enduser+paymaster)
    │
    └── @aastar/sdk  ← umbrella: re-exports everything + role-based client factories
```

All packages use `workspace:*` linking. The `@aastar/sdk` package re-exports all sub-packages and adds `createEndUserClient()`, `createOperatorClient()`, `createAdminClient()`.

### Role-Based Client Pattern

The SDK exposes role-specific clients that compose viem action factories:
- **EndUserClient**: Gasless UX, smart account management, credit queries
- **OperatorClient**: SuperPaymaster registration, staking, pool management
- **CommunityClient**: Auto-onboarding, xPNTs deployment, SBT & reputation
- **AdminClient**: DVT aggregation, slashing, global protocol parameters

### Viem Action Factory Pattern

Each domain module exports `xyzActions()` factories that extend viem clients with custom methods:
```typescript
// Example: registryActions(address) returns { registerRole, getRoleConfig, ... }
// These compose into role-based clients via viem's extend() mechanism
```

### Network Configuration

Contract addresses are loaded from `config.{network}.json` files at the project root:
- `config.anvil.json` — local Anvil devnet
- `config.sepolia.json` — Ethereum Sepolia testnet
- `config.op-sepolia.json` — Optimism Sepolia testnet
- `config.op-mainnet.json` — Optimism Mainnet

Environment variables (RPC URLs, private keys) go in `.env.{network}` files. See `env.template` for the required shape.

## Key Conventions

- **ABIs must come from `@aastar/core`** — the ESLint config forbids `parseAbi` from viem directly. All contract ABIs are centralized in `packages/core/src/abis/`.
- **TypeScript path alias**: `@aastar/*` maps to `packages/*/src/index.ts` in development (see `tsconfig.json` paths).
- **ESM throughout**: All packages use `"type": "module"`. Scripts run via `tsx` or `ts-node`.
- **Pre-commit hook** (`.githooks/pre-commit`): runs `scripts/security-scan.ts` to detect leaked keys/metadata. Requires manual activation: `git config core.hooksPath .githooks`.
- **SuperPaymaster contract source** lives in a sibling repo `../SuperPaymaster`. The `run_sdk_regression.sh` script expects it there for Anvil deployments and ABI sync.
- **Paymaster versions**: `@aastar/paymaster` contains both V3 (`src/SuperPaymaster/`) and V4 (`src/V4/`) implementations. V4 is the active protocol; V3 is maintained for compatibility.

## Testing Strategy

- **Unit tests**: vitest, located as `*.test.ts` alongside source in each package. Configured in `vitest.config.ts` (excludes `tests/` dir and `ext/`).
- **Regression tests**: TypeScript scripts in `tests/regression/` (L1-L4 tiered) and `scripts/` (numbered `00_`–`23_` suites, plus `98_`/`99_` edge cases). `scripts/v2_regression/` has a self-contained 00–05 walkthrough.
- **L4 gasless tests**: `tests/l4-test-*.ts` and `tests/regression/l4-gasless.ts` — end-to-end gasless verification against live testnets. `l4-gasless.ts` is the most comprehensive (~51 KB).
- **Network detection**: `tests/regression/config.ts` centralizes all network-specific config; pass `--network=anvil|sepolia|op-sepolia|op-mainnet` to the runner.
- Networks for testing: `anvil`, `sepolia`, `op-sepolia`, `op-mainnet`.

## Rules

1. All code comments in English
2. All conversation responses in Chinese (中文)
