# AAStar SDK (Mycelium Network)

<p align="left">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" style="display:inline-block; margin-right: 10px;" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue" alt="TypeScript" style="display:inline-block; margin-right: 10px;" />
  <img src="https://img.shields.io/badge/Status-0.14.0-green" alt="Status" style="display:inline-block;" />
</p>

**Comprehensive Account Abstraction Infrastructure SDK - Powering the Mycelium Network**

---
**
## 📚 Contents

- [AAStar SDK (Mycelium Network)](#aastar-sdk-mycelium-network)
  - [📚 Contents](#-contents)
  - [Introduction](#introduction)
    - [Core Features](#core-features)
  - [SDK v2 Architecture](#sdk-v2-architecture)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
    - [End User Gasless Transaction](#end-user-gasless-transaction)
  - [Testing Commands](#testing-commands)
    - [SDK Regression (Using SDK Clients)](#sdk-regression-using-sdk-clients)
    - [Full Protocol Regression (Anvil Dedicated)](#full-protocol-regression-anvil-dedicated)
  - [Development Guides](#development-guides)
    - [ABI Maintenance](#abi-maintenance)
  - [Development Workflow](#development-workflow)
    - [Step 1: Modify Contracts](#step-1-modify-contracts)
    - [Step 2: Local Build \& Deploy (Anvil)](#step-2-local-build--deploy-anvil)
    - [Step 3: Run Local Tests](#step-3-run-local-tests)
    - [Step 4: Deploy to Sepolia](#step-4-deploy-to-sepolia)
    - [Step 5: Verify on Sepolia](#step-5-verify-on-sepolia)
  - [📊 Gas Analytics \& Reporting](#-gas-analytics--reporting)
    - [Quick Start](#quick-start-1)
    - [Key Features](#key-features)
  - [Academic Research](#academic-research)
  - [Support](#support)
---

## Introduction

**AAStar SDK** is a high-integration toolkit for the Mycelium network. We've refactored 17 fragmented modules into 7 professional core packages, providing a unified, high-performance, and easy-to-maintain development experience.

### Core Features

- ✅ **Role-Based Clients**: Specific APIs for End Users, Communities, Operators, and Admins.
- ✅ **Infrastructure Ready**: Deep integration with SuperPaymaster and EOA Bridge.
- ✅ **Seamless User Experience**: Gasless transactions via community credit system.
- ✅ **DVT Security Module**: Decentralized verification and aggregate signatures.
- ✅ **Scientific Reproducibility**: Version-locked for academic research.

---

## SDK v2 Architecture

AAStar SDK v2 adopts the **"Actions-Decorator"** pattern. It decouples low-level contract interactions from high-level business logic, providing specialized Client wrappers for the four roles in the ecosystem.

| Client | Targeted Developer | Core Responsibility |
| :--- | :--- | :--- |
| **`EndUserClient`** | dApp Developer | Gasless UX, Smart Account management, Credit queries |
| **`CommunityClient`** | Community/DAO Admin | Auto-onboarding, xPNTs deployment, SBT & Reputation |
| **`OperatorClient`** | Node/Operator | SuperPaymaster registration, Staking, Pool management |
| **`AdminClient`** | Protocol Admin | DVT aggregations, Slashing, Global parameters |

---

## Installation

```bash
pnpm install @aastar/sdk @aastar/core viem
```

---

## Quick Start

### End User Gasless Transaction
```typescript
import { createEndUserClient } from '@aastar/sdk';

const user = createEndUserClient({ 
  account, 
  paymasterUrl: 'https://paymaster.aastar.io' 
});

// Execute gasless via SuperPaymaster
await user.executeGasless({
  target: TARGET_ADDR,
  data: CALL_DATA,
  operator: OPERATOR_ADDR // Operator sponsoring the gas
});
```

### Operator Onboarding
```typescript
import { createOperatorClient } from '@aastar/sdk';
import { parseEther, keccak256, stringToBytes } from 'viem';

const operator = createOperatorClient({ account, chain });

// High-level setup: handles GToken approval, staking, and paymaster deposit
await operator.onboardOperator({
  stakeAmount: parseEther('100'),
  depositAmount: parseEther('10'),
  roleId: keccak256(stringToBytes('PAYMASTER_SUPER'))
});
```

---

## Testing Commands

### SDK Regression (Using SDK Clients)
```bash
pnpm run test:full_sdk
```


### Full Protocol Regression (Anvil Dedicated)
```bash
pnpm run test:full_anvil
```

---

## Development Guides

### ABI Maintenance
- [ABI Maintenance Plan](https://docs.aastar.io/guide/ABI_MAINTENANCE_PLAN)

---

## Development Workflow

A step-by-step guide for contributors from contract modification to Sepolia deployment.

### Step 1: Modify Contracts
Edit Solidity files in `superpaymaster/contracts/src`.
```bash
cd projects/SuperPaymaster
# Edit .sol files...
```

### Step 2: Local Build & Deploy (Anvil)
Auto-start Anvil, compile contracts, deploy, and sync config to SDK.
```bash
cd projects/aastar-sdk
# Runs Anvil + Deploy + Sync .env.anvil
./run_full_regression.sh --env anvil
```

### Step 3: Run Local Tests
Validate your changes with the full regression suite.
```bash
# Run all SDK & Protocol tests
./run_sdk_regression.sh
```

### Step 4: Deploy to Sepolia
1. Configure `aastar-sdk/.env.sepolia` with `ADMIN_KEY` and `SEPOLIA_RPC_URL`.
2. Run the deployment script (with resume capability).
```bash
cd projects/SuperPaymaster/contracts
# Deploy Core + Modules
export $(grep -v '^#' ../../aastar-sdk/.env.sepolia | xargs) && \
export PRIVATE_KEY=$ADMIN_KEY && \
forge script script/DeployV3FullSepolia.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast --verify --slow --resume
```
3. Update `aastar-sdk/.env.sepolia` with new contract addresses from `script/v3/config.json`.

### Step 5: Verify on Sepolia
Run the regression suite against the live testnet.
```bash
cd projects/aastar-sdk
./run_full_regression.sh --env sepolia
```


---

## 📊 Gas Analytics & Reporting
The SDK includes a powerful **Gas Analytics Module** for analyzing Paymaster efficiency, tracking costs, and generating industry comparison reports.

### Quick Start
Generate a real-time analysis of recent Sepolia transactions:
```bash
npx tsx packages/analytics/src/gas-analyzer-v4.ts
```

### Key Features
- **Double-Layer Analysis**: Intrinsic EVM Efficiency vs. Economic USD Costs
- **Industry Benchmarking**: Compare AAStar vs. Optimism, Alchemy, Pimlico
- **Profit Tracking**: Transparent breakdown of Protocol Revenue & Profit
- **L2 Simulation**: Estimate savings for migrating UserOps to Optimism

👉 **[View Full Analytics Documentation](https://docs.aastar.io/guide/packages/analytics/)**

---

## Academic Research

The SDK supports doctoral data collection for the SuperPaymaster paper. Official experiment logger is available at `scripts/19_sdk_experiment_runner.ts`.

- [Stage 3 Scenario Experiment Plan](https://docs.aastar.io/guide/STAGE_3_SCENARIO_EXP_PLAN)
- [Reputation-to-Credit Mapping Whitepaper](https://docs.aastar.io/guide/Reputation-to-Credit_Mapping_Whitepaper)

---

## Support

- **Documentation**: [docs.aastar.io](https://docs.aastar.io)
- **GitHub**: [AAStarCommunity/aastar-sdk](https://github.com/AAStarCommunity/aastar-sdk)

MIT © AAStar Community
