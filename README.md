# AAStar SDK (Mycelium Network)

<p align="left">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" style="display:inline-block; margin-right: 10px;" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue" alt="TypeScript" style="display:inline-block; margin-right: 10px;" />
  <img src="https://img.shields.io/badge/Status-0.14.0-green" alt="Status" style="display:inline-block;" />
</p>

**Comprehensive Account Abstraction Infrastructure SDK - Powering the Mycelium Network**

---
**
## 📚 Contents

- [AAStar SDK (Mycelium Network)](#aastar-sdk-mycelium-network)
  - [📚 Contents](#-contents)
  - [Introduction](#introduction)
    - [Core Features](#core-features)
  - [SDK v2 Architecture](#sdk-v2-architecture)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
    - [End User Gasless Transaction](#end-user-gasless-transaction)
    - [Operator Onboarding](#operator-onboarding)
  - [Testing Commands](#testing-commands)
    - [SDK Regression (Using SDK Clients)](#sdk-regression-using-sdk-clients)
    - [Full Protocol Regression (Anvil Dedicated)](#full-protocol-regression-anvil-dedicated)
    - [EIP-2537 Precompile Verification](#eip-2537-precompile-verification)
  - [🧰 Keeper (Price Updater)](#-keeper-price-updater)
    - [使用场景](#使用场景)
    - [前置条件](#前置条件)
    - [环境变量与网络选择](#环境变量与网络选择)
    - [发送交易的三种模式](#发送交易的三种模式)
    - [常用命令](#常用命令)
    - [Telegram 通知（可选）](#telegram-通知可选)
    - [注意事项](#注意事项)
  - [Development Guides](#development-guides)
    - [ABI Maintenance](#abi-maintenance)
  - [Development Workflow](#development-workflow)
    - [Step 1: Modify Contracts](#step-1-modify-contracts)
    - [Step 2: Local Build \& Deploy (Anvil)](#step-2-local-build--deploy-anvil)
    - [Step 3: Run Local Tests](#step-3-run-local-tests)
    - [Step 4: Deploy to Sepolia](#step-4-deploy-to-sepolia)
    - [Step 5: Verify on Sepolia](#step-5-verify-on-sepolia)
  - [📊 Gas Analytics \& Reporting](#-gas-analytics--reporting)
    - [Quick Start](#quick-start-1)
    - [Key Features](#key-features)
  - [Academic Research](#academic-research)
    - [Architecture Design (L3 Refinement)](#architecture-design-l3-refinement)
  - [Support](#support)
  - [Verified Contracts (Current Deployment)](#verified-contracts-current-deployment)
  - [🛡️ SDK Integrity Verification](#️-sdk-integrity-verification)
    - [deployment update](#deployment-update)
---

## Introduction

**AAStar SDK** is a high-integration toolkit for the Mycelium network. We've refactored 17 fragmented modules into 7 professional core packages, providing a unified, high-performance, and easy-to-maintain development experience.

### Core Features

- ✅ **Role-Based Clients**: Specific APIs for End Users, Communities, Operators, and Admins.
- ✅ **Infrastructure Ready**: Deep integration with SuperPaymaster and EOA Bridge.
- ✅ **Seamless User Experience**: Gasless transactions via community credit system.
- ✅ **DVT Security Module**: Decentralized verification and aggregate signatures.
- ✅ **Scientific Reproducibility**: Version-locked for academic research.

---

## SDK v2 Architecture

AAStar SDK v2 adopts the **"Actions-Decorator"** pattern. It decouples low-level contract interactions from high-level business logic, providing specialized Client wrappers for the four roles in the ecosystem.

| Client | Targeted Developer | Core Responsibility |
| :--- | :--- | :--- |
| **`EndUserClient`** | dApp Developer | Gasless UX, Smart Account management, Credit queries |
| **`CommunityClient`** | Community/DAO Admin | Auto-onboarding, xPNTs deployment, SBT & Reputation |
| **`OperatorClient`** | Node/Operator | SuperPaymaster registration, Staking, Pool management |
| **`AdminClient`** | Protocol Admin | DVT aggregations, Slashing, Global parameters |

---

## Installation

```bash
pnpm install @aastar/sdk @aastar/core viem
```

---

## Quick Start

### End User Gasless Transaction
```typescript
import { createEndUserClient } from '@aastar/sdk';

const user = createEndUserClient({ 
  account, 
  paymasterUrl: 'https://paymaster.aastar.io' 
});

// Execute gasless via SuperPaymaster
await user.executeGasless({
  target: TARGET_ADDR,
  data: CALL_DATA,
  operator: OPERATOR_ADDR // Operator sponsoring the gas
});
```

### Operator Onboarding
```typescript
import { createOperatorClient } from '@aastar/sdk';
import { parseEther, keccak256, stringToBytes } from 'viem';

const operator = createOperatorClient({ account, chain });

// High-level setup: handles GToken approval, staking, and paymaster deposit
await operator.onboardOperator({
  stakeAmount: parseEther('100'),
  depositAmount: parseEther('10'),
  roleId: keccak256(stringToBytes('PAYMASTER_SUPER'))
});
```

---

## Testing Commands

### SDK Regression (Using SDK Clients)
```bash
pnpm run test:full_sdk
```


### Full Protocol Regression (Anvil Dedicated)
```bash
pnpm run test:full_anvil
```

### EIP-2537 Precompile Verification
```bash
pnpm run test:eip2537 -- --network sepolia
pnpm run test:eip2537 -- --network op-sepolia
```

The full regression pipeline (`./scripts/run_full_regression.sh --env sepolia|op-sepolia`) also runs this check and appends a machine-readable record to:
- [packages/analytics/data/historical/eip2537_checks.jsonl](./packages/analytics/data/historical/eip2537_checks.jsonl)

---

## 🧰 Keeper (Price Updater)

`scripts/keeper.ts` 是一个面向生产/准生产环境的 price keeper，用于在价格缓存临近过期时，自动触发合约的 `updatePrice()`，避免 paymaster 因价格过期导致验证失败或服务降级。

它支持两类目标：

- **SuperPaymaster**（`cachedPrice()` + `priceStalenessThreshold()` + `updatePrice()`）
- **PaymasterV4**（同名接口，且可从合约读取 `ethUsdPriceFeed()`）

### 使用场景

- **定时巡检**：每隔 N 秒检查缓存与 Chainlink 最新轮次时间戳，必要时更新
- **只跑一次**：用于手动验证配置是否正确
- **后台守护**：支持 `--background` 把进程放到后台并写日志
- **通知**：可选 Telegram 心跳/异常通知（不配置则静默跳过）

### 前置条件

- Node.js + pnpm
- 可用 RPC（`tests/regression/config.ts` 支持的网络，或至少提供 `RPC_URL`）
- 如果使用 cast 相关模式：本机需要安装 Foundry（`cast`）

### 环境变量与网络选择

- `--network <name>`：例如 `op-sepolia` / `op-mainnet` / `sepolia` / `mainnet` / `anvil`
- keeper 会尝试自动加载 `.env.<network>`；当 `--network op-mainnet` 时额外尝试加载 `.env.optimism` 与 `.env.op-mainnet`
- 如果无法加载网络配置，但提供了 `RPC_URL`，会使用 canonical addresses 做降级回退（仅用于最小可运行）

### 发送交易的三种模式

- **privateKey（默认）**：使用 `KEEPER_PRIVATE_KEY` 或 `PRIVATE_KEY_SUPPLIER` 直接签名并调用 `updatePrice()`
- **cast**：用 `cast send` 发送交易（支持 `--keystore <path>` 或 `--cast-account <name>`）
- **castWallet**：通过 `cast wallet decrypt-keystore <name>` 解出私钥后走 viem 发送交易

### 常用命令

只跑一次（不发交易，只打印状态）：

```bash
pnpm exec tsx scripts/keeper.ts --network op-sepolia --once --dry-run
```

持续运行（每 30 秒轮询一次；接近过期前 10 分钟触发更新；每天最多更新 24 次）：

```bash
pnpm exec tsx scripts/keeper.ts --network op-sepolia --poll-interval 30 --safety-margin 600 --max-updates-per-day 24
```

只更新其中一种 paymaster：

```bash
pnpm exec tsx scripts/keeper.ts --network op-sepolia --no-paymaster
pnpm exec tsx scripts/keeper.ts --network op-sepolia --no-superpaymaster
```

后台运行并写日志（推荐显式指定 log file）：

```bash
pnpm exec tsx scripts/keeper.ts --network op-sepolia --background --log-file ./keeper.op-sepolia.log
```

用 cast keystore 发送交易（交互式输入密码；也可用 `CAST_KEYSTORE_PASSWORD` 免交互）：

```bash
pnpm exec tsx scripts/keeper.ts --network op-mainnet --mode cast --cast-account <your-cast-account-name>
```

castWallet 后台模式（需要 `CAST_UNSAFE_PASSWORD`，否则会因交互被拒绝）：

```bash
CAST_UNSAFE_PASSWORD='...' pnpm exec tsx scripts/keeper.ts --network op-mainnet --mode cast-wallet --cast-account <your-cast-account-name> --background
```

### Telegram 通知（可选）

如果同时设置以下两项，会开启启动/心跳/失败通知；否则自动关闭通知：

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`（数值 chat id，或 `@ChannelName`）

Telegram 前置条件：

- 私聊：需要先对 bot 发送 `/start`
- 群/频道：需要把 bot 拉进去，并允许它发消息

健康通知（可选）：

- `--health-interval <sec>`：每隔 N 秒发送一次 “health ok” 通知（仅在 super + paymaster 都正常时才发送，默认 1800）

异常检测（可选，不会自动发交易）：

- `--chainlink-stale-sec <sec>`：当 Chainlink `updatedAt` 超过该阈值未更新时，发送告警（默认 600）
- `--external-ethusd-url <url>`（或 `EXTERNAL_ETHUSD_URL`）：链下 ETH/USD 价格源（返回 JSON，脚本会尝试读取 `price/last/amount/data.amount` 字段）
- `--volatility-threshold-bps <n>`：当链下价格“短时波动”或“与 Chainlink 偏离”超过阈值时告警（bps=万分比，150=1.50%，默认 0=关闭）
- `--volatility-cooldown <sec>`：同类告警冷却时间（默认 600）

告警触发逻辑（满足任一即告警）：

- **Chainlink stale**：`now - chainlink.updatedAt >= chainlinkStaleSec`
- **链下 vs Chainlink 偏离**：`abs(external - chainlink) / chainlink >= volatilityThresholdBps`
- **链下短时波动**：`abs(external_now - external_prev) / external_prev >= volatilityThresholdBps`

### 注意事项

- `--dry-run` 不会发送任何交易，适合先验证网络、地址、阈值逻辑是否符合预期
- keeper 启动时会在 `INIT` 里链上读取并打印 `super.thresholdSec` / `paymaster.thresholdSec`，用于确认 4200s/86400s 等阈值是否生效
- `--max-base-fee-gwei <n>` 可在高 base fee 时推迟更新（只要在安全窗口内仍有效）
- 该脚本会尝试从 `paymasterFactory` 通过 operator 推导 PaymasterV4 地址；也可用 `--paymaster <addr>` 强制指定
- 地址来源：默认从 Astar SDK 内置配置读取（[addresses.js](./packages/core/src/addresses.js) 与 [config.ts](./tests/regression/config.ts)），并允许用 CLI 参数覆盖

## Development Guides

### ABI Maintenance
- [ABI Maintenance Plan](https://docs.aastar.io/guide/ABI_MAINTENANCE_PLAN)

---

## Development Workflow

A step-by-step guide for contributors from contract modification to Sepolia deployment.

### Step 1: Modify Contracts
Edit Solidity files in `superpaymaster/contracts/src`.
```bash
cd projects/SuperPaymaster
# Edit .sol files...
```

### Step 2: Local Build & Deploy (Anvil)
Auto-start Anvil, compile contracts, deploy, and sync config to SDK.
```bash
cd projects/aastar-sdk
# Runs Anvil + Deploy + Sync .env.anvil
./run_full_regression.sh --env anvil
```

### Step 3: Run Local Tests
Validate your changes with the full regression suite.
```bash
# Run all SDK & Protocol tests
./run_sdk_regression.sh
```

### Step 4: Deploy to Sepolia
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

### Step 5: Verify on Sepolia
Run the regression suite against the live testnet.
```bash
cd projects/aastar-sdk
./run_full_regression.sh --env sepolia
```


---

## 📊 Gas Analytics & Reporting
The SDK includes a powerful **Gas Analytics Module** for analyzing Paymaster efficiency, tracking costs, and generating industry comparison reports.

### Quick Start
Generate a real-time analysis of recent Sepolia transactions:
```bash
npx tsx packages/analytics/src/gas-analyzer-v4.ts
```

### Key Features
- **Double-Layer Analysis**: Intrinsic EVM Efficiency vs. Economic USD Costs
- **Industry Benchmarking**: Compare AAStar vs. Optimism, Alchemy, Pimlico
- **Profit Tracking**: Transparent breakdown of Protocol Revenue & Profit
- **L2 Simulation**: Estimate savings for migrating UserOps to Optimism

👉 **[View Full Analytics Documentation](./packages/analytics/README.md)**

---

## Academic Research

The SDK supports doctoral data collection for the SuperPaymaster paper. Official experiment logger is available at `scripts/19_sdk_experiment_runner.ts`.

- [Stage 3 Scenario Experiment Plan](https://docs.aastar.io/guide/STAGE_3_SCENARIO_EXP_PLAN)
- [Reputation-to-Credit Mapping Whitepaper](https://docs.aastar.io/guide/Reputation-to-Credit_Mapping_Whitepaper)

### Architecture Design (L3 Refinement)
- **[L3 Complete Demo Walkthrough](../aastar-docs/guide/docs/L3_Complete_Demo_Walkthrough.md)** (Detailed Step-by-Step Guide)
- **[L3 Lifecycle Patterns Design](./docs/L3_Lifecycle_Patterns_Design.md)** (Architecture Specification)
- **[L3 Lifecycle Developer Guide](./docs/L3_Lifecycle_Developer_Guide.md)** (Quick Start & API Reference)
- **[Account Initialization Guide (CN)](./docs/Account_Initialization_Guide_CN.md)** (Seamless Setup Guide)
- [L3 Use Case Gap Analysis](./docs/L3_Use_Case_Analysis.md)

---

## Support

- **Documentation**: [docs.aastar.io](https://docs.aastar.io)
- **GitHub**: [AAStarCommunity/aastar-sdk](https://github.com/AAStarCommunity/aastar-sdk)

MIT © AAStar Community

## Verified Contracts (Current Deployment)

The following contract addresses have been successfully verified on their respective testnets as of January 24, 2026.

- [Sepolia Verified Contracts](./docs/verify.sepolia.contracts.md)
- [Optimism Sepolia Verified Contracts](./docs/verify.op-sepolia.contracts.md)

---

## 🛡️ SDK Integrity Verification

> [!IMPORTANT]
> **Security First**: To ensure you are using an official release and protect your private keys, always verify the integrity of the SDK code immediately after installation.

**Current Code Integrity Hash (v0.16.23)**: `9b02e91aaae2081b68b8ddfcf4c3dd52d450b4f368a8746b5896e0024e441db7`

To verify, run this stable command (it verifies all code but excludes .md files to ensure stability):
```bash
git ls-files -z | grep -zvE '\.md$' | xargs -0 sha256sum | sha256sum
```
The resulting hash must match the one listed in the [Changelog](./CHANGELOG.md).

### deployment update

自动化生产器 (update-version.sh)：
现在当你执行 ./update-version.sh <version> 时，它会自动计算代码哈希（排除 .md 文件）。
它会自动扫描并同步更新所有相关文档：README.md、CHANGELOG.md、docs/guide/*.md 以及 Configuration_Sync.md 中的哈希记录。
发布防卫门禁 (publish.sh & dry-run-publish.sh)：
在正式发布（或模拟发布）前，脚本会自动对比“文档记录哈希”与“当前代码真实哈希”。
拦截机制：如果你在升级版本后又临时修改了代码（即使只改了一个字符），发布将被强制拦截，并提示你重新同步哈希。
文档对齐：
所有发布流程相关的变动已同步到 
docs/Configuration_Sync.md。
