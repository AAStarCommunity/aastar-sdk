
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

### 🎯 Role-Based Usage Guide (For Developers)

The SDK enables developers to build tools for the following roles:

#### 1. 👤 Building for DApp Users (Ordinary Users)
*Scenario: A user wants to use a DApp without gas or technical friction.*

**Developer Goal**: Integrate `useSuperPaymaster` to make transactions gasless and invisible.

**Capabilities Exposed:**
*   **Gas Sponsorship**: Access the `SuperPaymaster`.
*   **Credit Check**: Display user's real-time credit.
*   **Identity**: Mint SBTs for users.

```typescript
// React Component Example
import { useSuperPaymaster, checkEligibility } from '@aastar/react';

function App() {
  const { generatePaymasterAndData } = useSuperPaymaster(config);
  // ...
}
```

#### 2. 🏛️ Building for Community Managers
*Scenario: A DAO Admin needs a dashboard to manage roles and funds.*

**Developer Goal**: Use `@aastar/registry` and `@aastar/finance` to build an Admin Dashboard.

**Capabilities Exposed:**
*   **Role Management**: Register members/admins.
*   **Treasury Management**: Deposit Paymaster funds.

```typescript
import { RegistryClient } from '@aastar/registry';
// ...
```

#### 3. 🛡️ Building for Node Operators
*Scenario: A Node Operator needs a CLI or Script to manage their validator.*

**Developer Goal**: specific automation scripts using `@aastar/dvt`.

**Capabilities Exposed:**
*   **Validator Registration**: Register BLS Keys.
*   **Slash Proposals**: Submit evidence.

```typescript
import { DVTClient } from '@aastar/dvt';
// ...
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

### 🎯 基于角色的使用指南 (开发者向)

SDK 旨在赋能开发者为以下角色构建工具：

#### 1. 👤 为用户开发 DApp (Ordinary Users)
*场景：普通用户希望无感知地使用 DApp，无需持有 Gas。*

**开发者目标**：集成 `useSuperPaymaster` 实现无 Gas 交易。

**核心能力：**
*   **Gas 代付**：调用 `SuperPaymaster`。
*   **信用检查**：展示用户额度。
*   **身份管理**：SBT 铸造。

```typescript
// React 组件示例
import { useSuperPaymaster } from '@aastar/react';
// ...
```

#### 2. 🏛️ 为社区管理者开发后台 (Community Managers)
*场景：DAO 管理员需要一个 Dashboard 来管理成员和资金。*

**开发者目标**：使用 `@aastar/registry` 和 `@aastar/finance` 构建管理后台。

**核心能力：**
*   **角色管理**：注册成员/管理员。
*   **国库管理**：存入代付资金。

```typescript
import { RegistryClient } from '@aastar/registry';
// ...
```

#### 3. 🛡️ 为节点运营者开发工具 (Node Operators)
*场景：节点运营者需要脚本来自动化注册和维护节点。*

**开发者目标**：使用 `@aastar/dvt` 编写运维脚本。

**核心能力：**
*   **验证者注册**：注册 BLS 公钥。
*   **罚没提案**：提交证据。

```typescript
import { DVTClient } from '@aastar/dvt';
// ...
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
