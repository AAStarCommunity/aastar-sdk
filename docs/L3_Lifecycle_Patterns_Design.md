L3 Complete Lifecycle Patterns Design (完整版)
Overview
基于 
USER_CASE_DESIGN.md
 和用户补充需求，实现所有角色完整生命周期 + 管理功能的 L3 Patterns。

🎯 核心原则
完整生命周期: 注册 → 配置 → 运营 → 退出
管理能力: 每个角色都有增删改查 (CRUD) 能力
业务聚类: 按职责分组（治理、运营、用户）
Gasless原生: 所有Pattern支持Gasless配置
角色完整映射
📱 1. 终端用户 (End User) - UserLifecycle
职责: 参与社区、交易、积累信誉

完整生命周期:

未注册 → 加入社区(质押+SBT) → Gasless交易 → 更新信誉 → 绑定NFT → 退出社区
L3 Methods:

```typescript
class UserLifecycle {
  // 注册阶段
  checkEligibility(community): Promise<boolean>
  onboard(community, stakeAmount): Promise<OnboardResult>
  enableGasless(config: GaslessConfig): Promise<void>
  
  // 运营阶段
  executeGaslessTx(tx): Promise<Hash>
  claimSBT(roleId): Promise<Hash>
  bindNFT(nftAddress, tokenId): Promise<Hash>
  updateReputation(): Promise<ReputationScore>
  
  // 查询能力
  getMyReputation(): Promise<ReputationData>
  getMySBTs(): Promise<SBT[]>
  getMyNFTs(): Promise<NFT[]>
  getCreditLimit(): Promise<bigint>
  
  // 退出阶段
  leaveCommunity(community): Promise<Hash>
  exitRole(roleId): Promise<Hash>
  unstakeAll(): Promise<Hash>
}
```
🏛️ 2. 社区管理员 (Community Admin) - CommunityManager
职责: 启动社区、治理规则、成员管理

完整生命周期:

EOA → 注册社区 → 发行Token → 设置治理 → 管理成员 → 移交多签
L3 Methods:

```typescript
class CommunityManager {
  // 启动阶段 (已有 CommunityLaunchpad)
  launch(params): Promise<LaunchResult>
  
  // 成员管理
  airdropSBT(users: Address[], roleId: Hex): Promise<Hash>
  revokeSBT(tokenId: bigint): Promise<Hash>
  batchMintNFT(users: Address[]): Promise<Hash>
  
  // Reputation规则管理 ⭐ (新增)
  addReputationRule(rule: ReputationRule): Promise<Hash>
  updateReputationRule(ruleId: Hex, rule): Promise<Hash>
  removeReputationRule(ruleId: Hex): Promise<Hash>
  getActiveRules(): Promise<ReputationRule[]>
  
  // 治理配置
  setVotingPeriod(period: bigint): Promise<Hash>
  setQuorum(quorum: number): Promise<Hash>
  updateTreasury(newTreasury: Address): Promise<Hash>
  
  // 移交阶段 ⭐ (新增)
  transferToMultisig(multisig: Address): Promise<Hash>
  
  // 查询能力
  getCommunityStats(): Promise<CommunityStats>
  getMembers(): Promise<Member[]>
  getTreasuryBalance(): Promise<bigint>
}
```
🚀 3. Paymaster 运营商 (PM Operator) - 
PaymasterOperator
职责: 部署节点、配置Gas、管理流动性

完整生命周期: ⭐ (需补充退出)

EOA → 资源检查 → 质押注册 → 部署节点 → 配置Token → 运营管理 → 退出/撤资
L3 Methods:

```typescript
class PaymasterOperator {
  // 启动阶段 (已有 OperatorLifecycle)
  checkReadiness(): Promise<OperatorStatus>
  setupNode(params): Promise<Hash[]>
  
  // 配置管理
  addGasToken(token, priceFeed): Promise<Hash>
  removeGasToken(token): Promise<Hash>
  updateFeeStrategy(strategy): Promise<Hash>
  setExchangeRate(rate: bigint): Promise<Hash>
  
  // 流动性管理
  depositCollateral(amount: bigint): Promise<Hash>
  withdrawCollateral(amount: bigint): Promise<Hash>
  
  // 运营监控
  getOperatorStats(): Promise<OperatorStats>
  getSponsoredTxCount(): Promise<bigint>
  getRevenue(): Promise<bigint>
  
  // 退出阶段 ⭐ (新增)
  initiateExit(): Promise<Hash>
  completeExit(): Promise<Hash>
  withdrawAllFunds(): Promise<Hash>
}
```
⚡ 4. SuperPaymaster 运营商 - SuperPaymasterOperator ⭐ (新增)
职责: 管理全局Gas池、设置协议参数

