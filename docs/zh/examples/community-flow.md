# 社区流程 (Community Flow)

本示例演示了社区管理员如何注册社区并为成员配置声誉规则。

## 关键步骤

1.  **注册**: 在 Registry 中登记社区信息。
2.  **配置 SBT**: 设置灵魂绑定代币的元数据及其发放规则。
3.  **铸造 (Mint)**: 为新加入的成员分发 SBT。
4.  **声誉规则 (Reputation)**: 设置基于链上行为的自动积分逻辑。

## 代码预览

```typescript
import { createCommunityClient } from '@aastar/sdk';

const community = createCommunityClient({
  // ... 配置项
});

// 1. 注册新社区
await community.registerCommunity({
  name: '创新开发者 DAO',
  metadata: 'ipfs://Qm...',
});

// 2. 为成员分发身份标识
await community.mintSBT({
  to: '0xMemberAddress',
  tokenId: 1n,
});
```

## 运行方式

```bash
pnpm run example:community
```
