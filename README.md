
# AAStar SDK (The Mycelium Network)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Status](https://img.shields.io/badge/Status-Beta%20v1.0-green)](https://github.com/AAStarCommunity/aastar-sdk)

**[English Documentation](#english-documentation)** | **[中文文档 (Chinese Documentation)](#chinese-documentation)**

---

<a name="english-documentation"></a>
## 🌍 English Documentation

### Overview
The **AAStar SDK** is the gateway to the Mycelium Network. It abstracts the complexity of 14 core contracts and 72 verified business scenarios into a unified, developer-friendly TypeScript library. 

Whether you are building a DApp, managing a Community, or running a Node, this SDK provides the tools you need.

### 📦 Installation

```bash
pnpm install @aastar/sdk viem
# or
npm install @aastar/sdk viem
```

### 🎯 Role-Based Usage Guide

#### 1. 👤 For DApp Users & Developers
*Goal: Build gasless applications with one-line integration.*

We provide **React Hooks** and **Middleware** to connect your DApp to the SuperPaymaster network effortlessly.

**Capabilities:**
*   **Gas Sponsorship**: Access the `SuperPaymaster` to sponsor transactions.
*   **Credit Check**: View your current real-time credit limit.
*   **Identity**: Mint and manage your Soulbound Token (SBT).

```typescript
// React Component Example
import { useSuperPaymaster, checkEligibility } from '@aastar/react';

function App() {
  const { generatePaymasterAndData } = useSuperPaymaster(config);

  const sendTx = async () => {
    // 1. Check if user has SBT/Credit
    const eligible = await checkEligibility(userAddr);
    
    // 2. Generate Sponsorship Data (Under the hood: calling SuperPaymasterV3)
    const paymasterAndData = await generatePaymasterAndData(userOp);
    
    // 3. Send UserOp...
  }
}
```

#### 2. 🏛️ For Community Managers
*Goal: Manage your DAO's operational capabilities on-chain.*

Use the **Registry** and **Finance** modules to manage roles and fund your operations.

**Capabilities:**
*   **Role Management**: Register members, assign admins.
*   **Treasury Management**: Deposit funds into the Paymaster to sponsor your community's users.

```typescript
import { RegistryClient } from '@aastar/registry';
import { FinanceClient } from '@aastar/finance';

// 1. Manage Roles
await RegistryClient.registerRole(wallet, registryAddr, ROLE_COMMUNITY, userAddr, proof);

// 2. Fund Your Paymaster (Sponsor Gas)
// Supports 'Push Pattern' for tokens like xPNTs
await FinanceClient.depositViaTransferAndCall(wallet, tokenAddr, paymasterAddr, amount);
```

#### 3. 🛡️ For Node Operators & Validators
*Goal: Participate in network security and consensus.*

Use the **DVT** and **Reputation** modules to register your node and participate in slashing consensus.

**Capabilities:**
*   **Validator Registration**: Register your BLS Public Key.
*   **Slash Proposals**: Submit evidence of malicious behavior.
*   **Reputation Sync**: Update off-chain scores to the on-chain Registry.

```typescript
import { DVTClient } from '@aastar/dvt';
import { ReputationClient } from '@aastar/reputation';

// 1. Register as a Validator
await DVTClient.registerValidator(wallet, dvtAddr, blsPublicKey);

// 2. Sync Reputation Scores
await ReputationClient.syncToRegistry(wallet, reputationAddr, users, scores);
```

### 🔬 Research & Internal Tools
*For PhD Data Collection and Protocol Reproducibility.*

This repository includes the scripts used to verify the protocol's 72 business scenarios and collect performance data.

*   **`scripts/19_sdk_experiment_runner.ts`**: The standard Data Recorder for PhD experiments. Generates `sdk_experiment_data.csv`.
*   **`scripts/20_sdk_full_capability.ts`**: A "Day in the Life" simulation exercising every module of the SDK against a local Anvil chain.

```bash
# Run Data Collection Experiment
npx tsx scripts/19_sdk_experiment_runner.ts
```

---

<a name="chinese-documentation"></a>
## 🌏 中文文档 (Chinese Documentation)

### 简介
**AAStar SDK** 是 Mycelium 网络的入口。我们将 14 个核心合约和 72 个经过验证的业务场景封装成了一个统一、对开发者友好的 TypeScript 库。

无论您是构建 DApp、管理社区还是运行节点，此 SDK 都能为您提供所需的工具。

### 📦 安装

```bash
pnpm install @aastar/sdk viem
```

### 🎯 基于角色的使用指南

#### 1. 👤 普通用户与 DApp 开发者
*目标：通过一行代码集成实现无 Gas 应用。*

我们提供 **React Hooks** 和 **Middleware**，帮助您的 DApp 轻松连接到 SuperPaymaster 网络。

**核心能力：**
*   **Gas 代付 (Sponsorship)**：访问 `SuperPaymaster` 赞助交易。
*   **信用检查 (Credit Check)**：查看用户当前的实时信用额度。
*   **身份管理 (Identity)**：铸造和管理您的灵魂绑定代币 (SBT)。

```typescript
// React 组件示例
import { useSuperPaymaster } from '@aastar/react';

// 一键获取 Paymaster 签名数据，无需关心底层 ABI
const { generatePaymasterAndData } = useSuperPaymaster(config);
```

#### 2. 🏛️ 社区运营者 (Community Manager)
*目标：在链上管理您 DAO 的运营能力。*

使用 **Registry (注册表)** 和 **Finance (金融)** 模块来管理角色并为您的运营提供资金。

**核心能力：**
*   **角色管理**：注册成员，分配管理员权限。
*   **国库管理**：向 Paymaster 存入资金，为您的社区用户提供 Gas 赞助支持。

```typescript
import { RegistryClient } from '@aastar/registry';
import { FinanceClient } from '@aastar/finance';

// 1. 注册角色 (例如：添加新成员)
await RegistryClient.registerRole(wallet, registryAddr, ROLE_COMMUNITY, userAddr, proof);

// 2. 存入代付资金 (支持 xPNTs 等需要 Push 模式的代币)
await FinanceClient.depositViaTransferAndCall(wallet, tokenAddr, paymasterAddr, amount);
```

#### 3. 🛡️ 节点运营商与验证者 (Validators)
*目标：参与网络安全和共识。*

使用 **DVT** 和 **Reputation (声誉)** 模块注册您的节点并参与罚没共识。

**核心能力：**
*   **验证者注册**：注册您的 BLS 公钥。
*   **罚没提案 (Slash)**：提交恶意行为证据。
*   **声誉同步**：将链下计算的信誉分同步到链上注册表。

```typescript
import { DVTClient } from '@aastar/dvt';

// 1. 注册为 DVT 验证者
await DVTClient.registerValidator(wallet, dvtAddr, blsPublicKey);
```

### 🔬 研究与内部工具
*用于博士论文数据采集与协议复现。*

本仓库包含了用于验证协议 72 个业务场景并收集性能数据的脚本。这些脚本展示了 SDK 如何支撑复杂的学术验证。

*   **`scripts/19_sdk_experiment_runner.ts`**：标准的实验数据记录器。运行后生成 `sdk_experiment_data.csv`。
*   **`scripts/20_sdk_full_capability.ts`**：全功能模拟脚本。在一个脚本中模拟了 SDK 的所有模块调用流程。

```bash
# 运行数据采集实验
npx tsx scripts/19_sdk_experiment_runner.ts
```
