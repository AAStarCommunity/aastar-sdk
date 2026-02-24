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
- [🧰 Keeper (Service Maintenance)](#-keeper-service-maintenance)
- [Development Workflow](#development-workflow)
- [📊 Gas Analytics & Reporting](#-gas-analytics--reporting)
- [Academic Research](#academic-research)
- [🛡️ Integrity Verification](#️-integrity-verification)
- [📝 中文版本 / Chinese Version](#-中文版本--chinese-version)

---

## Introduction

**AAStar SDK** is a professional-grade toolkit for the Mycelium network. It consolidates fragmented AA infrastructure into a unified, high-performance, and verifiable development experience, specifically designed for gasless community economies and autonomous agent ecosystems.

---

## Architecture (L1-L4 Tiers)

The SDK follows a layered abstraction model to balance control and ease of use:

| Tier | Name | Target | Description |
| :--- | :--- | :--- | :--- |
| **L1** | **Base API** | Protocol Engineers | Raw contract wrappers (Registry, Paymaster, SBT). |
| **L2** | **Workflows** | Integrators | Atomic tasks (e.g., `onboardOperator`, `deployXPNTs`). |
| **L3** | **Scenarios** | dApp Developers | End-to-end journeys (e.g., `submitGaslessUserOperation`). |
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

## 🧰 Keeper (Service Maintenance)

`scripts/keeper.ts` is a production-grade price keeper used to automatically trigger `updatePrice()` when the on-chain price cache is near expiration.

### Key Features
- **Dynamic Monitoring**: Checks `cachedPrice()` vs. Chainlink timestamps.
- **Background Execution**: Supports `--background` mode with logging.
- **Alerting**: Optional Telegram notifications for health beats and anomalies.

### Common Commands
```bash
# Dry run check (No transaction)
pnpm exec tsx scripts/keeper.ts --network op-sepolia --once --dry-run

# Continuous polling (Every 30s)
pnpm exec tsx scripts/keeper.ts --network op-sepolia --poll-interval 30 --safety-margin 600
```

---

## Development Workflow

A step-by-step guide for contributors from contract modification to Sepolia deployment.

### Step 1: Modify Contracts
Edit Solidity files in `superpaymaster/contracts/src`.

### Step 2: Local Build & Deploy (Anvil)
```bash
cd projects/aastar-sdk
./run_full_regression.sh --env anvil
```

### Step 3: Run Local Tests
```bash
./run_sdk_regression.sh
```

### Step 4: Deploy to Sepolia
Configure `.env.sepolia` and run:
```bash
cd projects/SuperPaymaster/contracts
forge script script/DeployV3FullSepolia.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify --resume
```

---

## 📊 Gas Analytics & Reporting

The SDK includes a powerful **Gas Analytics Module** for tracking costs and generating comparison reports.

### Quick Start
```bash
npx tsx packages/analytics/src/gas-analyzer-v4.ts
```
👉 **[View Full Analytics Documentation](./packages/analytics/README.md)**

---

## Academic Research

The SDK supports doctoral data collection for the CommunityFi/SuperPaymaster papers.

- [Stage 3 Scenario Experiment Plan](https://docs.aastar.io/guide/STAGE_3_SCENARIO_EXP_PLAN)
- [Reputation-to-Credit Mapping Whitepaper](https://docs.aastar.io/guide/Reputation-to-Credit_Mapping_Whitepaper)
- **[L3 Complete Walkthrough](../aastar-docs/guide/docs/L3_Complete_Demo_Walkthrough.md)**

---

## 🛡️ Integrity Verification

> [!IMPORTANT]
> **Security First**: To ensure you are using an official release and protect your private keys, always verify the integrity of the SDK code.

**Current Code Integrity Hash (v0.16.23)**: `9b02e91aaae2081b68b8ddfcf4c3dd52d450b4f368a8746b5896e0024e441db7`

```bash
git ls-files -z | grep -zvE '\.md$' | xargs -0 sha256sum | sha256sum
```

---
---

## 📝 中文版本 / Chinese Version

**综合账户抽象基础设施 SDK - 为 Mycelium 网络提供核心动力**

---

### 📚 目录

- [简介](#简介)
- [架构设计 (L1-L4 分层)](#架构设计-l1-l4-分层)
- [安装](#安装)
- [快速开始](#快速开始-1)
- [🧰 Keeper (服务维护)](#-keeper-服务维护)
- [开发工作流](#开发工作流)
- [📊 Gas 数据分析与报告](#-gas-数据分析与报告)
- [学术研究](#学术研究-1)
- [🛡️ 源码完整性校验](#️-源码完整性校验)

---

### 简介
**AAStar SDK** 是 Mycelium 网络的高集成度专业工具包。它将分散的 AA 基础设施整合为统一、高性能、可验证的开发体验，专为免 Gas 社区经济及自主代理（AI Agents）生态设计。

---

### 架构设计 (L1-L4 分层)
SDK 采用分层抽象模型，平衡了控制灵活性与易用性：

| 层级 | 名称 | 目标群体 | 描述 |
| :--- | :--- | :--- | :--- |
| **L1** | **基础 API** | 协议工程师 | 原始合约包装器 (Registry, Paymaster, SBT)，直接映射 Solidity 函数。 |
| **L2** | **工作流** | 集成方 | 组合多个调用的原子任务 (如：`onboardOperator`, `deployXPNTs`)。 |
| **L3** | **业务场景** | DApp 开发者 | 端到端用户流程 (如：`submitGaslessUserOperation`)。 |
| **L4** | **回归测试** | QA / 研究员 | 在 Anvil 或 Optimism 主网进行的系统全生命周期验证。 |

#### 角色化客户端
- **`EndUserClient`**: 面向 DApp 开发者，提供免 Gas 交互、智能账户管理与信用查询。
- **`CommunityClient`**: 面向社区/DAO 管理员，支持自动入驻、xPNTs 部署与身份名誉管理。
- **`OperatorClient`**: 面向节点运营方，支持 SuperPaymaster 注册、质押与资金池管理。
- **`AdminClient`**: 面向协议管理方，支持 DVT 聚合、罚没机制与全局参数调整。

---

### 安装
```bash
pnpm install @aastar/sdk @aastar/core viem
```

---

### 快速开始

#### 1. End User: 免 Gas 交易
```typescript
import { createEndUserClient } from '@aastar/sdk';
const user = createEndUserClient({ account, paymasterUrl: '...' });

// 通过基于名誉的信用限额执行免 Gas 交易
await user.submitGaslessUserOperation({
  target: TARGET_ADDR,
  data: CALL_DATA,
  operator: SP_OPERATOR_ADDR
});
```

#### 2. Operator: 入驻与质押
```typescript
import { createOperatorClient } from '@aastar/sdk';
const operator = createOperatorClient({ account, chain });

// 在一个 L2 工作流中完成 GToken 授权、质押和 Paymaster 存款
await operator.onboardOperator({
  stakeAmount: parseEther('100'),
  depositAmount: parseEther('10'),
  roleId: 'PAYMASTER_SUPER_ROLE_ID'
});
```

---

### 🧰 Keeper (服务维护)

`scripts/keeper.ts` 是生产级的价格守护进程，用于在链上价格缓存临近过期时自动触发 `updatePrice()`。

#### 核心特性
- **动态监控**：检查 `cachedPrice()` 与 Chainlink 时间戳。
- **后台运行**：支持 `--background` 模式并记录日志。
- **预警通知**：支持通过 Telegram 发送心跳通知与异常告警。

#### 常用命令
```bash
# 只读检查 (不发送交易)
pnpm exec tsx scripts/keeper.ts --network op-sepolia --once --dry-run

# 持续轮询 (每 30 秒)
pnpm exec tsx scripts/keeper.ts --network op-sepolia --poll-interval 30 --safety-margin 600
```

---

### 开发工作流

本文档为贡献者提供了从合约修改到 Sepolia 部署的逐步指南。

#### 第 1 步：修改合约
在 `superpaymaster/contracts/src` 中编辑 Solidity 文件。

#### 第 2 步：本地构建与部署 (Anvil)
```bash
cd projects/aastar-sdk
./run_full_regression.sh --env anvil
```

#### 第 3 步：运行本地测试
```bash
./run_sdk_regression.sh
```

#### 第 4 步：部署到 Sepolia
配置 `.env.sepolia` 并运行：
```bash
cd projects/SuperPaymaster/contracts
forge script script/DeployV3FullSepolia.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify --resume
```

---

### 📊 Gas 数据分析与报告

SDK 包含强大的 **Gas 分析模块**，用于追踪成本并生成行业对比报告。

#### 快速开始
```bash
npx tsx packages/analytics/src/gas-analyzer-v4.ts
```
👉 **[查看完整分析文档](./packages/analytics/README.md)**

---

### 学术研究

本 SDK 支持面向 CommunityFi/SuperPaymaster 论文的博士实验数据采集。

- [Stage 3 场景实验计划](https://docs.aastar.io/guide/STAGE_3_SCENARIO_EXP_PLAN)
- [名誉到信用映射白皮书](https://docs.aastar.io/guide/Reputation-to-Credit_Mapping_Whitepaper)
- **[L3 完整演示手册](../aastar-docs/guide/docs/L3_Complete_Demo_Walkthrough.md)**

---

### 🛡️ 源码完整性校验

> [!IMPORTANT]
> **安全第一**：为确保您使用的是官方发布版本并保护您的私钥，请务必验证 SDK 源码的完整性。

**当前代码哈希 (v0.16.23)**：`9b02e91aaae2081b68b8ddfcf4c3dd52d450b4f368a8746b5896e0024e441db7`

```bash
git ls-files -z | grep -zvE '\.md$' | xargs -0 sha256sum | sha256sum
```

---
MIT © AAStar Community / AAStar 社区
