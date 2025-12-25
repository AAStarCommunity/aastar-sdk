# 开始使用 (Getting Started)

<p align="left">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" style="display:inline-block; margin-right: 10px;" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue" alt="TypeScript" style="display:inline-block; margin-right: 10px;" />
  <img src="https://img.shields.io/badge/Status-0.14.0-green" alt="Status" style="display:inline-block;" />
</p>

**完整的账户抽象基础设施 SDK - 为 Mycelium 网络提供动力**

---

## 📚 目录

- [简介](#简介)
- [SDK v2 架构设计](#sdk-v2-架构设计)
- [安装](#安装)
- [快速开始](#快速开始)
- [测试命令](#测试命令)
- [开发指南](#开发指南)
- [学术研究](#学术研究)

---

## 简介 (Introduction)

**AAStar SDK** 是 Mycelium 网络的高集成度开发工具包。我们将原有的 17 个碎片化模块重构为 7 个专业核心包，旨在提供统一、高性能且易于维护的开发体验。

### 核心特性

- ✅ **角色化客户端**: 为终端用户、社区、运营商和协议管理员提供专属 API
- ✅ **基础设施就绪**: 深度集成 SuperPaymaster 与 EOA Rainbow Bridge
- ✅ **无感交互体验**: 基于社区信用系统的 Gasless 交易
- ✅ **DVT 安全模块**: 去中心化验证与聚合签名
- ✅ **科学可复现**: 锁定依赖版本，支持学术论文数据采集

---

## SDK v2 架构设计

AAStar SDK v2 采用 **「装饰器 (Actions-Decorator)」** 模式（借鉴自 `viem` 与 `permissionless.js`）。它将低层次的合约交互与高层次的业务逻辑解耦，为生态系统中的四种角色提供专属的 Client 封装。

### 核心理念

- **语义化 Action**: 将复杂流程（如「运营商入驻」）封装为单次 SDK 调用
- **Provider 无关性**: 完美适配任何 `viem` 传输层（Pimlico, Alchemy 或本地 Anvil）
- **安全加固**: 锁定依赖版本并实施自动化供应链审计

### 角色化 API 矩阵

| 客户端 | 目标开发者 | 核心职责 |
| :--- | :--- | :--- |
| **`EndUserClient`** | dApp 开发者 | 核心账户抽象交互、Gasless UX、查询信用状态 |
| **`CommunityClient`** | 社区/DAO 管理者 | 自动化入驻、部署 xPNTs 代币、配置 SBT 规则 |
| **`OperatorClient`** | 节点/运营商 | SuperPaymaster 注册与质押、资金池管理 |
| **`AdminClient`** | 协议维护者 | 提交 DVT 聚合签名、执行奖惩、调整全局参数 |

---

## 安装 (Installation)

```bash
pnpm install @aastar/sdk @aastar/core viem
```

---

## 快速开始 (Quick Start)

### 基础示例 (Operator)

```typescript
import { createOperatorClient } from '@aastar/sdk';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { http } from 'viem';

// 创建运营商客户端
const operatorClient = createOperatorClient({
  chain: foundry,
  transport: http('http://127.0.0.1:8545'),
  account: privateKeyToAccount('0x...'),
});

// 一键入驻 SuperPaymaster（质押 + 存款）
await operatorClient.onboardToSuperPaymaster({
  stakeAmount: parseEther('50'),
  depositAmount: parseEther('50')
});
```

---

## 核心测试场景 (Core Testing)

本项目提供两套完整的回归测试。

### SDK 回归测试（使用 SDK 客户端）

```bash
pnpm run test:full_sdk
```

- **测试场景**:
  - ✅ Operator Staking (质押)
  - ✅ Paymaster Deposit (存款)
  - ✅ Community Registration (社区注册)
  - ✅ SBT Minting (SBT 铸造)
  - ✅ Admin Slashing (惩罚)
  - ✅ Credit Query (信用查询)

### 完整协议回归测试（Anvil 专用，72 场景）

```bash
pnpm run test:full_anvil
```

---

## 学术研究 (Research)

本 SDK 支撑了 SuperPaymaster 论文的博士实验数据采集：

- **`scripts/19_sdk_experiment_runner.ts`**: 官方实验记录器
- **覆盖率**: 95% 用户用例分支，72 个完整场景

---

## 支持与贡献 (Support)

- **代码仓库**: [AAStarCommunity/aastar-sdk](https://github.com/AAStarCommunity/aastar-sdk)
- **Discord**: [加入我们的社区](https://discord.gg/aastar)
- **许可证**: MIT
