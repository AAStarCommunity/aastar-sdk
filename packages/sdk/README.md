# AAstar SDK

The ultimate TypeScript SDK for the AAstar Protocol - a decentralized, community-driven Account Abstraction ecosystem.  
AAstar 协议的终极 TypeScript SDK —— 构建去中心化、社区驱动的账户抽象生态系统。

[![npm version](https://img.shields.io/npm/v/@aastar/sdk.svg)](https://www.npmjs.com/package/@aastar/sdk)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

---

## 🌟 Introduction | 简介

AAstar SDK provides a complete suite of tools to interact with the AAstar Protocol. It is designed with a **"Pre-check first, Action second"** philosophy, helping developers build robust dApps with minimal errors.

AAstar SDK 提供了一套完整的工具集用于交互 AAstar 协议。它采用了 **"先检查，后执行"** 的设计理念，帮助开发者构建低错误率、健壮的去中心化应用。

> **📦 Single-package since v0.20.x | 自 v0.20.x 起单包发布**
> Everything ships in ONE package — `@aastar/sdk` — with **subpath exports** that preserve the
> original module structure. The legacy split packages (`@aastar/core`, `@aastar/account`,
> `@aastar/paymaster`, `@aastar/identity`, `@aastar/tokens`, `@aastar/dapp`, `@aastar/x402`,
> `@aastar/channel`, `@aastar/enduser`, `@aastar/operator`, `@aastar/admin`, `@aastar/airaccount`)
> are **deprecated on npm** and now live as subpaths of `@aastar/sdk`.
> 所有能力合并到 **一个包** `@aastar/sdk`，通过 **子路径导出** 保留原有模块结构；上述老的分包已在 npm 上标记弃用。

### Modules (now subpaths) | 模块（现为子路径）

| Import | Functionality (功能) |
|---|---|
| `@aastar/sdk` | Umbrella: re-exports everything + role-based client factories (总入口 + 角色客户端) |
| `@aastar/sdk/core` | Shared logic, Roles, ABIs, **per-chain addresses** (共享逻辑、角色、ABI、多链地址) |
| `@aastar/sdk/account` | Smart Account (ERC-4337) utilities (智能账户工具) |
| `@aastar/sdk/paymaster` | SuperPaymaster middleware, gas sponsorship (代付中间件) |
| `@aastar/sdk/identity` | Reputation, SBT, credit limits (声誉、SBT、信用额度) |
| `@aastar/sdk/tokens` | GToken & xPNTs finance tools (代币金融工具) |
| `@aastar/sdk/dapp` | React components & hooks — **requires `react` peer dep** (React 组件与 hooks) |
| `@aastar/sdk/x402` | x402 settlement (x402 结算) |
| `@aastar/sdk/channel` | Micro-payment channels (微支付通道) |
| `@aastar/sdk/enduser` · `/operator` · `/admin` | Role lifecycle workflows (角色生命周期) |
| `@aastar/sdk/airaccount` | KMS WebAuthn passkeys, BLS aggregate signatures, tiered ERC-4337 accounts (Passkey + BLS + 分层签名) |

> ⚠️ **`react` / `react-dom` are optional peer deps.** They're only needed for the `@aastar/sdk/dapp`
> subpath. The root `import '@aastar/sdk'` and all non-UI subpaths work in Node/server with no React.
> React 是可选 peer 依赖，仅 `@aastar/sdk/dapp` 需要；root 及其它子路径在 Node/服务端无需 React。

---

## 📦 Installation | 安装

```bash
pnpm add @aastar/sdk viem ethers
# or
npm install @aastar/sdk viem ethers

# Only if you use the React UI subpath (@aastar/sdk/dapp):
pnpm add react react-dom
```

> AirAccount / KMS / BLS features are included — no separate install. Import them from `@aastar/sdk/airaccount`.
> AirAccount / KMS / BLS 能力已内置，无需单独安装，从 `@aastar/sdk/airaccount` 导入即可。

### Importing | 导入方式

```typescript
// Everything from the root barrel (no React pulled in):
import { createEndUserClient, createOperatorClient, CANONICAL_ADDRESSES } from '@aastar/sdk';

// …or cherry-pick from a subpath to keep bundles lean:
import { registryActions } from '@aastar/sdk/core';
import { KmsManager, P256PasskeySigner } from '@aastar/sdk/airaccount';
import { useGasless } from '@aastar/sdk/dapp'; // requires react
```

---

## 🌐 Multi-chain | 多链配置

Contract addresses are keyed by **chainId** in `CANONICAL_ADDRESSES`, so switching chains means
switching the viem `chain` + `transport` and passing the matching address set.
合约地址在 `CANONICAL_ADDRESSES` 中按 **chainId** 分组，切链 = 切换 viem `chain` + `transport` 并传入对应链的地址集。

| Network | chainId | Status |
|---|---|---|
| Optimism (mainnet) | `10` | ✅ deployed |
| Sepolia (testnet) | `11155111` | ✅ deployed (primary test target) |
| OP Sepolia (testnet) | `11155420` | ✅ deployed |
| Ethereum mainnet | `1` | ⏳ not yet deployed |

```typescript
import { createEndUserClient, CANONICAL_ADDRESSES } from '@aastar/sdk';
import { sepolia, optimism } from 'viem/chains';
import { http } from 'viem';

// Sepolia testnet
const test = createEndUserClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL),
  addresses: CANONICAL_ADDRESSES[11155111],
});

// Optimism mainnet — same code, just swap chain + transport + address set
const prod = createEndUserClient({
  chain: optimism,
  transport: http('https://mainnet.optimism.io'),
  addresses: CANONICAL_ADDRESSES[10],
});
```

Helpers for RPC URLs and explorer links live in `@aastar/sdk` too:
`getNetwork(name)`, `getRpcUrl(name)`, `getChainId(name)`, `getTxUrl(name, hash)`, `getAddressUrl(name, addr)`.

---

## 📚 Documentation | 文档导航

- **Docs Home**: https://docs.aastar.io/
- **API Reference**: https://docs.aastar.io/api/
- **Examples**: https://docs.aastar.io/examples/
- **Deployments**: https://docs.aastar.io/guide/deployments/verify.sepolia.contracts
- **Configuration Sync**: https://docs.aastar.io/guide/docs/Configuration_Sync
- **Regression Testing**: https://docs.aastar.io/guide/docs/Regression_Testing_Guide
- **Gasless Tester Guide**: https://docs.aastar.io/guide/docs/TESTER_GUIDE_GASLESS
- **Price Keeper Guide**: [docs/guide/keeper.md](../../docs/guide/keeper.md)

---

## 🚀 Usage | 使用指南

### 1. Initialize Client | 初始化客户端

```typescript
import { http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { createEndUserClient, createOperatorClient, CANONICAL_ADDRESSES } from '@aastar/sdk';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

// Role-based clients compose viem action factories under the hood.
const enduser = createEndUserClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL),
  account,
  addresses: CANONICAL_ADDRESSES[11155111],
});

const operator = createOperatorClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL),
  account,
  addresses: CANONICAL_ADDRESSES[11155111],
});
```

### 2. "Pre-check" Pattern | "预检查" 模式

Avoid reverts and save gas by checking requirements off-chain first.  
通过链下预检查避免交易回滚并节省 Gas。

```typescript
// ❌ Old Way (Prone to errors)
// await communityClient.launchCommunity(...); 

// ✅ New AAstar Way
const check = await communityClient.checkLaunchRequirements(myAddress, parseEther("33"));

if (!check.hasEnoughGToken) {
    console.error(`Missing Requirements: ${check.missingRequirements.join(', ')}`);
    // Output: "Need 33 GT, have 10 GT"
} else {
    // Safe to execute
    await communityClient.launchCommunity({
        name: "My DAO",
        tokenSymbol: "MDAO"
    });
}
```

### 3. Key Scenarios | 核心场景

#### 🏛️ For Community Owners (社区创建者)

```typescript
// Configure SBT rules for your community
await communityClient.configureSBTRules({
    communityId: myCommunityId,
    rule: {
        minScore: 100,
        requiredTags: ["OG"]
    }
});
```

#### ⚙️ For Operators (运营商)

```typescript
// Check if you are ready to be a Super Paymaster
const status = await operatorClient.checkResources(myAddress);

if (status.hasRole) {
    await operatorClient.withdrawCollateral(parseEther("50"));
} else {
    console.log(status.recommendations); 
    // "Fund aPNTs for collateral", "Stake GToken"
}
```

#### 📊 For Analysts (分析师)

```typescript
import { AnalyticsClient } from '@aastar/sdk';

const analytics = new AnalyticsClient(publicClient);

// Get real-time GToken metrics
const metrics = await analytics.getSupplyMetrics();
console.log(`Deflation Rate: ${metrics.deflationRate}%`);
```

---

## 🔧 Architecture | 架构

AAstar SDK is built on top of **viem**, ensuring lightweight and type-safe interactions. It abstracts complex contract logic into intuitive business primitives.

AAstar SDK 基于 **viem** 构建，确保轻量级和类型安全的交互。它将复杂的合约逻辑抽象为直观的业务原语。

All capabilities are bundled into `@aastar/sdk`; the table below maps each former package to its subpath.
所有能力已打包进 `@aastar/sdk`，下表对应每个旧分包现在的子路径。

| Subpath | Functionality (功能) |
|---------|---------------------|
| `@aastar/sdk/core` | Shared logic, Roles, RequirementChecker, per-chain addresses |
| `@aastar/sdk/account` | Smart Account (ERC-4337) utilities |
| `@aastar/sdk/operator` | Paymaster ops, Staking management |
| `@aastar/sdk/enduser` | User onboarding, SBT minting |
| `@aastar/sdk/tokens` | Finance, Tokenomics, Approval flows |
| `@aastar/sdk/identity` | Reputation, Credit limits, ZK Proofs |
| `@aastar/sdk/paymaster` | EntryPoint & Paymaster low-level API |
| `@aastar/sdk/dapp` | React Components & Integration Hooks (needs `react`) |
| `@aastar/sdk/airaccount` | KMS WebAuthn, BLS Signatures, ERC-4337 Tiered Accounts |

---

## 📊 Gas Analytics & Reporting | Gas 分析与报表
The SDK includes a powerful **Gas Analytics Module** for analyzing Paymaster efficiency, tracking costs, and generating industry comparison reports.
SDK 包含一个强大的 **Gas 分析模块**，用于分析 Paymaster 效率、追踪成本并生成行业对比报告。

### Quick Start | 快速开始
Generate a real-time analysis of recent Sepolia transactions:
生成最近 Sepolia 交易的实时分析：
```bash
npx tsx packages/analytics/src/gas-analyzer-v4.ts
```

### Key Features | 核心功能
- **Double-Layer Analysis (双层分析)**: Intrinsic EVM Efficiency vs. Economic USD Costs
- **Industry Benchmarking (行业对标)**: Compare AAStar vs. Optimism, Alchemy, Pimlico
- **Profit Tracking (利润追踪)**: Transparent breakdown of Protocol Revenue & Profit
- **L2 Simulation (L2 模拟)**: Estimate savings for migrating UserOps to Optimism

👉 **[View Full Analytics Documentation | 查看完整分析文档](https://docs.aastar.io/guide/packages/analytics/)**

---

## 🤝 Contributing | 贡献

We welcome contributions! Please see our Contributing Guide for details.  
欢迎贡献！更多详情请参考贡献指南。

---

<p align="center">
  Built with ❤️ by the AAstar Community
</p>