完整生命周期:

协议批准 → 质押注册 → 配置国库 → 设置费率 → 管理流动性 → 退出
L3 Methods:

```typescript
class SuperPaymasterOperator {
  // 注册阶段 ⭐ (新增)
  registerAsOperator(collateral: bigint): Promise<Hash>
  stakeForRole(amount: bigint): Promise<Hash>
  
  // 配置阶段 ⭐ (新增)
  configureTreasury(treasury: Address): Promise<Hash>
  setProtocolFee(feeBps: bigint): Promise<Hash>
  setExchangeRate(token: Address, rate: bigint): Promise<Hash>
  
  // 流动性管理
  addLiquidity(amount: bigint): Promise<Hash>
  removeLiquidity(amount: bigint): Promise<Hash>
  
  // 运营监控
  getPoolStats(): Promise<PoolStats>
  getTotalSponsored(): Promise<bigint>
  getOperatorRevenue(): Promise<bigint>
  
  // 退出阶段 ⭐ (新增)
  initiateOperatorExit(): Promise<Hash>
  unstakeOperator(): Promise<Hash>
  withdrawAllRewards(): Promise<Hash>
}
```
🏛️ 5. 协议管理员 (Protocol Admin) - ProtocolGovernance ⭐ (增强)
职责: 全局参数治理、合约升级

完整生命周期:

部署EOA → 初始配置 → 日常治理 → 移交DAO多签
L3 Methods:

```typescript
class ProtocolGovernance {
  // 全局参数管理 ⭐ (增强)
  setGlobalMinStake(amount: bigint): Promise<Hash>
  setProtocolFee(recipient: Address, bps: bigint): Promise<Hash>
  setTreasury(treasury: Address): Promise<Hash>
  updateEntryPoint(entryPoint: Address): Promise<Hash>
  
  // SuperPaymaster管理 ⭐ (新增)
  approveSuperPaymasterOperator(operator: Address): Promise<Hash>
  revokeSuperPaymasterOperator(operator: Address): Promise<Hash>
  updateSPTreasury(treasury: Address): Promise<Hash>
  setSPFeeRate(feeBps: bigint): Promise<Hash>
  
  // 提案治理
  createProposal(proposal: Proposal): Promise<Hash>
  voteOnProposal(proposalId: Hex, support: boolean): Promise<Hash>
  executeProposal(proposalId: Hex): Promise<Hash>
  
  // 紧急控制
  pauseProtocol(): Promise<Hash>
  unpauseProtocol(): Promise<Hash>
  
  // 移交阶段
  transferToDAO(daoMultisig: Address): Promise<Hash>
  
  // 查询能力
  getProtocolParams(): Promise<ProtocolParams>
  getAllOperators(): Promise<Operator[]>
  getProposals(): Promise<Proposal[]>
}
```
🔐 6. DVT 验证器 (DVT Operator) - DVTNodeManager ⭐ (新增)
职责: 分布式验证、BLS签名、治理投票

完整生命周期:

生成BLS密钥 → 注册验证器 → 加入验证集 → 签名验证 → 退出验证集
L3 Methods:

```typescript
class DVTNodeManager {
  // 注册阶段
  generateBLSKeyPair(): Promise<BLSKeyPair>
  registerBLSKey(pubkey: Hex): Promise<Hash>
  joinValidatorSet(stake: bigint): Promise<Hash>
  
  // 验证运营
  signMessage(message: Hex): Promise<Signature>
  aggregateSignatures(sigs: Signature[]): Promise<AggregatedSig>
  submitValidation(data: ValidationData): Promise<Hash>
  
  // 治理参与
  proposeSlash(target: Address, reason: string): Promise<Hash>
  voteOnSlash(proposalId: Hex, support: boolean): Promise<Hash>
  
  // 查询能力
  getValidatorStatus(): Promise<ValidatorStatus>
  getSigningHistory(): Promise<SigningRecord[]>
  getRewards(): Promise<bigint>
  
  // 退出阶段
  leaveValidatorSet(): Promise<Hash>
  withdrawStake(): Promise<Hash>
}
```
🔑 7. KMS 节点 (KMS Node) - KMSNodeManager ⭐ (新增)
职责: 密钥管理、签名服务

完整生命周期:

初始化节点 → 注册到Registry → 提供签名服务 → 密钥轮换 → 退出
L3 Methods:

