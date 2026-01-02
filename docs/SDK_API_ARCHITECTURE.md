# AAStar SDK API 分层架构设计

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    L3: Scenario Patterns                     │
│              (面向业务开发者 - Business Developers)            │
│  DAO Launchpad | Operator Lifecycle | User Onboarding        │
└─────────────────────────────────────────────────────────────┘
                            ↓ 编排组合
┌─────────────────────────────────────────────────────────────┐
│                    L2: Business Clients                      │
│           (面向集成开发者 - Integration Developers)            │
│   CommunityClient | OperatorClient | EndUserClient           │
└─────────────────────────────────────────────────────────────┘
                            ↓ 函数组合
┌─────────────────────────────────────────────────────────────┐
│                    L1: Core Actions                          │
│             (面向资深开发者 - Advanced Developers)            │
│  registryActions | stakingActions | superPaymasterActions    │
└─────────────────────────────────────────────────────────────┘
                            ↓ 直接映射
┌─────────────────────────────────────────────────────────────┐
│                    Smart Contracts ABIs                      │
│   Registry.sol | GTokenStaking.sol | SuperPaymaster.sol      │
└─────────────────────────────────────────────────────────────┘
```

---

## L1: Core Actions (底层 ABI API)

### 定位
**1:1 映射智能合约 ABI 的纯函数接口**

### 目标用户
1. **SDK 内部开发者** (Primary) - 构建 L2/L3 的基础
2. **资深区块链开发者** (Secondary) - 需要精细控制的自定义场景

### 特点
- ✅ 完整覆盖所有合约函数（100% ABI Coverage）
- ✅ 无业务逻辑封装，纯粹的合约调用
- ✅ 参数直接对应 Solidity 函数签名
- ✅ 返回原始的交易哈希或链上数据

### 包结构
```
packages/core/src/actions/
├── registry.ts          # Registry 合约 60 个函数
├── staking.ts           # GTokenStaking 28 个函数
├── superPaymaster.ts    # SuperPaymaster 58 个函数
├── sbt.ts               # MySBT 49 个函数
├── tokens.ts            # GToken/aPNTs/xPNTs 所有 ERC20
├── paymasterV4.ts       # PaymasterV4 48 个函数
├── factory.ts           # Factories
├── reputation.ts        # ReputationSystem
├── dvt.ts               # DVT Validator
├── aggregator.ts        # BLS Aggregator/Validator
└── account.ts           # AA 账户相关
```

### 使用示例
```typescript
import { registryActions } from '@aastar/core';

// 底层 API - 直接调用合约
const registry = registryActions(REGISTRY_ADDRESS)(client);
await registry.registerRole({ 
  roleId: ROLE_ID, 
  user: USER_ADDRESS, 
  data: encodedData,
  account 
});
```

**适用场景**：
- 自定义复杂的多步骤流程
- 调试和测试特定合约函数
- 构建非标准的业务逻辑

---

## L2: Business Clients (业务组合 API)

### 定位
**面向特定角色的高层业务封装**

### 目标用户
1. **DApp 集成开发者** (Primary) - 快速集成 AAStar 功能
2. **后端服务开发者** - 构建 API 服务
3. **智能合约开发者** - 链下交互

### 特点
- ✅ 角色导向：Community、Operator、EndUser、Admin
- ✅ 业务逻辑封装：自动处理前置条件、批量操作
- ✅ 错误处理和重试机制
- ✅ 参数验证和智能默认值
- ✅ 返回结构化的业务对象

### 包结构
```
packages/sdk/src/clients/
├── community.ts         # 社区管理
├── operator.ts          # 运营商管理
├── endUser.ts           # 终端用户
└── admin.ts             # 管理员

每个 Client 内部调用 L1 Actions
```

### 使用示例
```typescript
import { createCommunityClient } from '@aastar/sdk';

// 业务 API - 自动处理复杂流程
const communityClient = createCommunityClient({ chain, transport, account });

// 一键启动社区（内部组合多个 L1 actions）
const result = await communityClient.launch({
  name: "My DAO",
  tokenName: "DAO Token",
  tokenSymbol: "DAO",
  description: "A community DAO",
  website: "https://mydao.com"
});

// 自动完成：
// 1. 生成唯一名称
// 2. 编码 roleData
// 3. Approve GToken
// 4. 注册 COMMUNITY 角色
// 5. 部署 xPNTs 代币
// 6. 返回结构化结果
```

**适用场景**：
- DApp 前端集成
- 后端 API 服务
- 标准业务流程快速实现

---

## L3: Scenario Patterns (场景化模式)

### 定位
**端到端业务场景的最佳实践模板**

### 目标用户
1. **产品开发者** (Primary) - 快速构建应用原型
2. **业务分析师** - 理解业务流程
3. **新手开发者** - 学习参考

### 特点
- ✅ 完整的端到端流程
- ✅ 最佳实践和安全模式
- ✅ 包含前端 UI 示例
- ✅ 可复制的代码模板

### 包结构
```
examples/scenarios/
├── 01_dao_launchpad.ts          # DAO 启动模式
├── 02_operator_lifecycle.ts     # 运营商全生命周期
├── 03_user_onboarding.ts        # 用户注册激活
├── 04_gasless_transaction.ts    # 免 gas 交易
├── 05_credit_system.ts          # 信用体系
└── 06_reputation_staking.ts     # 信誉质押
```

### 使用示例
```typescript
// Scenario Pattern - 完整的 DAO 启动流程
import { DAOLaunchpadPattern } from '@aastar/patterns';

const pattern = new DAOLaunchpadPattern({ 
  chain, 
  transport, 
  adminAccount 
});

