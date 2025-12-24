
# AAStar SDK (The Mycelium Network)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Status](https://img.shields.io/badge/Status-Beta%20v1.2-green)](https://github.com/AAStarCommunity/aastar-sdk)

**[English Documentation](#english-documentation)** | **[中文文档 (Chinese Documentation)](#chinese-documentation)**

---

<a name="english-documentation"></a>
## 🌍 English Documentation

### 🛡️ SDK v2 Architectural Design

The AAStar SDK v2 follows the **"Action-Decorator"** pattern (inspired by `viem` and `permissionless.js`). It decouples low-level contract interactions from high-level business logic, providing four specialized clients for different ecosystem roles.

#### Core Philosphy
- **Semantic Actions**: Abstracting complex flows (e.g., `onboardToSuperPaymaster`) into atomic SDK calls.
- **Provider Agnostic**: Works seamlessly with any `viem` transport (Pimlico, Alchemy, or Local Anvil).
- **Security First**: Fixed dependency locking and automated supply chain auditing.

#### Role-Based API Matrix
| Client | Target Developer | Primary Responsibility |
| :--- | :--- | :--- |
| **`EndUserClient`** | dApp Builder | Gasless UX, Smart Accounts, Credit/Debt status. |
| **`CommunityClient`** | DAO Manager | Automated onboarding, xPNTs deployment, SBT rules. |
| **`OperatorClient`** | Node Runner | SuperPaymaster registration, GToken staking, Liquidity. |
| **`AdminClient`** | Protocol Dev | DVT proof submission, Slashing, Global parameters. |

#### 🚀 Example: High-Level EndUser Flow
```typescript
const user = createEndUserClient({ account, paymasterUrl });

// Send a transaction without ETH (sponsored by community credit)
await user.sendGaslessTransaction({
  to: TARGET_ADDR,
  data: CALL_DATA
});
```

### 🔬 Research & Data Collection
This SDK powers the PhD experiments for the SuperPaymaster paper.
- **`scripts/19_sdk_experiment_runner.ts`**: The official data recorder.
- **Execution Mode**: Locked to safe dependency versions to ensure scientific reproducibility.

---

<a name="chinese-documentation"></a>
## 🌏 中文文档 (Chinese Documentation)

### 简介
**AAStar SDK** 是 Mycelium 网络的高集成度开发入口。我们将原有的 17 个碎片化模块重构为 7 个专业核心包，旨在提供統一、高性能且易于维护的開發體驗。

### 🏛️ SDK v2 架构设计

AAStar SDK v2 採用 **「裝飾器 (Actions-Decorator)」** 模式（借鑒自 `viem` 與 `permissionless.js`）。它將低層次的合約交互與高層次的業務邏輯解耦，為生態系統中的四種角色提供專屬的 Client 封裝。

#### 核心理念
- **語義化 Action**: 將複雜流程（如「運營商入駐」）封裝為單次 SDK 調用。
- **Provider 無關性**: 完美適配任何 `viem` 傳輸層（Pimlico, Alchemy 或本地 Anvil）。
- **安全加固**: 鎖定依賴版本並實施自動化供應鏈審計，防範安全漏洞。

#### 角色化 API 矩陣
| 客戶端 | 目標開發者 | 核心職責 |
| :--- | :--- | :--- |
| **`EndUserClient`** | dApp 開發者 | 實現無感 Gas UX、管理 7702 賬戶、查詢信用/債務。 |
| **`CommunityClient`** | 社區/DAO 管理者 | 自動化入駐、部署 xPNTs 代幣、配置聲譽規則。 |
| **`OperatorClient`** | 節點/運營商 | SuperPaymaster 註冊與質押、資金池(ETH/aPNTs)管理。 |
| **`AdminClient`** | 協議維護者 | 提交 DVT 聚合簽名、執行獎懲 Slashing、調整全局參數。 |

#### 🚀 預覽：終端用戶 Gasless 流程
```typescript
const user = createEndUserClient({ account, paymasterUrl });

// 使用社區信用代付 Gas，無需持有 ETH
await user.sendGaslessTransaction({
  to: TARGET_ADDR,
  data: CALL_DATA
});
```

### 🔬 學術研究與數據採集
本 SDK 支撐了 SuperPaymaster 論文的博士實驗數據採集：
- **`scripts/19_sdk_experiment_runner.ts`**: 官方實驗記錄器，確保數據的可重複性。
- **安全策略**: 嚴格版本鎖定，防範供應鏈攻擊。
