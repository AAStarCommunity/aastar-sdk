# 多链配置 (Multi-Chain Setup)

AAStar SDK 原生支持多链架构，允许开发者在不同的 EVM 网络上无缝切换。

## 支持的网络

目前 SDK 预置了以下网络配置：

- **Sepolia**: 默认主测试网。
- **OP Sepolia**: 用于测试 L2 性能的优化网络。
- **Foundry/Anvil**: 用于极速迭代的本地网络。

## 网络切换示例

```typescript
import { createEndUserClient } from '@aastar/sdk';
import { optimismSepolia } from 'viem/chains';
import { http } from 'viem';

// 切换到 Optimism Sepolia
const user = createEndUserClient({
  chain: optimismSepolia,
  transport: http('https://opt-sepolia.g.alchemy.com/v2/...'),
  account: myAccount,
});

// SDK 会自动注入该链的官方合约地址
console.log('当前 Registry 地址:', user.addresses.registry);
```

## 自定义网络

如果使用的是私有链或未预置的测试网：

```typescript
const customUser = createEndUserClient({
  chain: myCustomChain,
  transport: http(),
  account: myAccount,
  addresses: {
    registry: '0x...',
    superPaymaster: '0x...',
    // ... 手动指定合约地址
  }
});
```
