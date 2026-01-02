# Stage 3 Sepolia Experiment & Orchestration Pattern Design

## 1. 背景与目标 (Context & Objectives)

在 Phase 2 (Local Anvil) 阶段，我们验证了所有 17 个基础回归用例。进入 Phase 3 (Sepolia)，我们的重点将从“功能验证”转向“**场景化业务流验证**”和“**基准性能评估**”。

本计划旨在通过四个核心业务场景，沉淀出 SDK 的**高阶抽象模式 (Orchestration Patterns)**，并为 SuperPaymaster 论文提供可信的实验数据。

---

## 2. 实验分组与基准 (Experiment 呃，那个spoliia的回归已经完成了。那我们现在转入另外一个话题，就是SDK。首先呢我们要check一下SDK当前是不是能够正常的build。呃，然后呢包括我们规划的这个API是不是都正常实现了，进行一次全回归的测试和检查，包括它的设计目标是不是都实现了。嗯，这个需要啊两个维度，一个是基础的这种AABI的或者是reite contract的封装。呃，另外一个就是业务层面。业务层面的高维度，业务原语的封装。这个角度呢就是我们已经在进行带测试和这个整体的设计可能需要不断的迭代。嗯它的带。底层可能是SDK呃本身的一些API或者我们调用其他合约的ABI对，那这是我的一个背景信息。我希望你去查看我们这三个相关的文档。然后呢梳理一下之后给出一个完整的规划来，然后从基础的AAPI的回归到业务原API的完善和回归测试啊，包括啊这几个文档的整体规划的目标的实现。Groups & Baselines)

为了评估 SuperPaymaster 的竞争力，我们将对比三组账户：

| 分组 | 身份标识 | 支付机制 | 核心组件 | 预期优势 |
| :--- | :--- | :--- | :--- | :--- |
| Group A: EOA | Standard EOA | Self-pay (ETH) | WalletClient | Baseline (Min Overhead) |
| **Group B: Standard AA** | SimpleAccount v0.7 | 3rd Party Sponsor | Alchemy/Pimlico | Industry Standard |
| **Group C1: Paymaster V4** | SimpleAccount v0.7 | Token-based (v4) | PaymasterV4 Contract | Basic Token Sponsorship |
| **Group C2: SuperPaymaster** | SimpleAccount v0.7 | Asset-based Gasless | SuperPaymaster V3 | Fully Decoupled & Credit Flow |

---

## 3. 场景化测试用例 (Scenario-driven Test Cases)

我们不仅测试单个 API，而是测试完整的“业务链路”。

### 3.1 场景一：社区启动 (DAO Launchpad Pattern)
- **业务逻辑**: 协议管理员批准 -> 社区管理员注册项目 -> 初始质押 GToken -> 部署专属 xPNTs 代币。
- **SDK 沉淀**: `CommunityClient.onboardCommunity()` 组合操作。
- **验证点**: 注册事件监听、xPNTs 部署地址验证、质押状态同步。

### 3.2 场景二：运营商运维 (Operator Lifecycle)
- **业务逻辑**: 运营商质押 -> 获取节点经营权 -> 通过 Factory 部署私有 Paymaster -> 激活 SuperPaymaster 路由。
- **SDK 沉淀**: `OperatorClient.setupNode()` 模式。
- **验证点**: 合约确定性部署 (CREATE2)、SuperPaymaster 权限映射、国库充值流转。

### 3.3 场景三：终端用户旅程 (User Onboarding & Credit)
- **业务逻辑**: 用户加入社区 -> 铸造 SBT (Auto-stake) -> 信用额度激活 -> 查看实时 Reputation。
- **SDK 沉淀**: `EndUserClient.joinAndActivate()`。
- **验证点**: SBT 余额、信用上限计算逻辑、信用恢复速度。

### 3.4 场景四：极致 Gasless 体验 (High-Frequency UX)
- **业务逻辑**: 用户在无 ETH 状态下，连续发送 10 笔跨协议交互。
- **SDK 沉淀**: `EndUserClient.sendGaslessTransaction()`。
- **数据采集**: Gas消耗明细、UserOp 处理耗时、Paymaster 扣费准确性。

---

## 4. 实施规划 (Implementation Roadmap)

### 4.1 目录结构
在 `aastar-sdk` 下建立独立目录：
```text
scripts/experiment/stage3/
├── .env.sepolia          # Sepolia 环境专用私钥与地址
├── 01_dao_launch.ts      # 场景一脚本
├── 02_operator_setup.ts  # 场景二脚本
├── 03_user_onboarding.ts # 场景三脚本
├── 04_benchmarking.ts    # 场景四 (数据采集)
└── setup.ts              # 分组账号初始化与资金分发
```

### 4.2 开发与执行顺序
1. **环境初始化**: 部署 V3.3.0 核心合约至 Sepolia -> 填充 `.env.sepolia`。
2. **场景脚本编写**: 按照 3.1-3.4 逐步实现，优先关注“组合 API”的开发。
3. **数据采集**: 运行 `04_benchmarking.ts` 至少 30 组数据，生成 JSON 报告。
4. **模式沉淀**: 将脚本中重复的 Orchestration 逻辑提取到 `packages/sdk` 的高阶函数中。

---

## 5. 预期交付物

1. **`docs/STAGE_3_SCENARIO_EXP_PLAN.md`**: 详细的业务用例设计方案（即本文件）。
2. **`scripts/experiment/stage3/`**: 完整的可运行测试代码库。
3. **`docs/STAGE_3_REPORT.json`**: 包含三组对比数据的实验报告。
4. **SDK Patterns**: 在 `docs/guide/patterns.md` 中更新高阶业务开发模式。
