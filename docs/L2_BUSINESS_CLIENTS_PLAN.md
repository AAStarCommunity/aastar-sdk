# L2 Business Clients 开发计划

## 🎯 L2 层目标

基于完整的 L1 Core Actions，构建**角色导向**的高层业务客户端，封装端到端业务逻辑。

---

## 📋 L2 架构设计

### 核心原则

1. **角色导向** - 按用户角色划分 Client
2. **业务完整** - 封装完整业务流程
3. **简化接口** - 隐藏底层复杂性
4. **组合 L1** - 复用所有 L1 actions

### 四大角色 Client

```
L2 Business Clients
├── CommunityClient      - 社区管理者
├── PaymasterOperatorClient  - Paymaster 运营商
├── UserClient           - 终端用户
└── DAOClient            - DAO 治理者
```

---

## 1️⃣ CommunityClient - 社区管理者

### 目标用户
社区创建者和管理员

### 核心功能

#### 1.1 社区创建与配置
- `createCommunity(name, ensName)` - 创建社区并注册
- `deployCommunityToken(name, symbol)` - 部署社区代币（xPNTs）
- `configureCommunity(config)` - 配置社区参数

#### 1.2 成员管理
- `getMemberships()` - 获取所有成员
- `getActiveMemberships()` - 获取活跃成员
- `verifyCommunityMembership(user)` - 验证成员资格
- `airdropSBT(users, metadata)` - 批量空投 SBT

#### 1.3 角色管理
- `createRole(name, config)` - 创建自定义角色
- `configureRole(roleId, config)` - 配置角色参数
- `assignRole(user, roleId)` - 分配角色
- `revokeRole(user, roleId)` - 撤销角色

#### 1.4 信誉系统
- `setReputationRule(ruleId, rule)` - 设置信誉规则
- `computeMemberScore(user)` - 计算成员积分
- `getCommunityRanking()` - 获取排行榜

### 使用示例

```typescript
import { CommunityClient } from '@aastar/enduser';

const community = new CommunityClient({
  registryAddress: REGISTRY,
  sbtAddress: MYSBT,
  factoryAddress: XPNTS_FACTORY,
  client: walletClient,
});

// 创建社区
const { communityAddress, tokenAddress } = await community.createCommunity({
  name: 'Web3 Builders',
  ensName: 'web3builders.eth',
  tokenSymbol: 'W3B',
});

// 空投 SBT
await community.airdropSBT({
  users: ['0x...', '0x...'],
  metadata: { tier: 'founder' },
});

// 设置信誉规则
await community.setReputationRule({
  ruleId: '0x01',
  rule: {
    activityWeight: 50,
    contributionWeight: 50,
  },
});
```

---

## 2️⃣ PaymasterOperatorClient - Paymaster 运营商

### 目标用户
Paymaster 运营商（赞助交易的服务提供者）

### 核心功能

#### 2.1 运营商注册与配置
- `registerAsOperator()` - 注册为 Paymaster 运营商
- `configureOperator(config)` - 配置运营参数
- `deployPaymaster(owner)` - 部署自己的 Paymaster

#### 2.2 资金管理
- `deposit(amount)` - 充值到 SuperPaymaster
- `withdraw(amount)` - 提取资金
- `getBalance()` - 查询余额
- `getAvailableCredit(user)` - 查询用户额度

#### 2.3 赞助策略
- `setSponsorshipPolicy(policy)` - 设置赞助策略
- `updateExchangeRate(rate)` - 更新兑换率
- `setPause(paused)` - 暂停/恢复服务
- `setOperatorLimits(limits)` - 设置运营限制

#### 2.4 监控与审计
- `getOperatorStats()` - 获取运营统计
- `getSlashHistory()` - 查询 Slash 历史
- `getReputationScore()` - 查询信誉评分
- `getRevenueReport()` - 获取收益报告

### 使用示例

```typescript
import { PaymasterOperatorClient } from '@aastar/operator';

const operator = new PaymasterOperatorClient({
  superPaymasterAddress: SUPER_PAYMASTER,
  registryAddress: REGISTRY,
  client: walletClient,
});

// 注册并配置
await operator.registerAsOperator();

await operator.configureOperator({
  xPNTsToken: TOKEN_ADDRESS,
  treasury: TREASURY_ADDRESS,
  exchangeRate: 100n, // 1 xPNTs = 100 wei
});

// 充值
await operator.deposit({ amount: parseEther('10') });

// 设置赞助策略
await operator.setSponsorshipPolicy({
  maxGasPerOp: 500000n,
  dailyLimit: parseEther('1'),
  whitelistedUsers: ['0x...'],
});

// 监控
const stats = await operator.getOperatorStats();
console.log('Today sponsored:', stats.sponsoredCount);
console.log('Revenue:', stats.revenue);
```

---

## 3️⃣ UserClient - 终端用户

### 目标用户
普通终端用户（使用 AA 账户的用户）

### 核心功能

#### 3.1 账户管理
- `createAccount(owner, salt)` - 创建 AA 账户
- `getAccountAddress(owner, salt)` - 预测账户地址
- `getNonce()` - 获取 nonce

#### 3.2 SBT 管理
- `mintSBT(roleId)` - 铸造 SBT
- `getMySBTs()` - 获取我的 SBTs
- `getMemberships()` - 获取社区成员资格
- `leaveCommunity(community)` - 退出社区

