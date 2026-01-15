# AAstar SDK

The ultimate TypeScript SDK for the AAstar Protocol - a decentralized, community-driven Account Abstraction ecosystem.  
AAstar 协议的终极 TypeScript SDK —— 构建去中心化、社区驱动的账户抽象生态系统。

[![npm version](https://img.shields.io/npm/v/@aastar/sdk.svg)](https://www.npmjs.com/package/@aastar/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🌟 Introduction | 简介

AAstar SDK provides a complete suite of tools to interact with the AAstar Protocol. It is designed with a **"Pre-check first, Action second"** philosophy, helping developers build robust dApps with minimal errors.

AAstar SDK 提供了一套完整的工具集用于交互 AAstar 协议。它采用了 **"先检查，后执行"** 的设计理念，帮助开发者构建低错误率、健壮的去中心化应用。

### Core Modules | 核心模块

- **`@aastar/community`**: Launch & manage DAOs. (启动和管理 DAO)
- **`@aastar/operator`**: Run Paymasters & earn rewards. (运行 Paymaster 并赚取收益)
- **`@aastar/enduser`**: Join communities & enjoy gasless txs. (加入社区并享受免 Gas 交易)
- **`@aastar/analytics`**: Monitor ecosystem data. (监控生态系统数据)
- **`@aastar/tokens`**: GToken & XPNTs finance tools. (GToken 和 XPNTs 金融工具)
- **`@aastar/identity`**: Reputation & SBT management. (声誉和 SBT 管理)
- **`@aastar/account`**: Smart Account (ERC-4337) utilities. (智能账户工具)

---

## 📦 Installation | 安装

```bash
pnpm add @aastar/sdk viem
# or
npm install @aastar/sdk viem
```

---

## 🚀 Usage | 使用指南

### 1. Initialize Client | 初始化客户端

```typescript
import { createPublicClient, createWalletClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { CommunityClient, OperatorClient } from '@aastar/sdk';

// 1. Setup VIEM clients
const publicClient = createPublicClient({ chain: sepolia, transport: http() });
const walletClient = createWalletClient({ chain: sepolia, transport: http() });

// 2. Initialize AAstar Clients
const communityClient = new CommunityClient(publicClient, walletClient);
const operatorClient = new OperatorClient(publicClient, walletClient);
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

| Package | Functionality (功能) |
|---------|---------------------|
| `@aastar/core` | Shared logic, Roles, RequirementChecker |
| `@aastar/community` | DAO Registry, XPNTs issuance |
| `@aastar/operator` | Paymaster ops, Staking management |
| `@aastar/enduser` | User onboarding, SBT minting |
| `@aastar/tokens` | Finance, Tokenomics, Approval flows |
| `@aastar/identity` | Reputation, Credit limits, ZK Proofs |

---

## 🤝 Contributing | 贡献

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.  
欢迎贡献！更多详情请参考 [贡献指南](CONTRIBUTING.md)。

---

<p align="center">
  Built with ❤️ by the AAstar Community
</p>

## Modules

- [](README.md)
- [node](node.md)
