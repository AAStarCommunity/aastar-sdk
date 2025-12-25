# 快速开始 (Quick Start)

在 5 分钟内上手使用 AAStar SDK。

## 第一步：安装 SDK

```bash
pnpm add @aastar/sdk viem
```

## 第二步：设置环境

创建一个 `.env` 文件：

```bash
RPC_URL=https://rpc.sepolia.org
PRIVATE_KEY=your_private_key_here
```

## 第三步：创建你的第一个客户端

根据你的角色选择客户端：

### 针对终端用户 (dApp 开发者)

```typescript
import { createEndUserClient } from '@aastar/core';
import { http } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const client = createEndUserClient({
  chain: sepolia,
  transport: http(process.env.RPC_URL),
  account: privateKeyToAccount(process.env.PRIVATE_KEY),
});

// 查询信用额度
const credit = await client.getCreditLimit();
console.log('可用信用余额:', credit);
```

### 针对运营商 (Paymaster 提供者)

```typescript
import { createOperatorClient, CONTRACTS } from '@aastar/core';
import { parseEther } from 'viem';

const operator = createOperatorClient({
  chain: sepolia,
  transport: http(process.env.RPC_URL),
  account: privateKeyToAccount(process.env.OPERATOR_KEY),
});

// 质押 GTokens
await operator.stake({
  amount: parseEther('100'),
});

// 向 Paymaster 存款
await operator.deposit({
  amount: parseEther('10'),
});
```

### 针对社区 (DAO 管理者)

```typescript
import { createCommunityClient } from '@aastar/core';

const community = createCommunityClient({
  chain: sepolia,
  transport: http(process.env.RPC_URL),
  account: privateKeyToAccount(process.env.COMMUNITY_KEY),
});

// 注册社区
await community.registerCommunity({
  name: 'MyAwesomeDAO',
  metadata: 'ipfs://...',
});

// 为成员铸造 SBT
await community.mintSBT({
  to: memberAddress,
  tokenId: 1n,
});
```

## 第四步：运行代码

```bash
tsx your-script.ts
```

## 常见模式

### 检查网络配置

```typescript
import { getNetwork, CONTRACTS } from '@aastar/core';

const network = getNetwork('sepolia');
console.log('Chain ID:', network.chainId);
console.log('RPC URL:', network.rpcUrl);
console.log('Registry 地址:', CONTRACTS.sepolia.registry);
```

### 异常处理

```typescript
try {
  await operator.stake({ amount: parseEther('100') });
} catch (error) {
  if (error.message.includes('insufficient balance')) {
    console.error('GToken 余额不足');
  } else {
    console.error('质押失败:', error);
  }
}
```

## 下一步

- [了解账户抽象](/guide/concepts/account-abstraction)
- [探索使用场景](/guide/use-cases/community-management)
- [阅读完整的 API 参考](/api/)
- [尝试完整示例](/examples/)

## 需要帮助？

- [GitHub Issues](https://github.com/AAStarCommunity/aastar-sdk/issues)
- [Discord](https://discord.gg/aastar)
- [官方文档站](https://docs.aastar.io)