#### 3.3 积分操作
- `getBalance(token)` - 查询代币余额
- `transfer(to, amount, token)` - 转账
- `claimRewards()` - 领取奖励

#### 3.4 赞助操作
- `executeWithSponsorship(target, calldata)` - 使用赞助执行操作
- `batchExecuteWithSponsorship(calls)` - 批量执行
- `getAvailableCredit(operator)` - 查询可用额度

### 使用示例

```typescript
import { UserClient } from '@aastar/enduser';

const user = new UserClient({
  accountAddress: MY_ACCOUNT,
  registryAddress: REGISTRY,
  sbtAddress: MYSBT,
  superPaymasterAddress: SUPER_PAYMASTER,
  client: walletClient,
});

// 铸造 SBT
const tokenId = await user.mintSBT({
  roleId: ROLE_ENDUSER,
});

// 查看我的成员资格
const memberships = await user.getMemberships();
console.log('I am member of:', memberships.length, 'communities');

// 使用赞助执行操作
const hash = await user.executeWithSponsorship({
  target: NFT_CONTRACT,
  calldata: mintCalldata,
  operator: OPERATOR_ADDRESS,
});
```

---

## 4️⃣ DAOClient - DAO 治理者

### 目标用户
DAO 成员、提案者、投票者

### 核心功能

#### 4.1 提案管理
- `createProposal(target, calldata, description)` - 创建提案
- `getProposal(proposalId)` - 查询提案
- `getProposalState(proposalId)` - 获取提案状态
- `cancelProposal(proposalId)` - 取消提案

#### 4.2 投票管理
- `signProposal(proposalId)` - 签名支持提案
- `hasVoted(proposalId, validator)` - 检查是否已投票
- `getSignatureCount(proposalId)` - 获取签名数

#### 4.3 执行操作
- `executeWithProof(proposalId, signatures)` - 执行提案（DVT）
- `executeWithBLS(proposalId, blsSignature)` - 执行提案（BLS）

#### 4.4 验证器管理
- `getValidators()` - 获取验证器列表
- `addValidator(validator)` - 添加验证器
- `removeValidator(validator)` - 移除验证器
- `setThreshold(threshold)` - 设置阈值

### 使用示例

```typescript
import { DAOClient } from '@aastar/operator';

const dao = new DAOClient({
  dvtValidatorAddress: DVT_VALIDATOR,
  blsAggregatorAddress: BLS_AGGREGATOR,
  client: walletClient,
});

// 创建提案
const proposalId = await dao.createProposal({
  target: TREASURY,
  calldata: transferCalldata,
  description: 'Transfer 10 ETH to community fund',
});

// 签名提案
await dao.signProposal({ proposalId });

// 检查状态
const state = await dao.getProposalState({ proposalId });
if (state === ProposalState.Succeeded) {
  // 执行
  await dao.executeWithProof({
    proposalId,
    signatures: collectedSignatures,
  });
}
```

---

## 📦 实现计划

### Phase 1: 基础架构 (1-2天)

1. 创建 L2 packages
   - `packages/enduser/` - CommunityClient + UserClient
   - `packages/operator/` - PaymasterOperatorClient + DAOClient

2. 定义基础类型和接口
   - `ClientConfig`
   - `TransactionOptions`
   - `BusinessResult<T>`

3. 实现基类 `BaseClient`
   - 统一的 client 管理
   - 通用的错误处理
   - 日志和监控

### Phase 2: CommunityClient (2-3天)

1. 社区创建与配置
2. 成员管理
3. 角色管理
4. 信誉系统

### Phase 3: PaymasterOperatorClient (2-3天)

1. 运营商注册
2. 资金管理
3. 赞助策略
4. 监控审计

### Phase 4: UserClient (1-2天)

1. 账户管理
2. SBT 管理
3. 积分操作
4. 赞助操作

### Phase 5: DAOClient (1-2天)

1. 提案管理
2. 投票管理
3. 执行操作
4. 验证器管理

### Phase 6: 测试与文档 (2-3天)

1. 单元测试
2. 集成测试
3. E2E 示例
4. API 文档

---

## 🎯 预期成果

### 代码交付

```
packages/
├── enduser/
│   ├── src/
│   │   ├── CommunityClient.ts
│   │   ├── UserClient.ts
│   │   └── types.ts
│   └── tests/
└── operator/
    ├── src/
    │   ├── PaymasterOperatorClient.ts
    │   ├── DAOClient.ts
    │   └── types.ts
    └── tests/
```

### 使用体验

**L1 - 底层调用** (现在):
```typescript
// 需要多步操作
const registry = registryActions(REGISTRY);
const factory = xPNTsFactoryActions(FACTORY);

await registry(client).registerRole(...);
await factory(client).createToken(...);
await registry(client).setCommunityToken(...);
```

**L2 - 业务封装** (目标):
```typescript
// 一步完成
const community = new CommunityClient({ ... });
await community.createCommunity({
  name: 'My Community',
  tokenSymbol: 'MYC',
});
```

---

## 📝 下一步

1. ✅ 完成 L1 API Demo
2. 🔄 审核 L2 设计
3. ⏭️ 开始 Phase 1: 基础架构
4. ⏭️ 实现 CommunityClient
5. ⏭️ 完整 L2 测试

**准备开始 L2 开发！** 🚀
