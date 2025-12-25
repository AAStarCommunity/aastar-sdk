# AAStar SDK (Mycelium Network)

<p align="left">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" style="display:inline-block; margin-right: 10px;" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue" alt="TypeScript" style="display:inline-block; margin-right: 10px;" />
  <img src="https://img.shields.io/badge/Status-0.14.0-green" alt="Status" style="display:inline-block;" />
</p>

**Comprehensive Account Abstraction Infrastructure SDK - Powering the Mycelium Network**
**完整的賬戶抽象基礎設施 SDK - 為 Mycelium 網絡提供動力**

---

## 📚 Contents / 目錄

- [AAStar SDK (Mycelium Network)](#aastar-sdk-mycelium-network)
  - [📚 Contents / 目錄](#-contents--目錄)
  - [Introduction / 簡介](#introduction--簡介)
    - [Core Features / 核心特性](#core-features--核心特性)
  - [SDK v2 Architecture / 架構設計](#sdk-v2-architecture--架構設計)
  - [Installation / 安裝](#installation--安裝)
  - [Quick Start / 快速開始](#quick-start--快速開始)
    - [End User Gasless Transaction / 終端用戶 Gasless 流程](#end-user-gasless-transaction--終端用戶-gasless-流程)
  - [Testing Commands / 測試命令](#testing-commands--測試命令)
    - [SDK Regression (Using SDK Clients)](#sdk-regression-using-sdk-clients)
    - [Full Protocol Regression (Anvil Dedicated)](#full-protocol-regression-anvil-dedicated)
  - [Academic Research / 學術研究](#academic-research--學術研究)
  - [Support / 支援](#support--支援)

---

## Introduction / 簡介

**AAStar SDK** is a high-integration toolkit for the Mycelium network. We've refactored 17 fragmented modules into 7 professional core packages, providing a unified, high-performance, and easy-to-maintain development experience.

**AAStar SDK** 是 Mycelium 網絡的高集成度開發工具包。我們將原有的 17 個碎片化模塊重構為 7 個專業核心包，旨在提供統一、高性能且易於維護的開發體驗。

### Core Features / 核心特性

- ✅ **Role-Based Clients**: Specific APIs for End Users, Communities, Operators, and Admins. (**角色化客戶端**)
- ✅ **Infrastructure Ready**: Deep integration with SuperPaymaster and EOA Bridge. (**基礎設施就緒**)
- ✅ **Seamless User Experience**: Gasless transactions via community credit system. (**無感交互體驗**)
- ✅ **DVT Security Module**: Decentralized verification and aggregate signatures. (**DVT 安全模塊**)
- ✅ **Scientific Reproducibility**: Version-locked for academic research. (**科學可複現**)

---

## SDK v2 Architecture / 架構設計

AAStar SDK v2 採用 **「裝飾器 (Actions-Decorator)」** 模式。它將低層次的合約交互與高層次的業務邏輯解耦，為生態系統中的四種角色提供專屬的 Client 封裝。

| Client / 客戶端 | Targeted Developer / 目標開發者 | Core Responsibility / 核心職責 |
| :--- | :--- | :--- |
| **`EndUserClient`** | dApp Developer | Gasless UX, Smart Account management, Credit queries |
| **`CommunityClient`** | Community/DAO Admin | Auto-onboarding, xPNTs deployment, SBT & Reputation |
| **`OperatorClient`** | Node/Operator | SuperPaymaster registration, Staking, Pool management |
| **`AdminClient`** | Protocol Admin | DVT aggregations, Slashing, Global parameters |

---

## Installation / 安裝

```bash
pnpm install @aastar/sdk @aastar/core viem
```

---

## Quick Start / 快速開始

### End User Gasless Transaction / 終端用戶 Gasless 流程

```typescript
import { createEndUserClient } from '@aastar/sdk';

const user = createEndUserClient({ 
  account, 
  paymasterUrl: 'https://paymaster.aastar.io' 
});

// Send sponsored transaction / 使用社區信用代付 Gas
await user.sendGaslessTransaction({
  to: TARGET_ADDR,
  data: CALL_DATA
});
```

---

## Testing Commands / 測試命令

### SDK Regression (Using SDK Clients)
```bash
pnpm run test:full_sdk
```

### Full Protocol Regression (Anvil Dedicated)
```bash
pnpm run test:full_anvil
```

---

## Academic Research / 學術研究

The SDK supports doctoral data collection for the SuperPaymaster paper. Official experiment logger is available at `scripts/19_sdk_experiment_runner.ts`.

本 SDK 支撐了 SuperPaymaster 論文的博士實驗數據採集。官方實驗記錄器位於 `scripts/19_sdk_experiment_runner.ts`。

---

## Support / 支援

- **Documentation**: [docs.aastar.io](https://docs.aastar.io)
- **GitHub**: [AAStarCommunity/aastar-sdk](https://github.com/AAStarCommunity/aastar-sdk)

MIT © AAStar Community
