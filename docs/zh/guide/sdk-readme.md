# AAStar SDK (Mycelium 网络)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Status](https://img.shields.io/badge/Status-Beta%20v2.0-green)](https://github.com/AAStarCommunity/aastar-sdk)

**完整的账户抽象基础设施SDK - 为Mycelium网络提供动力**

---

## 📚 目录

- [简介](#简介)
- [SDK v2 架构设计](#sdk-v2-架构设计)
- [快速开始](#快速开始)
- [测试命令](#测试命令)
- [开发指南](#开发指南)
- [学术研究](#学术研究)

---

## 简介

**AAStar SDK** 是 Mycelium 网络的高集成度开发工具包。我们将原有的17个碎片化模块重构为7个专业核心包，旨在提供统一、高性能且易于维护的开发体验。

### 核心特性

- ✅ **角色化客户端**: 为终端用户、社区、运营商和协议管理员提供专属API
- ✅ **账户对象支持**: 完整兼容 `viem` v2.x Account 架构
- ✅ **零Gas体验**: 基于信用系统的无感Gas支付
- ✅ **DVT安全模块**: 去中心化验证与聚合签名
- ✅ **科学可复现**: 锁定依赖版本，支持学术论文数据采集

---

## SDK v2 架构设计

AAStar SDK v2 采用 **「装饰器 (Actions-Decorator)」** 模式（借鉴自 `viem` 与 `permissionless.js`）。它将低层次的合约交互与高层次的业务逻辑解耦，为生态系统中的四种角色提供专属的 Client 封装。

### 核心理念

- **语义化 Action**: 将复杂流程（如「运营商入驻」）封装为单次 SDK 调用
- **Provider 无关性**: 完美适配任何 `viem` 传输层（Pimlico, Alchemy 或本地 Anvil）
- **安全加固**: 锁定依赖版本并实施自动化供应链审计，防范安全漏洞

### 角色化 API 矩阵

| 客户端 | 目标开发者 | 核心职责 |
| :--- | :--- | :--- |
| **`EndUserClient`** | dApp 开发者 | 实现无感 Gas UX、管理智能账户、查询信用/债务状态 |
| **`CommunityClient`** | 社区/DAO 管理者 | 自动化入驻、部署 xPNTs 代币、配置SBT & 声誉规则 |
| **`OperatorClient`** | 节点/运营商 | SuperPaymaster 注册与质押、资金池(ETH/aPNTs)管理 |
| **`AdminClient`** | 协议维护者 | 提交 DVT 聚合签名、执行奖惩 Slashing、调整全局参数 |

### 预览：终端用户 Gasless 流程

```typescript
import { createEndUserClient } from '@aastar/sdk';

const user = createEndUserClient({ 
  account, 
  paymasterUrl: 'https://paymaster.aastar.io' 
});

// 使用社区信用代付 Gas，无需持有 ETH
await user.sendGaslessTransaction({
  to: TARGET_ADDR,
  data: CALL_DATA
});
```

详细测试命令和网络切换指南，请参考 **[📖 测试命令完整指南](./docs/TEST_COMMANDS.md)**

---

## 快速开始

### 安装

```bash
pnpm install @aastar/sdk @aastar/core viem
```

### 基础示例

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
  addresses: {
    registry: '0x...',
    gToken: '0x...',
    // ...更多合约地址
  }
});

// 一键入驻 SuperPaymaster（质押 + 存款）
await operatorClient.onboardToSuperPaymaster({
  stakeAmount: parseEther('50'),
  depositAmount: parseEther('50')
});
```

---

## 测试命令

本项目提供两套完整的回归测试。详细说明请参考 **[📖 测试命令完整指南](./docs/TEST_COMMANDS.md)**

### 快速开始

```bash
# SDK回归测试（支持任意网络）
pnpm run test:full_sdk

# 完整协议回归（Anvil专用，72场景）
pnpm run test:full_anvil
```

### 网络切换

`test:full_sdk` 可在任意网络运行，只需修改配置：

```bash
# 方法1: 使用环境变量
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/KEY \
REGISTRY_ADDRESS=0xSepoliaAddress \
pnpm run test:full_sdk

# 方法2: 创建专用配置文件
cp .env.v3 .env.sepolia  # 编辑填入Sepolia地址
dotenv -e .env.sepolia -- pnpm run test:full_sdk
```

完整网络切换指南（包括Mainnet配置）请查看 [测试命令文档](./docs/TEST_COMMANDS.md#🌐-网络切换指南)。

### 1. 完整协议回归测试（不使用SDK）

```bash
pnpm run test:full_anvil
```

- **说明**: 运行17个独立测试脚本，覆盖72个场景
- **用途**: 完整的协议功能验证（直接使用viem）
- **特点**: 自动重启Anvil、部署合约、同步配置
- **预期时间**: 5-10分钟

### 2. SDK回归测试（使用SDK客户端）

```bash
pnpm run test:full_sdk
```

- **说明**: 验证SDK核心功能（使用四种专属客户端）
- **用途**: SDK v2架构验证
- **特点**: 自动检测Anvil并初始化环境
- **预期时间**: ~30秒
- **测试场景**:
  - ✅ Operator Staking (质押)
  - ✅ Paymaster Deposit (存款)
  - ✅ Community Registration (社区注册)
  - ✅ SBT Minting (SBT铸造)
  - ✅ Admin Slashing (惩罚)
  - ✅ Credit Query (信用查询)

### 3. 仅初始化环境

```bash
pnpm run test:init
```

- **说明**: 重启Anvil + 部署合约 + 同步配置（不运行

测试）
- **用途**: 手动调试前的环境准备

详细文档请参考：[`docs/TEST_COMMANDS.md`](./docs/TEST_COMMANDS.md)

---

## 开发指南

### 项目结构

```
aastar-sdk/
├── packages/
│   ├── core/           # 核心Actions和ABI定义
│   ├── sdk/            # 四种角色化客户端
│   ├── shared-config/  # 共享配置和常量
│   └── finance/        # xPNTs代币工厂
├── scripts/            # 测试和实验脚本
├── docs/               # 完整文档
└── run_full_regression.sh  # 自动化回归测试
```

### 构建

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm run build

# 运行测试
pnpm run test:full_sdk
```

---

## 学术研究

本 SDK 支撑了 SuperPaymaster 论文的博士实验数据采集：

- **`scripts/19_sdk_experiment_runner.ts`**: 官方实验记录器
- **安全策略**: 严格版本锁定，确保数据的可重复性
- **覆盖率**: 95%用户用例分支，72个完整场景

---

## 许可证

Apache-2.0 License - 详见 [LICENSE](./LICENSE)

---

## 贡献

欢迎提交Issues和Pull Requests！请确保：

1. 所有测试通过 (`pnpm run test:full`)
2. 代码符合TypeScript规范
3. 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)

---

## 相关链接

- **SuperPaymaster 论文**: [最新版本](../SuperPaymaster/docs/)
- **Mycelium 网络**: [项目主页](https://github.com/AAStarCommunity)
- **开发者文档**: [`docs/TEST_COMMANDS.md`](./docs/TEST_COMMANDS.md)

---

**由 AAStarCommunity 维护 | Powered by Mycelium Network**
