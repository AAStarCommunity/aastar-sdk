# SDK Stage 3: 全面回归测试与场景验证计划

## 当前状态总结 (Current Status)

### ✅ 已完成的工作
1. **工作区清理与配置修复**：
   - 清理了所有外部参考仓库的编译产物
   - 恢复了 `.eslintrc.js`，加固了 `tsconfig.json` 和 `.gitignore`
   - 配置了 `paths` 支持 IDE 代码跳转

2. **Anvil 环境回归测试**：
   - ✅ Scenario 1: 社区注册（Onboard Community）
   - ✅ Scenario 2: 运营商入驻（Onboard Operator）
   - ✅ Scenario 3: 用户注册（Onboard User）
   - ⚠️ Scenario 4: Gasless 交易流（getNonce 已修复，但 handleOps 仍失败）

3. **SDK 基础层优化**：
   - 修复了 `EndUserClient.executeGasless` 的 nonce 获取逻辑
   - 实现了 `ExperimentClient` 用于性能数据采集
   - 同步了最新的 SuperPaymasterV3 ABIs

### ⚠️ 待解决的问题
1. **Scenario 4 handleOps 回滚**：
   - 问题：EntryPoint.handleOps 执行失败
   - 可能原因：Paymaster 验证失败、签名不正确或 Gas 参数问题
   - 影响：无法完成 Anvil 环境的完整 Gasless 流程验证

2. **Sepolia 环境测试**：
   - 需要验证 Sepolia 环境的完整流程
   - 需要确认所有合约地址已正确同步到SDK

---

## Stage 3 执行计划 (Implementation Roadmap)

基于 `STAGE3.md` 文档，我们将分三个阶段完成SDK的全面验证：

### 阶段 1: 基础层回归测试 (Base Layer Regression)

#### 1.1 SDK 构建验证
- [ ] 验证 `pnpm build` 正常完成
- [ ] 检查所有 packages 的依赖关系
- [ ] 确认类型声明文件正确生成

#### 1.2 核心 API 验证
- [ ] **RegistryActions**: 
  - `registerCommunity`, `joinCommunity`, `getCommunityInfo`
- [ ] **SuperPaymasterActions**: 
  - `validatePaymasterUserOp`, `postOp` payment logic
- [ ] **GTokenStakingActions**: 
  - `stake`, `unstake`, `getStakedAmount`
- [ ] **PaymasterFactoryActions**: 
  - `deployPaymaster`, `calculateAddress`

#### 1.3 ABI 同步验证
- [ ] 确认所有 V3.1.1 合约的 ABI 已同步
- [ ] 验证自定义错误解码器正常工作
- [ ] 测试事件监听和解析

---

### 阶段 2: 业务层回归测试 (Business Layer Regression)

#### 2.1 CommunityClient 验证
- [ ] `onboardCommunity()` 组合操作
- [ ] `getCommunityInfo()` 状态查询
- [ ] `deployXPNTs()` 代币发行

#### 2.2 OperatorClient 验证
- [ ] `setupNode()` 节点配置
- [ ] `depositCollateral()` 质押充值
- [ ] `getOperatorStatus()` 状态查询

#### 2.3 EndUserClient 验证
- [ ] `joinAndActivate()` 用户注册
- [ ] `deploySmartAccount()` AA 账户部署
- [ ] `executeGasless()` 无 Gas 交易（**需修复**）

---

### 阶段 3: 场景化测试 (Scenario Verification)

#### 3.1 Anvil 环境场景测试
- [x] Scenario 1: DAO Launchpad Pattern
- [x] Scenario 2: Operator Lifecycle
- [x] Scenario 3: User Onboarding & Credit
- [/] Scenario 4: High-Frequency Gasless UX (**handleOps 待修复**)

#### 3.2 Sepolia 环境场景测试
- [ ] 部署完整的 V3.1.1 合约栈
- [ ] 验证 4 个核心场景在 Sepolia 上的执行
- [ ] 采集性能数据（Gas 消耗、延迟等）

#### 3.3 对比实验数据采集
- [ ] Group A: EOA Baseline
- [ ] Group B: Pimlico/Alchemy Paymaster
- [ ] Group C1: Paymaster V4
- [ ] Group C2: SuperPaymaster V3

---

## 优先级排序 (Priority Queue)

### P0 - 紧急修复
1. **修复 Scenario 4 的 handleOps 问题**
   - 调试 EntryPoint 验证逻辑
   - 检查 paymasterAndData 格式
   - 验证 UserOp 签名

### P1 - 核心功能验证
2. **完成 Anvil 环境的 4 个场景测试**
3. **验证 SDK 构建流程**
4. **确认所有核心 API 正常工作**

### P2 - Sepolia 环境部署
5. **部署 V3.1.1 合约至 Sepolia**
6. **运行 Sepolia 场景测试**

### P3 - 数据采集与文档
7. **采集对比实验数据**
8. **编写开发者指南**
9. **完成 Stage 3 报告**

---

## 立即行动项 (Immediate Actions)

1. ✅ 创建本计划文档
2. ⏭️ 修复 Scenario 4 的 handleOps 问题
3. ⏭️ 验证 SDK 构建流程
4. ⏭️ 运行基础层 API 回归测试

---

## 预期交付物 (Deliverables)

1. **测试报告**: 
   - `docs/STAGE_3_REGRESSION_REPORT.md`
   - 包含所有测试用例的执行结果

2. **性能数据**: 
   - `docs/STAGE_3_BENCHMARK_DATA.json`
   - 包含 4 组对比实验的详细数据

3. **开发者指南**: 
   - `docs/guide/patterns.md`
   - 沉淀的 SDK Orchestration Patterns

4. **修复记录**: 
   - `walkthrough.md`
   - 记录所有发现和修复的问题
