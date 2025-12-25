# 运营商流程 (Operator Flow)

本示例展示了如何使用 `OperatorClient` 来质押代币并注册成为 SuperPaymaster 提供者。

## 关键步骤

1.  **初始化**: 创建 `OperatorClient`。
2.  **质押 (Staking)**: 向合约质押 GTokens。
3.  **存款 (Deposit)**: 向 Paymaster 资金池存入代币以供用户使用。
4.  **状态查询**: 验证运营商的在线状态和抵押率。

## 代码预览

```typescript
import { createOperatorClient } from '@aastar/sdk';
import { parseEther } from 'viem';

const operator = createOperatorClient({
  // ... 配置项
});

// 1. 质押 100 GTokens
await operator.stake({
  amount: parseEther('100'),
});

// 2. 存入 10 ETH 作为 Gas 储备
await operator.deposit({
  amount: parseEther('10'),
});
```

## 运行方式

```bash
pnpm run example:operator
```
