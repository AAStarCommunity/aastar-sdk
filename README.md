# AAStar SDK (Mycelium Network)

<p align="left">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" style="display:inline-block; margin-right: 10px;" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue" alt="TypeScript" style="display:inline-block; margin-right: 10px;" />
  <img src="https://img.shields.io/badge/Status-0.14.0-green" alt="Status" style="display:inline-block;" />
</p>

**Comprehensive Account Abstraction Infrastructure SDK - Powering the Mycelium Network**
**完整的账户抽象基础设施 SDK - 为 Mycelium 网络提供动力**

---

## 📚 Contents / 目录

- [AAStar SDK (Mycelium Network)](#aastar-sdk-mycelium-network)
  - [📚 Contents / 目录](#-contents--目录)
  - [Introduction / 简介](#introduction--简介)
    - [Core Features / 核心特性](#core-features--核心特性)
  - [SDK v2 Architecture / 架构设计](#sdk-v2-architecture--架构设计)
  - [Installation / 安装](#installation--安装)
  - [Quick Start / 快速开始](#quick-start--快速开始)
    - [End User Gasless Transaction / 终端用户 Gasless 流程](#end-user-gasless-transaction--终端用户-gasless-流程)
  - [Testing Commands / 测试命令](#testing-commands--测试命令)
    - [SDK Regression (Using SDK Clients)](#sdk-regression-using-sdk-clients)
    - [Full Protocol Regression (Anvil Dedicated)](#full-protocol-regression-anvil-dedicated)
  - [Academic Research / 学术研究](#academic-research--学术研究)
  - [Support / 支援](#support--支援)

---

## Introduction / 简介

**AAStar SDK** is a high-integration toolkit for the Mycelium network. We've refactored 17 fragmented modules into 7 professional core packages, providing a unified, high-performance, and easy-to-maintain development experience.

**AAStar SDK** 是 Mycelium 网络的高集成度开发工具包。我们将原有的 17 个碎片化模块重构为 7 个专业核心包，旨在提供统一、高性能且易于维护的开发体验。

### Core Features / 核心特性

- ✅ **Role-Based Clients**: Specific APIs for End Users, Communities, Operators, and Admins. (**角色化客户端**)
- ✅ **Infrastructure Ready**: Deep integration with SuperPaymaster and EOA Bridge. (**基础设施就绪**)
- ✅ **Seamless User Experience**: Gasless transactions via community credit system. (**无感交互体验**)
- ✅ **DVT Security Module**: Decentralized verification and aggregate signatures. (**DVT 安全模块**)
- ✅ **Scientific Reproducibility**: Version-locked for academic research. (**科学可复现**)

---

## SDK v2 Architecture / 架构设计

AAStar SDK v2 采用 **「装饰器 (Actions-Decorator)」** 模式。它将低层次的合约交互与高层次的业务逻辑解耦，为生态系统中的四种角色提供专属的 Client 封装。

| Client / 客户端 | Targeted Developer / 目标开发者 | Core Responsibility / 核心职责 |
| :--- | :--- | :--- |
| **`EndUserClient`** | dApp Developer | Gasless UX, Smart Account management, Credit queries |
| **`CommunityClient`** | Community/DAO Admin | Auto-onboarding, xPNTs deployment, SBT & Reputation |
| **`OperatorClient`** | Node/Operator | SuperPaymaster registration, Staking, Pool management |
| **`AdminClient`** | Protocol Admin | DVT aggregations, Slashing, Global parameters |

---

## Installation / 安装

```bash
pnpm install @aastar/sdk @aastar/core viem
```

---

## Quick Start / 快速开始

### End User Gasless Transaction / 终端用户 Gasless 流程

```typescript
import { createEndUserClient } from '@aastar/sdk';

const user = createEndUserClient({ 
  account, 
  paymasterUrl: 'https://paymaster.aastar.io' 
});

// Send sponsored transaction / 使用社区信用代付 Gas
await user.sendGaslessTransaction({
  to: TARGET_ADDR,
  data: CALL_DATA
});
```

---

## Testing Commands / 测试命令

### SDK Regression (Using SDK Clients)
```bash
pnpm run test:full_sdk
```


### Full Protocol Regression (Anvil Dedicated)
```bash
pnpm run test:full_anvil
```

---

## Development Guides / 开发指南

### ABI Maintenance / ABI 维护
- [ABI Maintenance Plan](./docs/ABI_MAINTENANCE_PLAN.md) - 合约 ABI 自动同步和维护策略

---

## Development Workflow / 开发者工作流

A step-by-step guide for contributors from contract modification to Sepolia deployment.

### Step 1: Modify Contracts / 修改合约
Edit Solidity files in `superpaymaster/contracts/src`.
```bash
cd projects/SuperPaymaster
# Edit .sol files...
```

### Step 2: Local Build & Deploy (Anvil) / 本地构建与部署
Auto-start Anvil, compile contracts, deploy, and sync config to SDK.
```bash
cd projects/aastar-sdk
# Runs Anvil + Deploy + Sync .env.anvil
./run_full_regression.sh --env anvil
```

### Step 3: Run Local Tests / 运行本地测试
Validate your changes with the full regression suite.
```bash
# Run all SDK & Protocol tests
./run_sdk_regression.sh
```

### Step 4: Deploy to Sepolia / 部署至 Sepolia
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

### Step 5: Verify on Sepolia / Sepolia 验证
Run the regression suite against the live testnet.
```bash
cd projects/aastar-sdk
./run_full_regression.sh --env sepolia
```


---

## 📊 Gas Analytics & Reporting | Gas 分析与报表
The SDK includes a powerful **Gas Analytics Module** for analyzing Paymaster efficiency, tracking costs, and generating industry comparison reports.
SDK 包含一个强大的 **Gas 分析模块**，用于分析 Paymaster 效率、追踪成本并生成行业对比报告。

### Quick Start | 快速开始
Generate a real-time analysis of recent Sepolia transactions:
生成最近 Sepolia 交易的实时分析：
```bash
npx tsx packages/analytics/src/gas-analyzer-v4.ts
```

### Key Features | 核心功能
- **Double-Layer Analysis (双层分析)**: Intrinsic EVM Efficiency vs. Economic USD Costs
- **Industry Benchmarking (行业对标)**: Compare AAStar vs. Optimism, Alchemy, Pimlico
- **Profit Tracking (利润追踪)**: Transparent breakdown of Protocol Revenue & Profit
- **L2 Simulation (L2 模拟)**: Estimate savings for migrating UserOps to Optimism

👉 **[View Full Analytics Documentation | 查看完整分析文档](./packages/analytics/README.md)**

---

## Academic Research / 学术研究

The SDK supports doctoral data collection for the SuperPaymaster paper. Official experiment logger is available at `scripts/19_sdk_experiment_runner.ts`.

本 SDK 支撑了 SuperPaymaster 论文的博士实验数据采集。官方实验记录器位于 `scripts/19_sdk_experiment_runner.ts`。

- [Stage 3 Scenario Experiment Plan](./docs/STAGE_3_SCENARIO_EXP_PLAN.md)
- [Reputation-to-Credit Mapping Whitepaper](./docs/Reputation-to-Credit_Mapping_Whitepaper.md) - 声誉与信用体系映射技术白皮书

---

## Support / 支援

- **Documentation**: [docs.aastar.io](https://docs.aastar.io)
- **GitHub**: [AAStarCommunity/aastar-sdk](https://github.com/AAStarCommunity/aastar-sdk)

MIT © AAStar Community
