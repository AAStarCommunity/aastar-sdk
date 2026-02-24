# AAStar SDK (Mycelium Network)

<p align="left">
  <img src="https://img.shields.io/npm/v/@aastar/sdk?color=blue&label=npm" alt="npm version" style="display:inline-block; margin-right: 5px;" />
  <img src="https://img.shields.io/badge/pnpm-only-orange" alt="pnpm" style="display:inline-block; margin-right: 5px;" />
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" style="display:inline-block; margin-right: 5px;" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue" alt="TypeScript" style="display:inline-block; margin-right: 5px;" />
  <img src="https://img.shields.io/badge/ERC--4337-ready-brightgreen" alt="ERC-4337" style="display:inline-block; margin-right: 5px;" />
  <img src="https://img.shields.io/badge/Optimism-Mainnet-red" alt="Optimism Mainnet" style="display:inline-block; margin-right: 5px;" />
  <img src="https://img.shields.io/badge/Status-v0.16.23-green" alt="Status" style="display:inline-block;" />
</p>

**Comprehensive Account Abstraction Infrastructure SDK - Powering the Mycelium Network**

> [🌐 **中文版本 / Chinese Version**](#-中文版本--chinese-version)

---

## 📚 Contents

- [Introduction](#introduction)
- [Architecture (L1-L4 Tiers)](#architecture-l1-l4-tiers)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Features & Recent Updates](#core-features--recent-updates)
- [Testing & Regression](#testing--regression)
- [📊 Gas Analytics](#-gas-analytics)
- [🧰 Keeper (Service Maintenance)](#-keeper-service-maintenance)
- [🛡️ Integrity Verification](#️-integrity-verification)
- [📝 中文版本 / Chinese Version](#-中文版本--chinese-version)

---

## Introduction

**AAStar SDK** is a professional-grade toolkit for the Mycelium network. It consolidates the fragmented AA infrastructure into a unified, high-performance, and verifiable development experience, specifically designed for gasless community economies and autonomous agent ecosystems.

---

## Architecture (L1-L4 Tiers)

The SDK follows a layered abstraction model, allowing developers to choose the appropriate depth of integration:

| Tier | Name | Target | Description |
| :--- | :--- | :--- | :--- |
| **L1** | **Base API** | Protocol Engineers | Raw contract wrappers (Registry, Paymaster, SBT). Direct mapping to Solidity functions. |
| **L2** | **Workflows** | Integrators | Atomic tasks combining multiple calls (e.g., `onboardOperator`, `deployXPNTs`). |
| **L3** | **Scenarios** | dApp Developers | End-to-end user journeys (e.g., `submitGaslessUserOperation`, `setupAccountWithCredit`). |
| **L4** | **Regression** | QA / Researchers | Full system lifecycle verification on Anvil or Optimism Mainnet. |

### Specialized Role Clients
*   **`EndUserClient`**: Gasless UX, Smart Account management, Credit queries.
*   **`CommunityClient`**: Auto-onboarding, xPNTs deployment, SBT & Reputation management.
*   **`OperatorClient`**: SuperPaymaster registration, Staking, Pool management.
*   **`AdminClient`**: DVT aggregations, Slashing, Global protocol parameters.

---

## Installation

```bash
pnpm install @aastar/sdk @aastar/core viem
```

---

## Quick Start

### 1. End User: Gasless Transaction
```typescript
import { createEndUserClient } from '@aastar/sdk';

const user = createEndUserClient({ account, paymasterUrl: '...' });

// Execute gasless via reputation-backed credit
await user.submitGaslessUserOperation({
  target: TARGET_ADDR,
  data: CALL_DATA,
  operator: SP_OPERATOR_ADDR
});
```

### 2. Operator: Onboarding & Staking
```typescript
import { createOperatorClient } from '@aastar/sdk';

const operator = createOperatorClient({ account, chain });

// Handles GToken approval, staking, and paymaster deposit in one L2 workflow
await operator.onboardOperator({
  stakeAmount: parseEther('100'),
  depositAmount: parseEther('10'),
  roleId: 'PAYMASTER_SUPER_ROLE_ID'
});
```

---

## Core Features & Recent Updates (v0.16.23)

- ⛽ **Intelligent Gas Strategy**: Optimized mainnet fees (1.2x boost) vs. reliable testnet floors (0.5 Gwei priority).
- 🔗 **Multi-Chain Ready**: Hardcoded canonical addresses for Sepolia, OP-Sepolia, and **Optimism Mainnet**.
- 🛡️ **DVT-BLS Security**: Supports constant-cost (O(1)) verification for large validator sets.
- 🔁 **Resilient Keeper**: Hardened price updater with 90s `SIGKILL` timeouts and explicit fee estimates.
- 📊 **Analytics First**: Integrated gas analyzer for L1/L2 cost decomposition and ROI reporting.

---

## Testing & Regression

### SDK & Protocol Regression
```bash
# Run all SDK & Protocol tests on Anvil
pnpm run test:full_sdk
pnpm run test:full_anvil
```

### EIP-2537 Precompile Verification
Ensures the target network supports BLS precompiles before deploying DVT modules.
```bash
pnpm run test:eip2537 -- --network op-mainnet
```

---

## 🛡️ Integrity Verification

**Current Code Integrity Hash (v0.16.23)**: `9b02e91aaae2081b68b8ddfcf4c3dd52d450b4f368a8746b5896e0024e441db7`

Run this command to verify (excludes .md files):
```bash
git ls-files -z | grep -zvE '\.md$' | xargs -0 sha256sum | sha256sum
```

---

## 📝 中文版本 / Chinese Version

### 简介
**AAStar SDK** 是 Mycelium 网络的高集成度工具包。它将分散的 AA 基础设施整合为统一、高性能、可验证的开发体验，专为免 Gas 社区经济及自主代理（AI Agents）生态设计。

### 核心特性 (v0.16.23)
- **智能 Gas 策略**：主网使用更精准的 1.2 倍动态费用，测试网保持 0.5 Gwei 底价。
- **L1-L4 分层设计**：从底层合约包装 (L1) 到全场景回归 (L4)，满足不同开发深度需求。
- **主网生产就绪**：内置 Optimism 主网规范合约地址，支持生产环境部署。
- **高可用 Keeper**：增强型价格更新守护进程，具备挂起检测与 Telegram 预警功能。

### 角色客户端
- **`EndUserClient`**: 面向 DApp 开发者，提供免 Gas 交易与信用查询。
- **`CommunityClient`**: 面向社区管理员，支持 xPNTs 部署与身份管理。
- **`OperatorClient`**: 面向节点运营方，支持质押、押金与额度管理。
- **`AdminClient`**: 面向协议管理方，支持 DVT 聚合与全域参数调整。

### 更多文档
- [数据分析报告](./packages/analytics/README.md)
- [价格守护进程 (Keeper) 指南](./docs/guide/keeper.md)
- [完整回归测试计划](./docs/Verifier_L4_Gasless_Plan.md)

---
MIT © AAStar Community / AAStar 社区
