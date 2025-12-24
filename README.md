
# AAStar SDK (The Mycelium Network)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Status](https://img.shields.io/badge/Status-Beta%20v1.2-green)](https://github.com/AAStarCommunity/aastar-sdk)

**[English Documentation](#english-documentation)** | **[中文文档 (Chinese Documentation)](#chinese-documentation)**

---

<a name="english-documentation"></a>
## 🌍 English Documentation

### Overview
The **AAStar SDK** is the consolidated gateway to the Mycelium Netowrk. We have refactored 17 fragmented modules into 7 professional core packages, providing a unified and high-performance developer experience.

### 📦 Installation

```bash
pnpm install @aastar/sdk viem
```

### 🏛️ Package Architecture

The SDK is organized into focused "buckets" for better maintainability:

| Package | Purpose | Core Features |
| :--- | :--- | :--- |
| **`@aastar/core`** | Infrastructure | ABIs, Addresses, Constants, Client initialization. |
| **`@aastar/paymaster`** | Gas Sponsorship | `AOA` (Legacy V4) and `AOA+` (Credit-based) logics. |
| **`@aastar/account`** | Account Abstraction | ERC-4337 compatible account management and factory binding. |
| **`@aastar/identity`** | Identity | Unified Registry, Reputation scoring, and MySBT verification. |
| **`@aastar/tokens`** | Finance | GToken staking, xPNTs minting, and Token management. |
| **`@aastar/dapp`** | Frontend | React UI components, Arcadia (Game), CometENS (Identity) frameworks. |
| **`@aastar/sdk`** | Meta Package | Re-exports all core packages for seamless usage. |

### 🎯 Developer Usage Guide

#### 1. 👤 Building Consumer DApps
If you want to build a gasless experience for users:
```typescript
import { getPaymasterMiddleware } from '@aastar/paymaster';
import { checkMySBT } from '@aastar/identity';

// Check if user has required SBT before sponsoring
const { hasSBT } = await checkMySBT(client, MySBT_ADDRESS, user);
```

#### 2. 🏛️ Building Admin Dashboards
Manage community roles and treasury:
```typescript
import { RegistryClient } from '@aastar/identity';
import { SuperPaymasterClient } from '@aastar/paymaster';
```

### 🔬 Research & Data Collection
This SDK powers the PhD experiments for the SuperPaymaster paper.
- **`scripts/19_sdk_experiment_runner.ts`**: The official data recorder.
- **`./extract_abis.sh`**: Syncs latest contract interfaces from the protocol core.

---

<a name="chinese-documentation"></a>
## 🌏 中文文档 (Chinese Documentation)

### 简介
**AAStar SDK** 是 Mycelium 网络的高集成度开发入口。我们将原有的 17 个碎片化模块重构为 7 个专业核心包，旨在提供统一、高性能且易于维护的开发体验。

### 📦 安装

```bash
pnpm install @aastar/sdk viem
```

### 🏛️ 架构体系

SDK 采用分类聚合的设计模式，确保各模块职责清晰：

| 包名 | 用途 | 核心功能 |
| :--- | :--- | :--- |
| **`@aastar/core`** | 基础设施 | 合约 ABI、地址集、常量、客户端初始化助手。 |
| **`@aastar/paymaster`** | Gas 赞助 | 同时支持 `AOA` (普通 V4) 和 `AOA+` (基于信用) 的代付逻辑。 |
| **`@aastar/account`** | 账户抽象 | 兼容 ERC-4337 的账户管理、工厂绑定及 AA 逻辑。 |
| **`@aastar/identity`** | 身份体系 | 整合 Registry 注册、Reputation 评分及 MySBT 身份查询。 |
| **`@aastar/tokens`** | 链上金融 | GToken 质押、xPNTs 铸造、APNTs 管理等金融逻辑。 |
| **`@aastar/dapp`** | 前端框架 | React UI 组件、Arcadia 游戏、CometENS 社区架构。 |
| **`@aastar/sdk`** | 汇总入口 | 重新导出上述所有包，实现一站式调用。 |

### 🎯 开发者指南

#### 1. 👤 构建无感 DApp
为普通用户实现免 Gas 持有的流畅体验：
```typescript
import { getPaymasterMiddleware } from '@aastar/paymaster';
import { checkMySBT } from '@aastar/identity';
```

#### 2. 🏛️ 构建管理后台
协助社区管理员管理权限和金库资金：
```typescript
import { ReputationClient } from '@aastar/identity';
import { SuperPaymasterClient } from '@aastar/paymaster';
```

### 🔬 学术研究与数据采集
本 SDK 支撑了 SuperPaymaster 论文的博士实验数据采集：
- **`scripts/19_sdk_experiment_runner.ts`**: 官方实验记录器，生成 `sdk_experiment_data.csv`。
- **`./extract_abis.sh`**: 自动化脚步，用于从协议核心库同步最新的合约 ABIs。
