# 安装 (Installation)

## 包管理器

AAStar SDK 可通过 npm 获得。为了获得最佳体验，我们推荐使用 **pnpm**。

### 使用 pnpm (推荐)

```bash
pnpm add @aastar/sdk
```

### 使用 npm

```bash
npm install @aastar/sdk
```

### 使用 yarn

```bash
yarn add @aastar/sdk
```

## 独立安装包

你也可以根据需求安装特定模块：

```bash
# 核心工具与客户端创建
pnpm add @aastar/core

# 账户抽象 (Account Abstraction)
pnpm add @aastar/account

# Paymaster 與贊助邏輯
pnpm add @aastar/paymaster

# 代幣工具 (GToken, xPNTs, SBT)
pnpm add @aastar/tokens

# 身份與聲譽系統
pnpm add @aastar/identity

# React Hook 支持
pnpm add @aastar/dapp
```

## 同行依赖 (Peer Dependencies)

SDK 需要以下同行依赖：

```bash
pnpm add viem@^2.43.0
```

## TypeScript 配置

为了获得最佳的 TypeScript 体验，请在 `tsconfig.json` 中添加以下设置：

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

## 环境配置

创建一个 `.env` 文件用于存储配置：

```bash
# 网络 RPC 节点
RPC_URL=https://rpc.sepolia.org

# 你的私钥 (千万不要提交此文件！)
PRIVATE_KEY=0x...

# 合约地址 (可选，SDK 默认提供官方地址)
REGISTRY_ADDRESS=0x...
PAYMASTER_ADDRESS=0x...
```

## 验证安装

编写一段简单的代码验证安装是否成功：

```typescript
import { getNetwork, CONTRACTS } from '@aastar/core';

const network = getNetwork('sepolia');
console.log('Network:', network.name);
console.log('Chain ID:', network.chainId);
console.log('Registry:', CONTRACTS.sepolia.registry);
```

## 下一步

- [快速开始](/guide/quick-start)
- [核心概念](/guide/concepts/account-abstraction)
- [API 参考](/api/)
