# AAStar SDK
**AAStar: Empower Community, Simplify Development**
<p align="left">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" style="display:inline-block; margin-right: 10px;" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue" alt="TypeScript" style="display:inline-block; margin-right: 10px;" />
  <img src="https://img.shields.io/badge/Status-0.14.0-green" alt="Status" style="display:inline-block;" />
</p>

**Comprehensive Account Abstraction Infrastructure SDK - Mycelium Network Cornerstone**
**完整的账户抽象基础设施 SDK - Mycelium 网络基石**

---

## 📚 Contents / 目录

- [AAStar SDK](#aastar-sdk)
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
  - [Development Guides / 开发指南](#development-guides--开发指南)
    - [ABI Maintenance / ABI 维护](#abi-maintenance--abi-维护)
  - [Development Workflow / 开发者工作流](#development-workflow--开发者工作流)
    - [Step 1: Modify Contracts / 修改合约](#step-1-modify-contracts--修改合约)
    - [Step 2: Local Build \& Deploy (Anvil) / 本地构建与部署](#step-2-local-build--deploy-anvil--本地构建与部署)
    - [Step 3: Run Local Tests / 运行本地测试](#step-3-run-local-tests--运行本地测试)
    - [Step 4: Deploy to Sepolia / 部署至 Sepolia](#step-4-deploy-to-sepolia--部署至-sepolia)
    - [Step 5: Verify on Sepolia / Sepolia 验证](#step-5-verify-on-sepolia--sepolia-验证)
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

Recommended way using the new **PaymasterClient** API (Semantic Helpers):

```typescript
import { PaymasterClient } from '@aastar/sdk';

// 1. Build CallData (e.g., Transfer Token)
const callData = PaymasterClient.encodeExecution(
  tokenAddress,
  0n,
  PaymasterClient.encodeTokenTransfer(recipient, amount)
);

// 2. Submit (Auto Gas Estimation & Signing)
const hash = await PaymasterClient.submitGaslessUserOperation(
  client,
  wallet,
  aaAccount,
  entryPoint,
  paymasterAddress,
  gasTokenAddress,
  bundlerUrl,
  callData
);
```

---

## Testing Commands / 测试命令

### SDK Regression (Using SDK Clients)
```bash
pnpm run test:full_sdk
```

### ABI Alignment & Coverage
```bash
# Audit ABI alignment between Registry.json and core/actions
pnpm run audit:abi

# Run unit tests with coverage report
pnpm run test:coverage
# or for specific packages
pnpm exec vitest run packages --coverage
```


### Full Protocol Regression (Anvil Dedicated)
```bash
pnpm run test:full_anvil
```

---

## Development Guides / 开发指南

### ABI Maintenance / ABI 维护
- [ABI Maintenance Plan](./docs/ABI_MAINTENANCE_PLAN.md) - 合约 ABI 自动同步和维护策略
- [ABI Change Tracking Workflow](./docs/ABI_Change_Tracking_Workflow.md) - ABI 变动追踪与 SDK 自动化审计流程

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

## Academic Research / 学术研究

The SDK supports doctoral data collection for the SuperPaymaster paper. Official experiment logger is available at `scripts/19_sdk_experiment_runner.ts`.

本 SDK 支撑了 SuperPaymaster 论文的博士实验数据采集。官方实验记录器位于 `scripts/19_sdk_experiment_runner.ts`。

- [Stage 3 Scenario Experiment Plan](./docs/STAGE_3_SCENARIO_EXP_PLAN.md)

---

## Support / 支援

- **Documentation**: [docs.aastar.io](https://docs.aastar.io)
- **GitHub**: [AAStarCommunity/aastar-sdk](https://github.com/AAStarCommunity/aastar-sdk)

MIT © AAStar Community