// 一键完成 DAO 从 0 到 1
const dao = await pattern.launch({
  community: {
    name: "Research DAO",
    description: "...",
    initialStake: parseEther('100')
  },
  governance: {
    votingPeriod: 7 * 24 * 3600,
    quorum: 0.2
  },
  treasury: {
    initialFunds: parseEther('1000')
  }
});

// 自动完成：
// 1. 社区注册
// 2. 代币发行
// 3. 多签设置
// 4. 治理合约部署
// 5. 初始资金注入
// 6. 返回完整的 DAO 对象
```

**适用场景**：
- 快速原型开发
- 教学和演示
- 标准化业务模板

---

## 分层对比表

| 层级 | 目标用户 | 抽象程度 | 易用性 | 灵活性 | 使用场景 |
|------|---------|---------|--------|--------|---------|
| **L3 Patterns** | 产品开发 | 最高 | ⭐⭐⭐⭐⭐ | ⭐⭐ | 标准业务快速实现 |
| **L2 Clients** | DApp 集成 | 中 | ⭐⭐⭐⭐ | ⭐⭐⭐ | 90% 业务需求 |
| **L1 Actions** | 资深开发 | 低 | ⭐⭐ | ⭐⭐⭐⭐⭐ | 自定义复杂逻辑 |

---

## 当前实施状态

### ✅ L1: Core Actions (100% 目标)
- ✅ Registry (60 functions) - 已完成
- ✅ GTokenStaking (28 functions) - 已完成
- ⏳ SuperPaymaster (58 functions) - 进行中
- ⏳ MySBT (49 functions) - 待补充
- ⏳ Tokens (100+ functions) - 待补充
- ⏳ 其他合约 (200+ functions) - 待补充

### ✅ L2: Business Clients (90% 完成)
- ✅ CommunityClient - 完整
- ✅ OperatorClient - 完整
- ✅ EndUserClient - 完整
- ✅ AdminClient - 完整

### ✅ L3: Scenario Patterns (75% 完成)
- ✅ DAO Launchpad - 已实现 (Scenario 1)
- ✅ Operator Lifecycle - 已实现 (Scenario 2)
- ✅ User Onboarding - 已实现 (Scenario 3)
- ⏳ Gasless Transaction - 部分实现 (Scenario 4)
- ⏳ Credit System - 待实现
- ⏳ Reputation Staking - 待实现

---

## 文档策略

### L1 文档 (API Reference)
**目标**：完整的技术参考手册

```
docs/api-reference/
├── L1-Core-Actions/
│   ├── registry.md      # 60 个函数详细说明
│   ├── staking.md       # 28 个函数详细说明
│   └── ...
```

**内容**：
- 函数签名
- 参数说明
- 返回值类型
- 使用示例
- 对应的 Solidity 合约

### L2 文档 (Integration Guide)
**目标**：快速集成指南

```
docs/integration/
├── community-client.md   # 社区管理集成
├── operator-client.md    # 运营商集成
└── enduser-client.md     # 用户集成
```

**内容**：
- 业务流程图
- 快速开始
- 常见用例
- 错误处理
- 最佳实践

### L3 文档 (Tutorials)
**目标**：端到端教程

```
docs/tutorials/
├── launch-your-dao.md      # 启动 DAO 教程
├── become-an-operator.md   # 成为运营商
└── build-gasless-app.md    # 构建免 gas 应用
```

**内容**：
- 业务背景
- 步骤详解
- 完整代码
- 视频演示
- 故障排查

---

## 测试策略

### L1 测试：单元测试
```typescript
// packages/core/tests/actions/registry.test.ts
describe('Registry Actions', () => {
  it('should register role', async () => {
    const result = await registry.registerRole({...});
    expect(result).toBeDefined();
  });
  
  // 测试所有 60 个函数
});
```

### L2 测试：集成测试
```typescript
// packages/sdk/tests/clients/community.test.ts
describe('Community Client', () => {
  it('should launch community end-to-end', async () => {
    const result = await communityClient.launch({...});
    expect(result.tokenAddress).toMatch(/^0x/);
  });
});
```

### L3 测试：场景测试（已有）
```bash
./run_sdk_regression.sh --env anvil --scenarios-only
```

---

## 建议的 Package 暴露策略

### @aastar/core (L1)
```typescript
// 暴露所有底层 actions
export * from './actions/registry';
export * from './actions/staking';
// ... 所有 actions
```

### @aastar/sdk (L2 + L3)
```typescript
// 默认暴露 L2 Clients
export * from './clients/community';
export * from './clients/operator';
export * from './clients/endUser';
export * from './clients/admin';

// 可选暴露 L1（给资深开发者）
export * as CoreActions from '@aastar/core/actions';

// 可选暴露 L3 Patterns
export * from './patterns';
```

### 使用示例
```typescript
// 一般开发者 - 使用 L2
import { createCommunityClient } from '@aastar/sdk';

// 资深开发者 - 直接使用 L1
import { CoreActions } from '@aastar/sdk';
const { registryActions } = CoreActions;

// 产品开发者 - 使用 L3
import { DAOLaunchpadPattern } from '@aastar/sdk/patterns';
```

---

## 总结

这个三层架构设计：
1. **L1 Actions** - 100% ABI 覆盖，服务资深开发者和 SDK 内部
2. **L2 Clients** - 角色导向的业务封装，服务 90% 开发者
3. **L3 Patterns** - 场景化模板，服务快速原型和学习

**当前任务**：
1. ✅ 继续完成 L1 的 100% ABI 覆盖
2. ⏭️ 完成后统一测试
3. ⏭️ 补充文档

继续执行 L1 补充工作！
