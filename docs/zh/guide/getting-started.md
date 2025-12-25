# 開始使用 (Getting Started)

<p align="left">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" style="display:inline-block; margin-right: 10px;" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue" alt="TypeScript" style="display:inline-block; margin-right: 10px;" />
  <img src="https://img.shields.io/badge/Status-0.14.0-green" alt="Status" style="display:inline-block;" />
</p>

**完整的賬戶抽象基礎設施 SDK - 為 Mycelium 網絡提供動力**

---

## 📚 目錄

- [簡介](#簡介)
- [SDK v2 架構設計](#sdk-v2-架構設計)
- [安裝](#安裝)
- [快速開始](#快速開始)
- [測試命令](#測試命令)
- [開發指南](#開發指南)
- [學術研究](#學術研究)

---

## 簡介 (Introduction)

**AAStar SDK** 是 Mycelium 網絡的高集成度開發工具包。我們將原有的 17 個碎片化模塊重構為 7 個專業核心包，旨在提供統一、高性能且易於維護的開發體驗。

### 核心特性

- ✅ **角色化客戶端**: 為終端用戶、社區、運營商和協議管理員提供專屬 API
- ✅ **基礎設施就緒**: 深度集成 SuperPaymaster 與 EOA Rainbow Bridge
- ✅ **無感交互體驗**: 基於社區信用系統的 Gasless 交易
- ✅ **DVT 安全模塊**: 去中心化驗證與聚合簽名
- ✅ **科學可複現**: 鎖定依賴版本，支持學術論文數據採集

---

## SDK v2 架構設計

AAStar SDK v2 採用 **「裝飾器 (Actions-Decorator)」** 模式（借鑑自 `viem` 與 `permissionless.js`）。它將低層次的合約交互與高層次的業務邏輯解耦，為生態系統中的四種角色提供專屬的 Client 封裝。

### 核心理念

- **語義化 Action**: 將複雜流程（如「運營商入駐」）封裝為單次 SDK 調用
- **Provider 無關性**: 完美適配任何 `viem` 傳輸層（Pimlico, Alchemy 或本地 Anvil）
- **安全加固**: 鎖定依賴版本並實施自動化供應鏈審計

### 角色化 API 矩陣

| 客戶端 | 目標開發者 | 核心職責 |
| :--- | :--- | :--- |
| **`EndUserClient`** | dApp 開發者 | 實現無感 Gas UX、管理智能賬戶、查詢信用/債務狀態 |
| **`CommunityClient`** | 社區/DAO 管理者 | 自動化入駐、部署 xPNTs 代幣、配置 SBT & 聲譽規則 |
| **`OperatorClient`** | 節點/運營商 | SuperPaymaster 註冊與質押、資金池 (ETH/aPNTs) 管理 |
| **`AdminClient`** | 協議維護者 | 提交 DVT 聚合簽名、執行獎懲 Slashing、調整全局參數 |

---

## 安裝 (Installation)

```bash
pnpm install @aastar/sdk @aastar/core viem
```

---

## 快速開始 (Quick Start)

### 基礎示例 (Operator)

```typescript
import { createOperatorClient } from '@aastar/sdk';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { http } from 'viem';

// 創建運營商客戶端
const operatorClient = createOperatorClient({
  chain: foundry,
  transport: http('http://127.0.0.1:8545'),
  account: privateKeyToAccount('0x...'),
});

// 一鍵入駐 SuperPaymaster（質押 + 存款）
await operatorClient.onboardToSuperPaymaster({
  stakeAmount: parseEther('50'),
  depositAmount: parseEther('50')
});
```

---

## 測試命令 (Testing)

本项目提供兩套完整的回歸測試。

### SDK 回歸測試（使用 SDK 客户端）

```bash
pnpm run test:full_sdk
```

- **測試場景**:
  - ✅ Operator Staking (質押)
  - ✅ Paymaster Deposit (存款)
  - ✅ Community Registration (社區註冊)
  - ✅ SBT Minting (SBT 鑄造)
  - ✅ Admin Slashing (懲罰)
  - ✅ Credit Query (信用查詢)

### 完整協議回歸測試（Anvil 專用，72 場景）

```bash
pnpm run test:full_anvil
```

---

## 學術研究 (Research)

本 SDK 支撐了 SuperPaymaster 論文的博士實驗數據採集：

- **`scripts/19_sdk_experiment_runner.ts`**: 官方實驗記錄器
- **覆蓋率**: 95% 用戶用例分支，72 個完整場景

---

## 支援與貢獻 (Support)

- **代碼倉庫**: [AAStarCommunity/aastar-sdk](https://github.com/AAStarCommunity/aastar-sdk)
- **Discord**: [加入我們的社區](https://discord.gg/aastar)
- **許可證**: MIT
