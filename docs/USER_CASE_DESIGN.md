# SDK 场景化案例设计 (User Case Design)

本文档借鉴 `registry` 前端项目的用户交互逻辑，提取核心业务链路，设计了 SDK 在 Phase 3 (Sepolia) 阶段的场景化测试用例。我们的目标是**参考前端体验、沉淀 SDK 模式 (Orchestration Patterns)**，而非简单的接口复用。

## 场景角色定义

1.  **Protocol Admin (协议管理员)**: 部署时期是一个EOA，完成部署后交接给多签Safe账户，进行后续的全局配置、DVT 验证器管理、治理代币发行等。
2.  **Community Admin (社区管理员)**: 部署时期是一个EOA，完成部署后交接给多签Safe账户，负责社区注册、xPNTs 发行、SBT 会员规则设定。
3.  **PM Operator (Paymaster 操作员)**: 部署时期是一个EOA，完成部署后，**可选**交接给多签Safe账户，负责 Paymaster 节点运维、质押充值、费用管理等。多数时候，早期社区管理员和Operator是一个EOA。
4.  **SuperPaymaster Operator**: 注册时期是一个EOA，完成部署后，**可选**交接给多签Safe账户，负责 SuperPaymaster参数配置和国库管理。多数时候，早期社区管理员和Operator是一个EOA。
5.  **DVT(Node) Operator**: 部署时期是一个EOA，完成部署后，**可选**交接给其他EOA或者自动Rotate 账户，负责 DVT 参数配置和治理代币管理。
6.  **EndUser (终端用户)**: 参与社区、获取 SBT 身份、使用社区信用进行 Gasless 交易。

---

## 核心测试用例 (Business Scenarios)
背景信息：
- GToken在测试阶段，来自于协议Admin直接铸造空投。
- 未来GToken来自于独立的阶梯价格销售（Mint）合约/应用。
- xPNTs在测试阶段，来自于社区Admin铸造空投。
- 未来xPNTs来自于社区发行+Reputation机制+任务广场。
- SBT在测试阶段，来自于社区Admin铸造空投或者自行Mint。
- 未来SBT来自于社区Shops+Reputation机制+任务广场。
- NFT在测试阶段，来自于社区Admin铸造空投或者自行Mint。
- 未来NFT来自于社区Shops+Reputation机制+任务广场。  

### 用例 1：社区“全流程”自动化 (DAO Launchpad Pattern)
**参考自**: `RegisterCommunity.tsx`
- **设计思路**: 前端是分步引导，SDK 应提供“原子组合”能力。模拟社区从 0 到 1 的全过程：授权 -> 质押 -> 基准配置 -> 关联 SBT。
- **SDK 验证重点**:
    - 组合调用：`GTokenClient` 与 `RegistryClient` 的无缝状态桥接。
    - `RegistryClient.registerCommunityWithAutoStake`
    - 验证 `ContractConfigManager` 是否正确识别新注册的社区配置。
    - 社区发行自己的xPNTs，NFT。

### 用例 2：Paymaster 节点部署向导 (Operator Wizard)
**原型参考**: `DeployWizard.tsx` (3-Step Flow)
- **业务流程**: 操作员选择模式（AOA/AOA+）-> 资源自检（GToken 余额、质押状态）-> 部署合约并充值。
- **SDK 验证重点**:
    - `OperatorClient.checkResources` (模拟前端资源自检逻辑)
    - `PaymasterFactory.deployPaymaster`
    - `OperatorClient.depositCollateral`
- **预期结果**: 完成后，Operator拥有独立的`Paymaster`节点和 Gas Token（xPNTs），或者在 `SuperPaymaster` 的 aPNTs 余额可见且可用于支持自己社区成员使用xPNTs代付。

### 用例 3：用户身份获取与信誉激活 (SBT & Reputation)
**原型参考**: `GetSBT.tsx`, `MySBT.tsx`
- **业务流程**: 用户选择社区 -> 自动质押 0.4 GT -> 铸造 MySBT -> 查看全局信誉分。
- **SDK 验证重点**:
    - `EndUserClient.mintSBT` (包含 auto-stake 逻辑)
    - `ReputationClient.getGlobalReputation`
    - `RegistryClient.getCreditLimit` (验证信誉分是否正确转化为信用额度)

### 用例 4：纯净 Gasless 交易体验 (Ultimate Gasless UX)
这也是我们PhD paper获取实验数据的阶段，包括baseline（EOA和Pimlico Paymaster，以及业界平均统计成本）和两个对比实验（Paymaster V4和SuperPaymaster）。
**原型参考**: `DeveloperPortal.tsx` (集成示例)
- **业务流程**: 一个没有任何 ETH 的新账户，使用社区发放的 SBT 凭证，通过 SDK 发送一笔交易。
- **SDK 验证重点**:
    - `createEndUserClient` 初始化（无私钥签名模式或智能账户模式）
    - `getSuperPaymasterMiddleware` 后台自动构建 `userOp.paymasterAndData`
    - 验证 `SuperPaymaster` 的 `postOp` 阶段是否正确扣除用户信用或 xPNTs 代币。


### 基础用例整合（后续TODO）
我们期望能够整合基础用例，给用户（社区）提供自主自助的launchpad以及管理平台。
🎫
Get GToken
Get protocol access permission GToken, become protocol member, join permissionless, quit anytime freely

Get →
🏛️
Register Community
Create and register your community on the AAstar Network

Register →
💎
Deploy xPNTs
Create your community gas token for payment abstraction

Deploy →
🚀
Launch Paymaster
Deploy your Paymaster contract and start serving gasless transactions to your community

Launch Paymaster → →

### 用例 X：更多用例，持续加入（后续TODO，不加入开发）
    用例 5：危机管理与 DVT 治理 (Governance & Slashing)
**原型参考**: `AdminBatchMint.tsx` (管理入口)
- **业务流程**: 管理员发现恶意行为 -> DVT 节点投票 -> 执行对社区质押额的 Slash。
- **SDK 验证重点**:
    - `DVTClient.proposeSlash`
    - `DVTClient.signSlash` (模拟多节点聚合签名)
    - `AdminClient.executeSlash`
---

## 开发计划 (Implementation Plan - 阶段 3)

### 第一步：Sepolia 环境就绪
- 部署全套合约 (V3.3.0+) 至 Sepolia。
- 使用 `forge verify-contract` 完成 Etherscan 验证。
- 更新 SDK `constants.ts` 中的 Sepolia 合约地址。

### 第二步：场景化示例开发
- 在 `examples/` 目录下按上述 4 个用例创建独立的 目录和TS 脚本。
- 编写配套的中文文档注释，确保其作为“开发者指南”的使用价值。
- 结合SuperPaymaster Readme中的数据收集计划，完成PhD paper的数据收集。这部分可以独立目录。

### 第三步：全流程冒烟测试
- 运行 `pnpm run test:sepolia` (新增脚本)。
- 输出场景执行记录，作为 Phase 3 的交付证明。
