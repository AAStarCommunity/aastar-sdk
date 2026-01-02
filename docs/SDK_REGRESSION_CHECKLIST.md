# SDK Stage 3 回归测试清单

## Phase 1: SDK 构建验证 ✅ / ⚠️ / ❌

### 1.1 构建流程
- [ ] `pnpm -F "@aastar/*" build` 成功完成
- [ ] 所有 packages 的 dist 目录正确生成
- [ ] 类型声明文件 (.d.ts) 正确输出

### 1.2 包依赖检查
- [ ] @aastar/core - 基础层
- [ ] @aastar/account - 账户抽象
- [ ] @aastar/analytics - 数据分析
- [ ] @aastar/community - 社区管理
- [ ] @aastar/enduser - 终端用户
- [ ] @aastar/identity - 身份认证
- [ ] @aastar/operator - 运营商
- [ ] @aastar/paymaster - Paymaster
- [ ] @aastar/sdk - 主SDK
- [ ] @aastar/tokens - 代币管理

---

## Phase 2: 基础层 API 回归测试

### 2.1 RegistryActions
- [ ] `registerCommunity()` - 社区注册
- [ ] `joinCommunity()` - 加入社区
- [ ] `getCommunityInfo()` - 查询社区信息
- [ ] `leaveCommunity()` - 退出社区

### 2.2 SuperPaymasterActions
- [ ] `validatePaymasterUserOp()` - Paymaster 验证
- [ ] `postOp()` - 后处理逻辑
- [ ] `getPaymasterData()` - 获取 Paymaster 数据

### 2.3 GTokenStakingActions
- [ ] `stake()` - 质押
- [ ] `unstake()` - 解质押
- [ ] `getStakedAmount()` - 查询质押量

### 2.4 PaymasterFactoryActions
- [ ] `deployPaymaster()` - 部署 Paymaster
- [ ] `calculateAddress()` - 计算地址

---

## Phase 3: 业务层 Client 回归测试

### 3.1 CommunityClient
- [ ] `onboardCommunity()` - 社区启动组合操作
- [ ] `getCommunityInfo()` - 状态查询
- [ ] `deployXPNTs()` - 代币发行

### 3.2 OperatorClient
- [ ] `setupNode()` - 节点配置
- [ ] `depositCollateral()` - 质押充值
- [ ] `getOperatorStatus()` - 状态查询

### 3.3 EndUserClient
- [ ] `joinAndActivate()` - 用户注册激活
- [ ] `deploySmartAccount()` - AA 账户部署
- [ ] `createSmartAccount()` - AA 账户预测
- [ ] `executeGasless()` - Gasless 交易（Sepolia 修复）

---

## Phase 4: Anvil 场景测试

### 4.1 Scenario 1: DAO Launchpad Pattern
- [x] 社区注册成功
- [x] GToken 质押验证
- [x] 事件监听正确

### 4.2 Scenario 2: Operator Lifecycle
- [x] 运营商质押成功
- [x] Paymaster 部署成功
- [x] 权限映射正确

### 4.3 Scenario 3: User Onboarding & Credit
- [x] AA 账户部署成功
- [x] 用户加入社区成功
- [x] SBT 铸造成功（如有）

### 4.4 Scenario 4: Gasless Transaction
- [x] Nonce 获取逻辑修复
- [ ] handleOps 验证（留待 Sepolia）

---

## Phase 5: 冒烟测试脚本
- [ ] 运行完整回归套件
- [ ] 生成测试报告
- [ ] 记录性能指标

---

## 备注
- Scenario 4 的 handleOps 问题将在 Sepolia 环境调试
- 当前重点：确保 Scenarios 1-3 完全通过
