# SuperPaymaster 实验任务分解 (Task Breakdown)

基于博士研究需求和“三步走”（准备、测试、分析）策略。

## 阶段 0: 基础与配置

- [x] **0.1. 环境设置 (`.env.v3`)**
    - [x] 创建 `projects/env/.env.v3`。
    - [x] 填充 RPC 变量 (`SEPOLIA_RPC_URL` 等)。
    - [x] 填充账户私钥。
    - [x] 配置合约地址（优先使用 `@aastar/shared-config`）。

- [x] **0.2. SDK 架构优化**
    - [x] 验证 `@aastar/shared-config` 的集成。
    - [x] 确保 `@aastar/core` 导出适配各网络的客户端。


## 阶段 1: 准备 (储备“弹药”)

- [x] **1.1. 自动化准备 (`scripts/01_prepare_all.ts`)**
    - [x] **统一脚本**: 运行以下所有检查。
    - [x] **账户检查**: 计算 A、B、C 账户地址。
    - [x] **ETH 检查**: 余额不足时从 Supplier 节点注资。
    - [x] **身份检查**: 检查 C 账户 MySBT 余额，缺失时自动铸造。
    - [x] **资产检查**: 检查 C 账户 xPNTs (GToken) 余额，不足时自动转账。

## 阶段 2: 测试 (执行阶段)

1. 在 Sepolia, OP Sepolia 和 OP Mainnet 进行 ERC20 转账测试。
2. 每小时随机进行 2 次转账，24 小时共 48 次。
3. 默认使用 Alchemy Bundler RPC。
4. 在 Pimlico Paymaster 测试中使用 PIM 作为 ERC20 Gas 代币。
5. 使用 `run_daily_experiment.ts` 编排所有脚本。

- [/] **2.1. 基准 1: EOA 转账 (`scripts/02_test_eoa.ts`)**
    - [ ] 使用 `PRIVATE_KEY_RELAYER` 作为测试 EOA。
    - [ ] 记录各项指标。

- [ ] **2.2. 基准 2: 标准 AA (`scripts/03_test_standard_aa.ts`)**
    - [ ] 使用 `TEST_SIMPLE_ACCOUNT_A` + Pimlico Paymaster。
    - [ ] 记录各项指标。

- [ ] **2.3. 实验组: SuperPaymaster (`scripts/04_test_superpaymaster.ts`)**
    *博士论文贡献的核心。*
    - [ ] 使用 `TEST_SIMPLE_ACCOUNT_C` + AAStar SuperPaymaster。
    - [ ] 构造 UserOp 并发送给 Bundler。
    - [ ] 记录指标 (Gas Used, L1 Fee, Time)。

## 阶段 3: 分析 (结果产出)

- [ ] **3.1. 数据分析 (`scripts/05_analyze_data.ts`)**
    - [ ] 读取 CSV 结果。
    - [ ] 计算均值与标准差。
    - [ ] 对比成本与耗时。
    - [ ] 生成用于论文的 Markdown 表格。

## 阶段 4: 特性验证与联动测试 [/]

### 阶段 5: Staking 退出与 Slash 测试 (12_*.ts)
- [ ] unlock → withdraw 正常流程
- [ ] Slash 参数验证（罚没、国库、退款）
- [ ] 时间锁测试（提前退出拒绝）

### 阶段 6: MySBT 销毁与联动集成
- [ ] 实现 Registry.exitRole 与 MySBT 销毁联动
- [ ] 确保角色退出后成员资格失效

## 附录: 账户角色与私钥

| 角色 | 变量名称 | 用途 |
| :--- | :--- | :--- |
| **Supplier** | `SUPPLIER_KEY` | 持有测试 ETH 和 GTokens，负责注资 |
| **Operator** | `OPERATOR_JASON_KEY` | 管理员，负责铸造 SBT |
| **Relayer** | `RELAYER_KEY` | 执行 EOA 基准测试 |
| **AA User 1** | `OWNER_JASON_KEY` | 控制 SuperPaymaster AA 账户 |
| **AA User 2** | `OWNER_ANNI_KEY` | 控制标准 Paymaster AA 账户 |
