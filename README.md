# AAStar SDK (Mycelium Network)

<p align="left">
  <img src="https://img.shields.io/npm/v/@aastar/sdk?color=blue&label=npm" alt="npm version" style="display:inline-block; margin-right: 5px;" />
  <img src="https://img.shields.io/badge/pnpm-only-orange" alt="pnpm" style="display:inline-block; margin-right: 5px;" />
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" style="display:inline-block; margin-right: 5px;" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue" alt="TypeScript" style="display:inline-block; margin-right: 5px;" />
  <img src="https://img.shields.io/badge/ERC--4337-ready-brightgreen" alt="ERC-4337" style="display:inline-block; margin-right: 5px;" />
  <img src="https://img.shields.io/badge/Optimism-Mainnet-red" alt="Optimism Mainnet" style="display:inline-block; margin-right: 5px;" />
  <img src="https://img.shields.io/badge/Status-v0.17.1-green" alt="Status" style="display:inline-block;" />
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
- [📂 Core Documentation Index](#-core-documentation-index)
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
*   **`AirAccount (YAAAClient / YAAAServerClient)`**: ERC-4337 smart accounts with KMS WebAuthn passkeys, BLS aggregate signatures, and tiered signature routing for AI agents and dApps.

---

## Installation

```bash
pnpm install @aastar/sdk @aastar/core viem

# For AI Agent / AirAccount features (browser or server)
pnpm install @aastar/airaccount
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

### 3. AirAccount: Smart Account with Passkey (Browser)
```typescript
import { YAAAClient } from '@aastar/airaccount';

const yaaa = new YAAAClient({
  apiURL: 'https://api.your-backend.com/v1',
  tokenProvider: () => localStorage.getItem('token'),
  bls: { seedNodes: ['https://signer1.aastar.io'] },
});

// Register with KMS-backed passkey (biometric)
const { user, token } = await yaaa.passkey.register({
  email: 'user@example.com',
  username: 'JohnDoe',
});

// Verify a transaction with passkey
const verification = await yaaa.passkey.verifyTransaction({
  to: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  value: '0.01',
});
```

### 4. AirAccount: Smart Account with Tiered Signatures (Server / AI Agent)
```typescript
import { YAAAServerClient, MemoryStorage, LocalWalletSigner } from '@aastar/airaccount/server';

const client = new YAAAServerClient({
  rpcUrl: 'https://optimism.rpc-url',
  bundlerRpcUrl: 'https://bundler-url',
  chainId: 10,
  entryPoints: {
    v07: {
      entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
      factoryAddress: '0x914db0a849f55e68a726c72fd02b7114b1176d88',
    },
  },
  defaultVersion: '0.7',
  storage: new MemoryStorage(),
  signer: new LocalWalletSigner('0xYOUR_PRIVATE_KEY'),
});

// Create a smart account for an AI agent
const account = await client.accounts.createAccount('agent-001');

// Execute a gasless transfer (Tier 1: ECDSA for small amounts)
const result = await client.transfers.executeTransfer('agent-001', {
  to: '0xRecipient',
  amount: '0.01',
  usePaymaster: true,
});
```

> **Signature Tiers (M4 AirAccount)**
> | Tier | Components | Use Case |
> | --- | --- | --- |
> | 1 | Raw ECDSA | Small transactions |
> | 2 | P256 + BLS aggregate | Medium transactions |
> | 3 | P256 + BLS + Guardian | Large / high-value |

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

## 📂 Core Documentation Index

To ensure seamless navigation and rapid reference, **all critical documentation** is stored locally in the `docs/` folder instead of requiring external web access.

🌐 **Online Documentation Site:** For a fully structured and searchable reading experience, you can also visit: [docs.aastar.io](https://docs.aastar.io)

### 🏛 Architecture & APIs
- **[SDK API Reference & Architecture (L1-L4)](./docs/API_REFERENCE.md)**
- [L2 Business Clients Plan](./docs/L2_BUSINESS_CLIENTS_PLAN.md)
- [L3 Lifecycle Patterns Design](./docs/L3_Lifecycle_Patterns_Design.md)
- [L3 Lifecycle Developer Guide](./docs/L3_Lifecycle_Developer_Guide.md)
- [L3 Complete Walkthrough](./docs/L3_Complete_Demo_Walkthrough.md)
- [L3 Use Case Analysis](./docs/L3_Use_Case_Analysis.md)
- [Account Initialization Guide](./docs/Account_Initialization_Guide_CN.md)
- [Demo Refactor Plan](./docs/DEMO_REFACTOR_PLAN.md)
- [Technical Architecture Plan](./docs/technical_plan.md)
- [Documentation Plan](./docs/DOCUMENTATION_PLAN.md)

### 🧪 Configuration & Testing
- **[Configuration Sync Guide](./docs/Configuration_Sync.md)** *(Explains Integrity Hash generation)*
- **[Full L4 Test Regression Plan](./docs/Verifier_L4_Gasless_Plan.md)** *(Gasless Verifier workflow)*
- [SDK Regression & API Plan](./docs/SDK_REGRESSION_AND_API_PLAN.md)
- [SDK Coverage Strategy](./docs/SDK_COVERAGE_STRATEGY.md)
- [TODO: SDK Coverage](./docs/TODO_SDK_COVERAGE.md)
- [Manual Test CheatSheet](./docs/L4_Manual_Test_CheatSheet.md)
- [Environment Update Guide (Sepolia)](./docs/ENV_SEPOLIA_UPDATE.md)
- [ABI Maintenance Plan](./docs/ABI_MAINTENANCE_PLAN.md)
- [Sepolia Verified Contracts](./docs/verify.sepolia.contracts.md) / [OP-Sepolia Verified Contracts](./docs/verify.op-sepolia.contracts.md)

### 📊 Gas Analytics & Research
- **[🚀 OP Mainnet Gas Analysis Report](./packages/analytics/docs/OP_Mainnet_Gas_Analysis_Report.md)**
- **[Reputation-to-Credit Mapping Whitepaper](./docs/Reputation-to-Credit_Mapping_Whitepaper.md)**
- [DAO Mining Distribution Plan](./docs/DAO_Mining_Distribution_Plan.md)
- [Academic Application: Paper Data Collection](./docs/paper-data-collection.md)
- [Stage 3 Scenario Experiment Plan](./docs/SDK_STAGE3_PLAN.md) / [Stage 3 Analysis](./docs/SDK_STAGE3_ANALYSIS.md)

---

## 🛡️ Integrity Verification

> [!IMPORTANT]
> **Security First**: To ensure you are using an official release and protect your private keys, always verify the integrity of the SDK code.

**Current Code Integrity Hash (v0.17.1)**: `9b02e91aaae2081b68b8ddfcf4c3dd52d450b4f368a8746b5896e0024e441db7`

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
- [📂 核心文档索引](#-核心文档索引)
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
- **`AirAccount (YAAAClient / YAAAServerClient)`**: 面向 AI Agent 与 Web3 应用，提供 KMS WebAuthn Passkey 认证、BLS 聚合签名、分层签名路由与 ERC-4337 智能账户。

---

### 安装
```bash
pnpm install @aastar/sdk @aastar/core viem

# AI Agent / AirAccount 功能（浏览器或服务端）
pnpm install @aastar/airaccount
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

#### 3. AirAccount: Passkey 智能账户（浏览器）
```typescript
import { YAAAClient } from '@aastar/airaccount';

const yaaa = new YAAAClient({
  apiURL: 'https://api.your-backend.com/v1',
  tokenProvider: () => localStorage.getItem('token'),
  bls: { seedNodes: ['https://signer1.aastar.io'] },
});

// 使用 KMS Passkey（生物识别）注册
const { user, token } = await yaaa.passkey.register({
  email: 'user@example.com',
  username: 'JohnDoe',
});

// 使用 Passkey 验证交易
const verification = await yaaa.passkey.verifyTransaction({
  to: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  value: '0.01',
});
```

#### 4. AirAccount: 分层签名智能账户（服务端 / AI Agent）
```typescript
import { YAAAServerClient, MemoryStorage, LocalWalletSigner } from '@aastar/airaccount/server';

const client = new YAAAServerClient({
  rpcUrl: 'https://optimism.rpc-url',
  bundlerRpcUrl: 'https://bundler-url',
  chainId: 10,
  entryPoints: {
    v07: {
      entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
      factoryAddress: '0x914db0a849f55e68a726c72fd02b7114b1176d88',
    },
  },
  defaultVersion: '0.7',
  storage: new MemoryStorage(),
  signer: new LocalWalletSigner('0xYOUR_PRIVATE_KEY'),
});

// 为 AI Agent 创建智能账户
const account = await client.accounts.createAccount('agent-001');

// 执行免 Gas 转账（Tier 1：小额 ECDSA）
const result = await client.transfers.executeTransfer('agent-001', {
  to: '0xRecipient',
  amount: '0.01',
  usePaymaster: true,
});
```

> **M4 AirAccount 分层签名说明**
> | 层级 | 签名组合 | 适用场景 |
> | --- | --- | --- |
> | Tier 1 | 原始 ECDSA | 小额交易 |
> | Tier 2 | P256 + BLS 聚合 | 中等金额 |
> | Tier 3 | P256 + BLS + Guardian | 大额 / 高价值 |

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

### 📂 核心文档索引

为了确保您可以快速查阅与定位问题，**所有核心文档**均直接保存在项目本地的 `docs/` 文件夹中。您无需跳转外部链接即可深入了解 SDK 的底层机制。

🌐 **在线文档站点：** 若需更完善的侧边栏索引与搜索体验，您也可以访问官方站点：[docs.aastar.io](https://docs.aastar.io)

#### 🏛 架构与 API
- **[SDK 架构基准与 API 参考 (L1-L4)](./docs/API_REFERENCE.md)**
- [L2 业务客户端演进计划](./docs/L2_BUSINESS_CLIENTS_PLAN.md)
- [L3 全生命周期模式设计](./docs/L3_Lifecycle_Patterns_Design.md)
- [L3 开发者指南](./docs/L3_Lifecycle_Developer_Guide.md)
- [L3 完整演练指南](./docs/L3_Complete_Demo_Walkthrough.md)
- [L3 业务场景与缺口分析](./docs/L3_Use_Case_Analysis.md)
- [首发账户初始化指南](./docs/Account_Initialization_Guide_CN.md)
- [Demo 重构计划](./docs/DEMO_REFACTOR_PLAN.md)
- [技术架构演进方案](./docs/technical_plan.md)
- [文档建设体系计划](./docs/DOCUMENTATION_PLAN.md)

#### 🧪 配置与测试
- **[环境配置与哈希同步机制 (Configuration Sync)](./docs/Configuration_Sync.md)** *(含版本哈希防篡改机制说明)*
- **[L4 级别回归测试方案 (免 Gas 验证器)](./docs/Verifier_L4_Gasless_Plan.md)** *(项目最重要的测试准则)*
- [SDK 回归测试与 API 计划](./docs/SDK_REGRESSION_AND_API_PLAN.md)
- [SDK 测试覆盖率策略](./docs/SDK_COVERAGE_STRATEGY.md)
- [待办：SDK 测试覆盖](./docs/TODO_SDK_COVERAGE.md)
- [手动调试速查表](./docs/L4_Manual_Test_CheatSheet.md)
- [环境配置更新指南 (Sepolia)](./docs/ENV_SEPOLIA_UPDATE.md)
- [合约 ABI 维护计划](./docs/ABI_MAINTENANCE_PLAN.md)
- [Sepolia 已验证合约地址](./docs/verify.sepolia.contracts.md) / [OP-Sepolia 已验证合约地址](./docs/verify.op-sepolia.contracts.md)

#### 📊 Gas 数据与学术研究
- **[🚀 OP 主网 Gas 数据分析报告](./packages/analytics/docs/OP_Mainnet_Gas_Analysis_Report.md)**
- **[名誉到信用映射白皮书](./docs/Reputation-to-Credit_Mapping_Whitepaper.md)**
- [DAO 挖矿与分发机制设计](./docs/DAO_Mining_Distribution_Plan.md)
- [学术研究：论文数据采集](./docs/paper-data-collection.md)
- [Stage 3 场景实验计划](./docs/SDK_STAGE3_PLAN.md) / [Stage 3 结论分析](./docs/SDK_STAGE3_ANALYSIS.md)

---

### 🛡️ 源码完整性校验

> [!IMPORTANT]
> **安全第一**：为确保您使用的是官方发布版本并保护您的私钥，请务必验证 SDK 源码的完整性。

**当前代码哈希 (v0.17.1)**：`9b02e91aaae2081b68b8ddfcf4c3dd52d450b4f368a8746b5896e0024e441db7`

```bash
git ls-files -z | grep -zvE '\.md$' | xargs -0 sha256sum | sha256sum
```

---
MIT © AAStar Community / AAStar 社区
