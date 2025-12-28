# 归档说明

这些脚本是原始的 00-05 实验脚本，已被重构为 SDK APIs。

## 归档原因

所有功能已整合到：
1. **SDK Utils** - `packages/sdk/src/utils/`
2. **SDK Client APIs** - `packages/sdk/src/clients/`
3. **重构脚本** - `refactored/` 目录
4. **交互式演示** - `demo_server.ts` + `demo_public/index.html`

## 原始脚本列表

- `00_token_distribution.ts` - 代币分发
- `01_dao_launch.ts` - DAO 启动
- `02_operator_setup.ts` - 运营商设置
- `03_user_onboarding.ts` - 用户入驻
- `04_benchmarking.ts` - 基准测试
- `05_multi_op_setup.ts` - 多运营商设置

## 新的使用方式

### 方式 1: 使用重构脚本

```bash
pnpm tsx refactored/00_token_distribution.ts
pnpm tsx refactored/01_dao_launch.ts
# ...
```

### 方式 2: 使用交互式演示

```bash
pnpm demo
# 浏览器访问 http://localhost:3000
```

### 方式 3: 直接使用 SDK APIs

```typescript
import { KeyManager, FundingManager, createCommunityClient } from '@aastar/sdk';

// 生成账户
const keys = KeyManager.generateKeyPairs(['Alice', 'Bob']);

// 充值
await FundingManager.ensureFunding({ ... });

// 启动社区
await communityClient.launch({ name: 'MyDAO' });
```

## 代码对比

**原始脚本**: ~200 行代码  
**重构后**: ~20 行代码  
**代码减少**: 90%