```typescript
class KMSNodeManager {
  // 初始化
  initializeNode(config: KMSConfig): Promise<Hash>
  registerNode(nodeId: Hex): Promise<Hash>
  
  // 密钥管理
  generateKey(keyType: string): Promise<KeyInfo>
  rotateKey(oldKeyId: Hex): Promise<KeyInfo>
  revokeKey(keyId: Hex): Promise<Hash>
  
  // 签名服务
  signRequest(request: SignRequest): Promise<Signature>
  batchSign(requests: SignRequest[]): Promise<Signature[]>
  
  // 监控
  getNodeHealth(): Promise<HealthStatus>
  getSigningStats(): Promise<Stats>
  
  // 退出
  deactivateNode(): Promise<Hash>
  exportKeys(backup: boolean): Promise<KeyBackup>
}
```
🎨 Reputation 管理增强 ⭐
ReputationManager (新增)
```typescript
class ReputationManager {
  // 规则管理
  addRule(community: Address, rule: ReputationRule): Promise<Hash>
  updateRule(ruleId: Hex, newParams): Promise<Hash>
  removeRule(ruleId: Hex): Promise<Hash>
  activateRule(ruleId: Hex): Promise<Hash>
  deactivateRule(ruleId: Hex): Promise<Hash>
  
  // 积分更新
  recordActivity(user: Address, activityType: string): Promise<Hash>
  batchUpdateScores(users: Address[]): Promise<Hash>
  
  // 查询
  getUserReputation(user: Address): Promise<ReputationData>
  getCommunityRules(community: Address): Promise<ReputationRule[]>
  getTopUsers(limit: number): Promise<User[]>
}
```
🎯 NFT 绑定增强 ⭐
NFTManager (新增)
```typescript
class NFTManager {
  // NFT绑定
  bindNFTToSBT(sbtId: bigint, nftAddr: Address, nftId: bigint): Promise<Hash>
  unbindNFT(sbtId: bigint, nftAddr: Address): Promise<Hash>
  
  // 查询
  getBoundNFTs(sbtId: bigint): Promise<NFTBinding[]>
  verifiyNFTOwnership(user: Address, nftAddr: Address): Promise<boolean>
  
  // 批量操作
  batchBindNFTs(bindings: NFTBinding[]): Promise<Hash>
}
```
📋 实现优先级 (修订)
P0 - 核心生命周期 (立即实现)
✅ 
CommunityLaunchpad
 (已完成)
✅ 
StakingManager
 (已完成)
✅ 
OperatorLifecycle
 (已完成，需补充退出)
🔄 UserLifecycle (完整版，含Gasless)
🔄 SuperPaymasterOperator (新增)
🔄 ProtocolGovernance (增强版)
P1 - 管理增强 (下一阶段)
ReputationManager
NFTManager
DVTNodeManager
KMSNodeManager
P2 - 工具函数
GaslessHelper - Paymaster配置工具
RoleHelper - 角色权限检查工具
🧪 验证计划
Scenario完整测试
// examples/l3-complete-lifecycle-demo.ts
async function fullEcosystemDemo() {
  // 1. 协议启动
  const protocol = new ProtocolGovernance(config);
  await protocol.setGlobalMinStake(...);
  
  // 2. 社区启动
  const community = new CommunityManager(config);
  await community.launch({ name: "TestDAO", ... });
  await community.addReputationRule(...);
  
  // 3. 运营商部署
  const spOperator = new SuperPaymasterOperator(config);
  await spOperator.registerAsOperator(1000n);
  await spOperator.configureTreasury(...);
  
  const pmOperator = new PaymasterOperator(config);
  await pmOperator.setupNode({ collateral: 500n, ... });
  
  // 4. 用户Gasless入驻
  const user = new UserLifecycle({ 
    ...config, 
    gasless: { paymasterUrl: "..." }
  });
  await user.onboard("TestDAO", 100n);
  await user.executeGaslessTx(...);
  await user.updateReputation();
  
  // 5. DVT验证器
  const dvt = new DVTNodeManager(config);
  await dvt.registerBLSKey(...);
  await dvt.joinValidatorSet(200n);
  
  // 6. 生命周期退出
  await user.leaveCommunity("TestDAO");
  await pmOperator.initiateExit();
  await spOperator.unstakeOperator();
}
Next Steps (执行计划)
Phase 1: 核心Pattern实现 (本次)
补充 
OperatorLifecycle
 的退出机制
实现 UserLifecycle (完整版 + Gasless)
实现 SuperPaymasterOperator
增强 ProtocolGovernance
Phase 2: 管理Pattern (后续)
实现 ReputationManager
实现 NFTManager
实现 DVTNodeManager
实现 KMSNodeManager
Phase 3: 集成测试
创建 l3-complete-lifecycle-demo.ts
回归测试所有Use Cases
更新文档和使用指南
角色与生命周期映射
1. 终端用户 (End User) - 🎫 UserOnboarding
Use Cases: 3 (SBT & Reputation) + 4 (Gasless UX)

