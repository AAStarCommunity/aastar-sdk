# AAStar SDK (v0.12)


The all-in-one SDK for the AAStar Infra to create your own Mycelium Network.

[中文文档](#中文文档)

## Features
*   **`@aastar/core`**: Base configurations and wrappers for `viem`.
*   **`@aastar/superpaymaster`**: Middleware for SuperPaymaster V3 (Asset-based Gas Sponsorship).

## Installation

```bash
pnpm install aastar
```

## Quick Start

### 1. Initialize Client
```typescript
import { createAAStarPublicClient, sepolia } from '@aastar/core';

const client = createAAStarPublicClient({
    chain: sepolia,
    rpcUrl: process.env.SEPOLIA_RPC_URL
});
```

### 2. SuperPaymaster Configuration
```typescript
import { getPaymasterMiddleware, checkEligibility } from '@aastar/superpaymaster';

const middleware = getPaymasterMiddleware({
    paymasterAddress: "0x...",
    operatorAddress: "0x...", // Your Community Node
    verificationGasLimit: 160000n,
    postOpGasLimit: 10000n
});

// Use in your Smart Account Config
const smartAccount = await createSmartAccountClient({
    ...
    paymasterMiddleware: middleware
});
```

## Development & Testing

### Setup
1. Copy `.env.example` to `.env` and fill in keys.
2. `pnpm install`
3. `pnpm build`

### Running Experiments (PhD Data Collection)
The script `scripts/run_experiment_data.ts` executes the 3-group comparison defined in the thesis.

```bash
npx tsx scripts/run_experiment_data.ts
```

### Prerequisites
For Group C (SuperPaymaster) tests:
1. Account must own a **MySBT** (Soulbound Token).
2. Account must have sufficient **xPNTs** (or GToken) balance.
*Use `scripts/setup_account.ts` (coming soon) or `mint-sbt-for-aa.js` reference logic to prepare accounts.*

### Local Verification & Coverage
- **[Getting Started with Local Testing](./docs/Local_Test_Guide.md)**
- **[Coverage Audit & Multi-role Matrix](./docs/Coverage_and_Scenario_Matrix.md)**

---

## 中文文档

AAStar Infra 的一体化 SDK，用于构建你自己的 Mycelium Network。

### 功能特性
*   **`@aastar/core`**: `viem` 的基础配置和封装。
*   **`@aastar/superpaymaster`**: SuperPaymaster V3 (基于资产的 Gas 赞助) 的中间件。

### 安装

```bash
pnpm install aastar
```

### 快速开始

#### 1. 初始化客户端
```typescript
import { createAAStarPublicClient, sepolia } from '@aastar/core';

const client = createAAStarPublicClient({
    chain: sepolia,
    rpcUrl: process.env.SEPOLIA_RPC_URL
});


import { createAAStarWalletClient, sepolia, http } from '@aastar/core';
import { privateKeyToAccount } from '@aastar/core'; // 也是从 viem 导出的

// 1. 初始化
const account = privateKeyToAccount('0xPrivateKey...'); 
const client = createAAStarWalletClient({ chain: sepolia, account });

// 2. 提交交易 (transfer ETH)
const hash = await client.sendTransaction({
  to: '0xRecipient...',
  value: 1000000000000000000n // 1 ETH
});

// 3. 提交交易 (transfer ERC20 - 使用 writeContract)
// const hash = await client.writeContract({ ... });

import { createAAStarBundlerClient } from '@aastar/core';

const bundler = createAAStarBundlerClient({
    chain: sepolia,
    rpcUrl: BUNDLER_RPC_URL
});

// 现在就有 sendUserOperation 方法了
const hash = await bundler.sendUserOperation({
    userOperation: userOp,
    entryPoint: ENTRY_POINT_ADDRESS
});
```
BUNDLER_RPC_URL本质上它还是一个 RPC：它像普通的以太坊节点一样接收 JSON-RPC 请求。
增强了功能：普通的以太坊节点（比如 Geth）只认识 eth_sendTransaction 等标准方法，不仅不认识 eth_sendUserOperation，甚至会因为无法解析而报错。
Bundler 的作用：Bundler RPC 实现了 ERC-4337 定义的特殊方法（比如 eth_sendUserOperation、eth_estimateUserOperationGas）。
当你调用 sendUserOperation 时，Bundler 会接收这个操作，先在自己的“替代内存池”（Alt Mempool）里验证，验证通过后，Bundler 会把它打包成一笔普通的交易（Transaction），再发送给普通的节点去上链。

#### 2. SuperPaymaster 配置
```typescript
import { getPaymasterAndData, checkEligibility } from '@aastar/superpaymaster';

const paymasterAndData = getPaymasterAndData({
    paymasterAddress: "0x...", //独立部署的V4地址或者公共合约SuperPaymaster地址
    communityAddress: "0x...", // 你的社区Operator或者多签账户地址
    xPNTsAddress: "0x...", // 你的社区发行的xPNTs地址
    verificationGasLimit: 160000n,
    postOpGasLimit: 10000n
});

// 在你的智能账户发起UserOperation交易时配置
const userOp = await client.makeUserOperation({
    ...,
    paymasterAndData
});
```

### 本地验证与覆盖率
- **[本地测试新手指南](./docs/Local_Test_Guide.md)**
- **[覆盖率核查与多角色场景矩阵](./docs/Coverage_and_Scenario_Matrix.md)**

