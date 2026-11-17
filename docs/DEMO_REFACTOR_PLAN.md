# Demo 重构计划

## 项目目标
创建一个基于 SDK 高层 API (99%) 的交互式演示系统，提供清晰的左右分栏界面，展示 AAStar 生态系统的完整生命周期。

## UI/UX 架构设计

### 界面布局
```
┌─────────────────────────────────────────────────────────┐
│                      AAStar Demo                         │
├──────────────┬──────────────────────────────────────────┤
│              │                                           │
│  左侧导航栏  │            右侧内容区域                   │
│              │                                           │
│  ┌────────┐  │  ┌─────────────────────────────────────┐ │
│  │ Step 1 │  │  │                                     │ │
│  │Accounts│  │  │    当前步骤的详细信息和操作界面      │ │
│  └────────┘  │  │                                     │ │
│  ┌────────┐  │  │  - 显示历史记录                     │ │
│  │ Step 2 │  │  │  - 显示当前状态                     │ │
│  │Community│  │  │  - 提供操作按钮                     │ │
│  └────────┘  │  │  - 实时反馈                         │ │
│  ┌────────┐  │  │                                     │ │
│  │ Step 3 │  │  └─────────────────────────────────────┘ │
│  │Operator│  │                                           │
│  └────────┘  │                                           │
│  ┌────────┐  │                                           │
│  │ Step 4 │  │                                           │
│  │End User│  │                                           │
│  └────────┘  │                                           │
│              │                                           │
└──────────────┴──────────────────────────────────────────┘
```

### 分步骤功能设计

#### Step 1: Account Management (账户管理)
**右侧显示内容**
- 账户列表表格

| 名称    | 地址              | ETH 余额 | GToken 余额 | 操作    |
|---------|-------------------|----------|-------------|---------|
| Alice   | 0xB6D3...         | 0.1000   | 200.00      | [选择]  |
| Bob     | 0x2944...         | 0.1000   | 200.00      | [选择]  |
| Charlie | 0xa74f...         | 0.1000   | 100.00      | [选择]  |

**操作按钮**
- `+ 新建账户` - 生成新的 EOA 账户
- `刷新余额` - 更新所有账户余额
- `充值选中账户` - 为选中账户充值 ETH 和 GToken

**SDK API 需求**
- ✅ `KeyManager.generateAccount()` - 生成账户
- ✅ `FundingManager.fundWithETH()` - ETH 充值
- ✅ `FundingManager.fundWithToken()` - Token 充值
- 🆕 `StateValidator.getAccountBalances()` - 批量查询余额

#### Step 2: Launch Community (启动社区)
**右侧显示内容**
- 当前账户状态卡片
  ```
  选中账户: Alice (0xB6D3...)
  ┌─────────────────────────────────────┐
  │ 社区状态                             │
  ├─────────────────────────────────────┤
  │ ✅ 已注册 COMMUNITY 角色             │
  │ ✅ 已部署社区 Token                  │
  │                                     │
  │ Token 地址: 0xb65D...               │
  │ Token 名称: DemoDAO_xxx             │
  │ 注册时间: 2024-12-29 11:37          │
  └─────────────────────────────────────┘
  ```

**操作流程**
- 如果未注册：显示 `[启动新社区]` 表单
  - 社区名称输入框
  - ENS 名称（可选）
  - 描述（可选）
  - `[确认启动]` 按钮
- 如果已注册：显示社区详情 + `[查看 Token 详情]`

**SDK API 需求**
- ✅ `CommunityClient.launch()` - 启动社区
- 🆕 `CommunityClient.getCommunityInfo(account)` - 查询社区信息
  ```typescript
  {
    hasRole: boolean;
    tokenAddress: Address | null;
    communityData: {
      name: string;
      ensName: string;
      createdAt: number;
    } | null;
  }
  ```

#### Step 3: Setup Operator (运营商设置)
**右侧显示内容**
- 运营商类型选择
  ```
  选中账户: Bob (0x2944...)
  请选择运营商类型：
  ┌──────────────────────────────────────┐
  │ ⭕ SuperPaymaster (推荐)              │
  │    - 跨社区共享流动性                │
  │    - 支持多 Token 支付               │
  │    - 需要质押 50 GToken + 存入 aPNTs │
  └──────────────────────────────────────┘
  ┌──────────────────────────────────────┐
  │ ⭕ Paymaster V4 (独立)                │
  │    - 社区独立部署                    │
  │    - 单一 Token 支付                 │
  │    - 需要指定 Token 和 SBT           │
  └──────────────────────────────────────┘
  ```

- 已注册状态显示
  ```
  ┌─────────────────────────────────────┐
  │ SuperPaymaster 运营商                │
  ├─────────────────────────────────────┤
  │ ✅ 已质押: 50 GToken                 │
  │ ✅ 已存入: 100 aPNTs                 │
  │ 📊 可用余额: 75 aPNTs                │
  │ 🏦 Treasury: 0x2944...              │
  │ 📈 Exchange Rate: 1:1               │
  └─────────────────────────────────────┘
  ```

**操作:**
- `[追加存款]` `[提取余额]` `[修改配置]`

**SDK API 需求**
- ✅ `OperatorClient.onboardOperator()` - 注册运营商（SuperPaymaster）
- ✅ `OperatorClient.deployPaymasterV4()` - 部署 Paymaster V4
- 🆕 `OperatorClient.getOperatorInfo(account)` - 查询运营商状态
  ```typescript
  {
    type: 'super' | 'v4' | null;
    superPaymaster: {
      isConfigured: boolean;
      balance: bigint;
      exchangeRate: bigint;
      treasury: Address;
    } | null;
    paymasterV4: {
      address: Address;
      token: Address;
      balance: bigint;
    } | null;
  }
  ```