Lifecycle:

未注册 → 选择社区 → 质押GToken → 铸造SBT → 激活Gasless → 开始交易
L3 Methods:

checkEligibility(community): 检查是否可以加入社区
onboard(community, params)
: 一键入驻
自动质押 0.4 GT (if required)
铸造 MySBT
配置 Gasless (if paymasterUrl provided)
getReputation(): 查询信誉分
enableGasless(paymasterConfig): 启用Gasless交易
Value:

消除"Approve → Stake → Mint"的多步骤摩擦
Gasless配置透明化
2. 社区管理员 (Community Admin) - 🏛️ 
CommunityLaunchpad
 (已实现)
Use Case: 1 (DAO Launchpad)

Lifecycle:

EOA → 质押注册 → 部署Token → 设置治理 → 移交多签
L3 Methods (已实现):

launch(params)
: 一键启动社区
Register Community Role
Deploy xPNTs Token
Setup Reputation Rules
Enhancement (待补充):

transferToMultisig(multisig): 移交控制权给Safe多签
3. Paymaster 运营商 (PM Operator) - 🚀 
OperatorLifecycle
 (已实现)
Use Case: 2 (Operator Wizard)

Lifecycle:

EOA → 资源检查 → 质押充值 → 配置节点 → 启动服务
L3 Methods (已实现):

checkReadiness()
: 资源自检
setupNode(params)
: 一键部署
Deposit Collateral
Add Gas Tokens
Configure Operator
Enhancement (待补充):

updateFeeStrategy(strategy): 动态费率调整
withdrawRewards(): 提取收益
4. SuperPaymaster 运营商 - ⚡ SuperPaymasterManager (新增)
Scope: 全局Gas代付池管理

Lifecycle:

协议批准 → 质押注册 → 配置国库 → 管理流动性
L3 Methods:

registerAsOperator(collateral): 注册为SP运营商
configureTreasury(treasury, exchangeRate): 配置国库
managePoolLiquidity(): 管理流动性池
5. 协议管理员 (Protocol Admin) - 🏛️ ProtocolGovernance (新增)
Scope: 全局参数治理

Lifecycle:

部署期EOA → 配置参数 → 移交多签 → 提案投票治理
L3 Methods:

setGlobalParameters(params): 设置全局参数
Protocol Fee
Treasury Address
Min Stake Amount
createProposal(proposal)
: 创建治理提案
transferToDAO(multisig): 移交给DAO
6. DVT 验证器 (DVT Operator) - 🔐 DVTNodeManager (新增)
Scope: 分布式验证节点管理

Lifecycle:

注册BLS密钥 → 加入验证集 → 签名验证 → 治理投票
L3 Methods:

registerBLSKey(pubkey)
: 注册BLS公钥
joinValidatorSet(): 加入验证集
proposeSlash(target): 提出惩罚提案
🎯 Gasless 集成策略
方案: Gasless作为L3的"配置选项"
所有需要Gasless的Pattern都接受 GaslessConfig:

interface GaslessConfig {
  paymasterUrl: string;  // e.g. Pimlico/Alchemy URL
  policy?: 'CREDIT' | 'TOKEN' | 'SPONSORED';
}
实现方式:

L3 Pattern 接受 gaslessConfig?: GaslessConfig
内部逻辑: 如果提供，则使用 createSmartAccountClient with Paymaster middleware
透明化: 用户无需手动构建 paymasterAndData
📋 实现优先级
P0 - 核心生命周期 (本次实现)
✅ CommunityLaunchpad
✅ StakingManager
✅ OperatorLifecycle
🔄 UserOnboarding (含Gasless)
🔄 ProtocolGovernance
P1 - 运营增强 (后续迭代)
SuperPaymasterManager
DVTNodeManager
ReputationManager
🧪 验证计划
Scenario Tests (对应 USER_CASE_DESIGN.md)
✅ Scenario 1: Community Launch → CommunityLaunchpad.launch()
✅ Scenario 2: Operator Setup → OperatorLifecycle.setupNode()
🔄 Scenario 3: User SBT Mint → UserOnboarding.onboard()
🔄 Scenario 4: Gasless TX → UserOnboarding.enableGasless() + any tx
Integration Demo
创建 examples/l3-complete-demo.ts:

启动社区
部署运营商
用户Gasless入驻
发送Gasless交易
Next Steps
实现 UserOnboarding.ts (含Gasless配置)
实现 ProtocolGovernance.ts
创建 GaslessHelper.ts (工具函数)
编写集成测试 examples/l3-complete-demo.ts
更新 
task.md
 和用户文档
