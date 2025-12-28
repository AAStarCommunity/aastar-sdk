# SDK API 标准化 - 重构脚本示例

本目录包含使用新 SDK APIs 重构后的实验脚本。

## 新 SDK APIs

### Utils 模块
- **KeyManager**: 密钥生成、存储、加载
- **FundingManager**: ETH/ERC20 充值、余额检查
- **StateValidator**: 角色/余额/部署验证

### Client 高层 APIs
- **CommunityClient.launch()**: 一键启动社区
- **OperatorClient.onboardOperator()**: 运营商注册
- **EndUserClient.joinAndActivate()**: 用户入驻

## 重构对比

### 之前（~100 行）
```typescript
// 手动处理充值、角色数据、交易等
const balance = await client.getBalance(...);
if (balance < threshold) {
    await wallet.sendTransaction(...);
}
const roleData = encodeAbiParameters(...);
await client.writeContract(...);
```

### 之后（~20 行）
```typescript
// 使用高层 API
await FundingManager.ensureFunding({ ... });
await communityClient.launch({ name: 'MyDAO' });
```

## 脚本列表

| 原脚本 | 重构版 | 代码减少 |
|--------|--------|----------|
| `00_token_distribution.ts` (52 行) | `refactored/00_token_distribution.ts` (45 行) | ~15% |
| `01_dao_launch.ts` (97 行) | `refactored/01_dao_launch.ts` (72 行) | ~25% |
| `02_operator_setup.ts` (77 行) | `refactored/02_operator_setup.ts` (64 行) | ~17% |
| `03_user_onboarding.ts` (76 行) | `refactored/03_user_onboarding.ts` (68 行) | ~11% |
| `05_multi_op_setup.ts` (140 行) | `refactored/05_multi_op_setup.ts` (68 行) | ~51% |

## 运行示例

```bash
# 代币分发
pnpm tsx scripts/experiment/stage3/refactored/00_token_distribution.ts

# DAO 启动
pnpm tsx scripts/experiment/stage3/refactored/01_dao_launch.ts

# 运营商设置
pnpm tsx scripts/experiment/stage3/refactored/02_operator_setup.ts

# 用户入驻
pnpm tsx scripts/experiment/stage3/refactored/03_user_onboarding.ts

# 多运营商设置
pnpm tsx scripts/experiment/stage3/refactored/05_multi_op_setup.ts
```

## 优势

1. **代码简洁**: 平均减少 20-50% 代码量
2. **易于维护**: 业务逻辑集中在 SDK
3. **类型安全**: 完整的 TypeScript 类型支持
4. **可复用**: Utils 和 Client APIs 可在任何项目中使用
