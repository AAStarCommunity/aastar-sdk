# 终端用户流程 (End User Flow)

本示例展示了普通用户如何利用社区信用实现 Gasless (免 Gas) 交易。

## 关键步骤

1.  **账户连接**: 识别或创建用户的智能账户 (Smart Account)。
2.  **信用查询**: 确认用户在目标社区是否有足够的可用信用。
3.  **构造交易**: 准备业务数据（如 Token 转账或合约调用）。
4.  **免 Gas 发送**: 调用 `sendGaslessTransaction`，由 SuperPaymaster 支付手续费。

## 代码预览

```typescript
import { createEndUserClient } from '@aastar/sdk';

const user = createEndUserClient({
  // ... 配置项
});

// 使用社区信用发起转账，无需持有 ETH
await user.sendGaslessTransaction({
  to: '0xTargetReceiver',
  data: '0x...',
  communityAddress: '0xMyCommunity',
});
```

## 运行方式

```bash
pnpm run example:enduser
```
