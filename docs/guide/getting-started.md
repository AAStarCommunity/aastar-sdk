# Getting Started

<p align="left">
  <img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="License: Apache 2.0" style="display:inline-block; margin-right: 10px;" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue" alt="TypeScript" style="display:inline-block; margin-right: 10px;" />
  <img src="https://img.shields.io/badge/Status-v0.16.23-green" alt="Status" style="display:inline-block;" />
</p>

**Comprehensive Account Abstraction Infrastructure SDK - Powering the Mycelium Network**
**完整的账户抽象基础设施 SDK - 为 Mycelium 网络提供动力**

---

## AAStar SDK (Mycelium Network)

## 📚 Contents
- [Introduction](#introduction)
- [Core Features](#core-features)
- [SDK v2 Architecture](#sdk-v2-architecture)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Testing Commands / 测试命令](#testing-commands--测试命令)
- [Academic Research / 学术研究](#academic-research--学术研究)

---

## Introduction

**AAStar SDK** is a high-integration toolkit for the Mycelium network. We've refactored 17 fragmented modules into 7 professional core packages, aimed at providing a unified, high-performance, and easy-to-maintain development experience.

**AAStar SDK** 是 Mycelium 网络的高集成度开发工具包。我们将原有的 17 个碎片化模块重构为 7 个专业核心包，旨在提供统一、高性能且易于维护的开发体验。

### Core Features / 核心特性

- ✅ **Role-Based Clients**: Specific APIs for End Users, Communities, Operators, and Admins. (**角色化客户端**)
- ✅ **Infrastructure Ready**: Deep integration with SuperPaymaster and EOA Bridge. (**基础设施就绪**)
- ✅ **Seamless User Experience**: Gasless transactions via community credit system. (**无感交互体验**)
- ✅ **DVT Security Module**: Decentralized verification and aggregate signatures. (**DVT 安全模块**)
- ✅ **Scientific Reproducibility**: Version-locked for academic research and data collection. (**科学可复现**)

---

## SDK v2 Architecture / 架构设计

AAStar SDK v2 采用 **「装饰器 (Actions-Decorator)」** 模式（借鉴自 `viem` 与 `permissionless.js`）。它将低层次的合约交互与高层次的业务逻辑解耦，为生态系统中的四种角色提供专属的 Client 封装。

### Core Concepts / 核心理念

- **Semantic Actions**: Encapsulate complex flows (e.g., "Operator Onboarding") into a single SDK call. (**语义化 Action**)
- **Provider Agnostic**: Perfectly fits any `viem` transport layer (Pimlico, Alchemy, or local Anvil). (**Provider 无关性**)
- **Security Hardened**: Locked dependency versions and automated supply chain audits. (**安全加固**)

### Role-Based API Matrix / 角色化 API 矩阵

| Client / 客户端 | Targeted Developer / 目标开发者 | Core Responsibility / 核心职责 |
| :--- | :--- | :--- |
| **`EndUserClient`** | dApp Developer | Gasless UX, Smart Account management, Credit queries |
| **`CommunityClient`** | Community/DAO Admin | Auto-onboarding, xPNTs deployment, SBT & Reputation |
| **`OperatorClient`** | Node/Operator | SuperPaymaster registration, Staking, Pool management |
| **`AdminClient`** | Protocol Admin | DVT aggregations, Slashing, Global parameters |

---

```bash
pnpm install @aastar/sdk @aastar/core viem
```

### 🛡️ Integrity Verification / 完整性校验

> [!IMPORTANT]
> **Security Check / 安全检查**: Before using the SDK, verify that the downloaded source code matches the official release hash.
> 在使用 SDK 之前，请务必验证下载的源码是否与官方发布哈希一致。

Run this command in your project root / 在项目根目录运行：
```bash
git ls-files -z | grep -zvE '\.md$' | xargs -0 sha256sum | sha256sum
```
**Expected Hash for v0.39.3**: `039e5d641444d93e8158034e3fd0c9b799a9e1ac813028a3f54189295a4ec282`

---

## Quick Start / 快速开始

### Basic Example (Operator) / 基础示例 (运营商)

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
// 一键入驻 SuperPaymaster（质押 + 存款）
await operatorClient.onboardToSuperPaymaster({
  stakeAmount: parseEther('50'),
  depositAmount: parseEther('50')
});
```

---

## Testing Commands / 测试命令

本项目提供两套完整的回归测试。

### SDK Regression (Using SDK Clients) / SDK 回归测试
```bash
pnpm run test:full_sdk
```

- **Scenario**:
  - ✅ Operator Staking (质押)
  - ✅ Paymaster Deposit (存款)
  - ✅ Community Registration (社区注册)
  - ✅ SBT Minting (SBT 铸造)
  - ✅ Admin Slashing (奖励)
  - ✅ Credit Query (信用查询)

### Full Protocol Regression (Anvil Dedicated) / 完整协议回归测试
```bash
pnpm run test:full_anvil
```

---

## Academic Research / 学术研究

The SDK supports doctoral data collection for the SuperPaymaster paper. Official experiment logger is available at `scripts/19_sdk_experiment_runner.ts`.

本 SDK 支撑了 SuperPaymaster 论文的博士实验数据采集。官方实验记录器位于 `scripts/19_sdk_experiment_runner.ts`。

---

## Support & Contributing / 支持与贡献

- **Repository / 代码仓库**: [AAStarCommunity/aastar-sdk](https://github.com/AAStarCommunity/aastar-sdk)
- **Discord**: [Join our community / 加入我们的社区](https://discord.gg/aastar)
- **License / 许可证**: Apache-2.0
