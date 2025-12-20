# SuperPaymaster Experiment Task Breakdown

Based on the PhD research requirements and the "Three-Step" (Prepare, Test, Analyze) strategy.

## Phase 0: Foundation & Configuration

- [x] **0.1. Environment Setup (`.env.v3`)**
    - [x] Create `projects/env/.env.v3`.
    - [x] Populate RPC variables (`SEPOLIA_RPC_URL`, `ALCHEMY_BUNDLER_RPC_URL`).
    - [x] Populate Account Key in .env.v3
    - [x] Populate Contract Addresses (Superseding `.env` if needed, but prioritizing `@aastar/shared-config`).

- [x] **0.2. SDK Architecture Refinement**
    - [x] Validate `@aastar/shared-config` integration for addresses (`SuperPaymaster`, `MySBT`, `GToken`).
    - [x] Ensure `@aastar/core` exports `viem` clients configured for Sepolia and all networks.


## Phase 1: Preparation (The "Ammo")

- [x] **1.1. Automated Preparation (The "Ammo") (`scripts/01_prepare_all.ts`)**
    - [x] **Unified Script**: Runs all checks below.
    - [x] **Account Check**: Computes addresses for A, B, C.
    - [x] **ETH Check**: Funds 0.05 ETH from Supplier if low.
    - [x] **Identity Check**: Checks MySBT balance for SuperPaymaster User (C). Mints if missing.
    - [x] **Asset Check**: Checks xPNTs (GToken) balance for SuperPaymaster User (C). Transfers if low.

## Phase 2: Testing (The Execution)
1. Transfer ERC20 Test in sepolia, op sepolia and op mainnet.
2. Perform 48 times ERC20 Transfers, 2 times per hour in random time in one hour.
3. Use Alchemy bundler RPC in .env.v3 as default bundler.
4. Use PIM as erc20 gas token in pimlico paymaster test.
5. Make all scripts for every test and use run_daily_experiment.ts to orchestrate the above scripts.
6. Transfer any ERC20(use aPNTs, get it from supplier) to target receiver: TEST_RECEIVER_ADDRESS in .env.v3.

- [/] **2.1. Baseline 1: EOA Transfers (`scripts/02_test_eoa.ts`)**
    - [ ] Use `PRIVATE_KEY_RELAYER` as test EOA, address: 0xb5600060e6de5E11D3636731964218E53caadf0E.
    - [ ] Log metrics.

- [ ] **2.2. Baseline 2: Standard AA (`scripts/03_test_standard_aa.ts`)**
    - [ ] Use `TEST_SIMPLE_ACCOUNT_A` + `pimlico/permissionless` ,https://docs.pimlico.io/references/bundler/endpoints/eth_sendUserOperation, use PIM as erc20 gas token, get it from supplier, token address: 0xFC3e86566895Fb007c6A0d3809eb2827DF94F751, use Alchemy bundler RPC in .env.v3
    - [ ] Perform 48 UserOps in 24 hours.
    - [ ] Log metrics.

- [ ] **2.3. Experiment: SuperPaymaster (`scripts/04_test_superpaymaster.ts`)**
    *Core of the PhD contribution.*
    - [ ] Use `TEST_SIMPLE_ACCOUNT_B` +Alchemy bundler + Paymaster (Verifying Paymaster V4.1，来自于@aastar/shared-config).
    - [ ] Use `TEST_SIMPLE_ACCOUNT_C` + `@aastar/superpaymaster` get address from @aastar/shared-config, use Alchemy bundler.
    - [ ] Construct UserOp with `paymasterAndData` (V3 format).
    - [ ] Send to Bundler.
    - [ ] Log metrics (Gas Used, L1 Fee, Time).

- [ ] **2.4. Automation Runner (`scripts/run_daily_experiment.ts`)**
    - [ ] Orchestrate the above scripts.
    - [ ] Add random delays (simulation of real usage).
    - [ ] Output to `data/raw_experiment_data.csv`.

## Phase 3: Analysis (The Result)

- [ ] **3.1. Data Analysis (`scripts/05_analyze_data.ts`)**
    - [ ] Read CSV.
    - [ ] Compute Averages & Standard Deviation.
    - [ ] Compare Cost vs Baseline.
    - [ ] Compare Time vs Baseline.
    - [ ] Generate Markdown Table for Thesis.

## Phase 4: 特性验证与联动测试 [/]

### Phase 5: Staking 退出与 Slash 测试 (12_*.ts) [⚠️ Debugging]
- [ ] unlock → withdraw 正常流程 (Fixed: Slash deduction bug)
- [ ] Slash 参数验证（罚没、国库、退款）
- [ ] 时间锁测试（提前退出拒绝）
  - [ ] 在 Registry 中增加 roleLockDurations 映射
- [ ] Debug Registry.sol registration logic (RoleNotGranted)
- [ ] Fix syntax errors and add raw error logging in 13_test_sbt_burn_linkage.ts
- [ ] Verify active SBT burn and exit linkage

### Phase 6: MySBT Burn & Linkage Integration (Active Debugging)
- [ ] 实现 Registry.exitRole 与 MySBT 销毁/停用联动
  - [ ] 在 IMySBTV3 中添加 deactivateMembership 接口
  - [ ] 在 MySBT 中实现权限受控的 deactivateMembership
  - [ ] 在 Registry.exitRole 中增加对 ROLE_ENDUSER 的 SBT 联动调用
- [ ] 验证 `13_test_sbt_burn_linkage.ts`
  - [ ] 完整流程 (正在解决 Anvil Revert)
  - [ ] 同步最新合约 ABI 到 SDK
- [ ] 解决 registerRoleSelf 报错 (正在排查 Eve 地址与角色状态)
- [ ] 确保 getMemberships 在角色退出后返回 isActive: false

### Phase 7: 集成与覆盖率报告
- [ ] 更新 test:local 脚本包含所有新测试
- [ ] 生成覆盖率报告（目标 80%+）
- [ ] 执行完整回归并验证通过

## Phase 8: SDK 架构演进与对齐 [⚠️ 暂停]

> **WARNING**: 优先级调整：在达到 80% 测试覆盖率之前，暂停以下工作：
> - SDK 标准化封装（SuperPaymasterClient）
> - 链上数据采集与基准测试

### 阶段一：架构标准化 (v0.4.x)
- [ ] 基于 viem 与 AirAccount (Permissionless-style) 的架构重构
- [ ] 定义 SuperPaymasterClient 与语义化 Error Mapper

### 阶段二：生产力工具 (v0.5.x)
- [ ] UserOp Factory 与基线/对比测试数据导出 (CSV)

### 阶段三：UI 集成 (v0.6.x)
- [ ] React Hooks 与评价面板组件

## Phase 9: 论文量化评估准备 [⚠️ 暂停]
- [ ] 搭建基线测试 (EOA vs Pimlico) 脚本
- [ ] 自动化 CSV 采集与绘图数据预处理

## Appendix: Account Roles & Keys

| Role | Variable | Purpose |
| :--- | :--- | :--- |
| **Supplier** | `SUPPLIER_KEY` | Holds test ETH & GTokens. Funds others. |
| **Operator** | `OPERATOR_JASON_KEY` | Admin of AAStar. Mints SBTs. |
| **Relayer** | `RELAYER_KEY` | Performs EOA baseline tests. |
| **AA User 1**| `OWNER_JASON_KEY` | Controls SuperPaymaster AA. |
| **AA User 2**| `OWNER_ANNI_KEY` | Controls Standard Paymaster AA. |
