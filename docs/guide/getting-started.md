# Getting Started

<p align="left">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" style="display:inline-block; margin-right: 10px;" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue" alt="TypeScript" style="display:inline-block; margin-right: 10px;" />
  <img src="https://img.shields.io/badge/Status-0.14.0-green" alt="Status" style="display:inline-block;" />
</p>

**Comprehensive Account Abstraction Infrastructure SDK - Powering the Mycelium Network**

---

## 📚 Table of Contents

- [Introduction](#introduction)
- [SDK v2 Architecture](#sdk-v2-architecture)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Testing Commands](#testing-commands)
- [Development Guide](#development-guide)
- [Academic Research](#academic-research)

---

## Introduction

**AAStar SDK** is a high-integration toolkit for the Mycelium network. We've refactored 17 fragmented modules into 7 professional core packages, aimed at providing a unified, high-performance, and easy-to-maintain development experience.

### Core Features

- ✅ **Role-Based Clients**: Specific APIs for End Users, Communities, Operators, and Admins.
- ✅ **Infrastructure Ready**: Deep integration with SuperPaymaster and EOA Bridge.
- ✅ **Seamless User Experience**: Gasless transactions via community credit system.
- ✅ **DVT Security Module**: Decentralized verification and aggregate signatures.
- ✅ **Scientific Reproducibility**: Version-locked for academic research and data collection.

---

## SDK v2 Architecture

AAStar SDK v2 uses an **"Actions-Decorator"** pattern (inspired by `viem` and `permissionless.js`). It decouples low-level contract interactions from high-level business logic, providing specialized Client wrappers for four roles in the ecosystem.

### Core Concepts

- **Semantic Actions**: Encapsulate complex flows (e.g., "Operator Onboarding") into a single SDK call.
- **Provider Agnostic**: Perfectly fits any `viem` transport layer (Pimlico, Alchemy, or local Anvil).
- **Security Hardened**: Locked dependency versions and automated supply chain audits.

### Role-Based API Matrix

| Client | Targeted Developer | Core Responsibility |
| :--- | :--- | :--- |
| **`EndUserClient`** | dApp Developer | Gasless UX, Smart Account management, Credit/Debt queries |
| **`CommunityClient`** | Community/DAO Admin | Auto-onboarding, xPNTs deployment, SBT & Reputation config |
| **`OperatorClient`** | Node/Operator | SuperPaymaster registration, Staking, Pool management |
| **`AdminClient`** | Protocol Admin | DVT aggregations, Slashing, Global parameters |

---

## Installation

```bash
pnpm install @aastar/sdk @aastar/core viem
```

---

## Quick Start

### Basic Example (Operator)

```typescript
import { createOperatorClient } from '@aastar/sdk';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { http } from 'viem';

// Create Operator Client
const operatorClient = createOperatorClient({
  chain: foundry,
  transport: http('http://127.0.0.1:8545'),
  account: privateKeyToAccount('0x...'),
});

// One-click Onboarding to SuperPaymaster (Stake + Deposit)
await operatorClient.onboardToSuperPaymaster({
  stakeAmount: parseEther('50'),
  depositAmount: parseEther('50')
});
```

---

## Testing Commands

This project provides two sets of regression tests.

### SDK Regression (Using SDK Clients)

```bash
pnpm run test:full_sdk
```

- **Scenario**:
  - ✅ Operator Staking
  - ✅ Paymaster Deposit
  - ✅ Community Registration
  - ✅ SBT Minting
  - ✅ Admin Slashing
  - ✅ Credit Query

### Full Protocol Regression (Dedicated Anvil, 72 Scenarios)

```bash
pnpm run test:full_anvil
```

---

## Academic Research

The SDK supports doctoral data collection for the SuperPaymaster paper:

- **`scripts/19_sdk_experiment_runner.ts`**: Official experiment logger.
- **Coverage**: 95% user use case branches, 72 full scenarios.

---

## Support & Contributing

- **Repository**: [AAStarCommunity/aastar-sdk](https://github.com/AAStarCommunity/aastar-sdk)
- **Discord**: [Join our community](https://discord.gg/aastar)
- **License**: MIT