- 🆕 `OperatorClient.depositFunds(amount)` - 追加存款
- 🆕 `OperatorClient.withdrawFunds(amount)` - 提取余额

#### Step 4: Onboard End User (用户入驻)
**右侧显示内容**
- 用户账户来源选择
  ```
  选择用户账户类型：
  ┌──────────────────────────────────────┐
  │ ⭕ 从现有 EOA 创建                    │
  │    选择账户: [下拉列表]              │
  │    [创建 AA 账户]                    │
  └──────────────────────────────────────┘
  ┌──────────────────────────────────────┐
  │ ⭕ 生成新的 Simple Account           │
  │    盐值: [自动生成]                  │
  │    [部署新账户]                      │
  └──────────────────────────────────────┘
  ```

- 用户状态显示
  ```
  ┌─────────────────────────────────────┐
  │ AA Account: 0x1234...               │
  ├─────────────────────────────────────┤
  │ 📍 已部署                            │
  │ 👤 Owner: Alice (0xB6D3...)         │
  │ 💰 余额:                             │
  │    - 0.05 ETH                       │
  │    - 50 xPNTs (社区 Token)          │
  │    - 100 aPNTs                      │
  │                                     │
  │ 🎫 SBT 持有:                         │
  │    - MySBT #1234 (已mint)           │
  └─────────────────────────────────────┘
  ```

**操作:**
- `[充值 xPNTs]` `[Mint SBT]` `[发送 UserOp]`

**SDK API 需求**
- 🆕 `EndUserClient.deployAccount(owner, salt?)` - 部署 AA 账户
- 🆕 `EndUserClient.getAccountInfo(address)` - 查询 AA 账户信息
- 🆕 `EndUserClient.mintSBT(account)` - 为用户 Mint SBT
- 🆕 `EndUserClient.fundWithXPNTs(account, amount)` - 充值社区 Token
- ✅ `EndUserClient.sendUserOp()` - 发送 UserOperation

## SDK API 增强计划

### 优先级分类
**P0 - 立即实现（状态查询类）**
- `CommunityClient.getCommunityInfo(account: Address)`
- `OperatorClient.getOperatorInfo(account: Address)`
- `StateValidator.getAccountBalances(addresses: Address[])`

**P1 - 高优先级（核心功能）**
- `EndUserClient.deployAccount(owner: Address, salt?: bigint)`
- `EndUserClient.mintSBT(account: Address)`
- `OperatorClient.depositFunds(amount: bigint)`
- `OperatorClient.withdrawFunds(amount: bigint)`

**P2 - 中优先级（增强功能）**
- `EndUserClient.getAccountInfo(address: Address)`
- `EndUserClient.fundWithXPNTs(account: Address, amount: bigint)`

### 回归脚本分析
需要从以下脚本中提取功能：

**社区相关**
- ✅ `01_register_community_raw.ts` - 已提取为 `CommunityClient.launch()`
- 📋 `09_local_test_community_lifecycle.ts` - 社区生命周期完整流程

**运营商相关**
- ~~`deploy_paymaster_v4.ts`~~ - 已删除（#457）：它调用的工厂函数已不存在、还从 env 读私钥；部署 Paymaster V4 用 `PaymasterOperatorClient`
- 📋 `05_test_superpaymaster.ts` - SuperPaymaster 完整设置流程
  - Line 114-199: `setupOperator` 函数（包含配置和存款）

**用户相关**
- 📋 `deploy_test_accounts.ts` - AA 账户部署逻辑
- 📋 `03_test_standard_aa.ts` - AA 交互流程

## 实现路线图

### 阶段 1: 修复当前错误 ✅
- [x] 修复 account undefined 错误
- [x] 修复 gToken undefined 错误
- [x] 确保 SDK 构建成功

### 阶段 2: SDK API 增强 (1-2天)
- [ ] 实现 P0 状态查询 API
- [ ] 从回归脚本提取 `setupOperator` 的配置逻辑
- [ ] 从 `deploy_test_accounts.ts` 提取 AA 部署逻辑
- [ ] 添加单元测试

### 阶段 3: UI 重构 (2-3天)
- [ ] 重构 index.html 为左右分栏布局
- [ ] 实现 Step 1: Account Management
- [ ] 实现 Step 2: Launch Community（状态查询 + 操作）
- [ ] 实现 Step 3: Setup Operator（类型选择 + 状态查询）
- [ ] 实现 Step 4: Onboard End User

### 阶段 4: 集成测试 (1天)
- [ ] 端到端流程测试
- [ ] 性能优化
- [ ] 错误处理完善

## 技术细节

### 前端状态管理
```javascript
const demoState = {
  selectedAccount: null,      // 当前选中的账户
  currentStep: 1,              // 当前步骤
  accounts: [],                // 账户列表
  communityInfo: {},           // 社区信息缓存
  operatorInfo: {},            // 运营商信息缓存
  aaAccounts: []               // AA 账户列表
};
```

### API 响应格式规范
所有 SDK API 应返回统一格式：
```typescript
interface SDKResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  txHashes?: Hash[];
}
```

## 下一步行动
- ✅ 立即修复: 修复 operator 设置中的地址问题
- 📝 规划审查: 用户审查本计划，提供反馈
- 🔨 开始实施: 按阶段实施
