# SDK 重构与回归测试计划 (SDK Regression & API Plan)

## 1. 项目目标与原则
**核心目标**: 验证 SDK 构建完整性，基于分层架构完善 API（满足 Phase 3 场景），并执行全量回归测试。

**开发原则**:
1.  **API 分层原则 (Layering)**:
    *   优先使用 **基础层 API (Base/Core SDK)** 构建 **业务层 API (Business API)**。
    *   如果基础层缺失，**先补充基础层**，再构建业务层。
    *   *例外情况*: 仅在性能瓶颈或极特殊逻辑下直接调用合约 ABI，且必须在代码中注释说明原因。
2.  **数据收集优先 (Data First)**:
    *   集成博士论文所需的数据收集模块 (`TestCountManager`)。
    *   提供独立的 API 套件用于实验数据采集（Gas 消耗、TPS、成功率等）。
3.  **合约稳定性**:
    *   基于 `SuperPaymaster` 项目提供的稳定 Sepolia 合约地址 (`.env.sepolia`)。
    *   仅在发现合约初始化缺陷时才回溯修改合约。

## 2. API 架构与差距分析 (Gap Analysis)

### 2.1 基础层 API (Base Layer) - `packages/core`, `packages/contracts`
*封装底层合约交互、类型定义、基础工具。*

*   **P0 (缺失/需增强)**:
    *   [ ] `StateValidator.getAccountBalances(addresses[])`: 批量获取 ETH/GToken/aPNTs 余额。
    *   [ ] `ContractConfigManager`: 适配 V3.1.1 配置读取（从 `.env` 或 Config 合约）。
    *   [ ] `TestCountManager`: 封装实验计数器与数据打点基础方法。

### 2.2 业务层 API (Business Layer) - `packages/sdk`
*基于基础层构建，面向最终开发者场景。*

*   **P0 (状态查询 - Read)**:
    *   [ ] `CommunityClient.getCommunityInfo(account)`: 返回角色、Token 地址、元数据。
    *   [ ] `OperatorClient.getOperatorInfo(account)`: 返回 Operator 类型 (Super/V4)、国库状态、质押额。
    *   [ ] `ExperimentClient.collectMetrics(txHash)`: **(新增)** 收集单笔交易的实验数据（Gas, Cost, Status）。

*   **P1 (核心写操作 - Write)**:
    *   [ ] `EndUserClient.deployAccount(owner, salt?)`: 封装 `SimpleAccountFactory` 部署逻辑。
    *   [ ] `EndUserClient.mintSBT(account)`: 封装 "自动质押 + Mint" 的组合逻辑。
    *   [ ] `OperatorClient.depositFunds(amount)` & `withdrawFunds()`: 简化质押金管理。
    *   [ ] `ExperimentClient.recordBenchmark(scenarioId)`: **(新增)** 记录场景基准数据。

*   **P2 (增强功能)**:
    *   [ ] `EndUserClient.fundWithXPNTs()`: 社区 Token 分发辅助方法。

## 3. 回归测试策略 (Scenarios)
我们将现有的散乱脚本重构为 **标准化场景测试 (Scenarios)**，位于 `tests/scenarios/`。

### 场景 1: 社区生命周期 (DAO Launchpad)
*   **目标**: 注册社区 -> 发行 xPNTs -> 初始配置。
*   **原脚本**: `09_local_test_community_lifecycle.ts`
*   **新测试**: `01_community_launch.test.ts`
*   **API 验证**: `CommunityClient`, `RegistryClient` (Base)。

### 场景 2: 运营商入驻向导 (Operator Wizard)
*   **目标**: 注册 SuperPaymaster Operator -> 质押 GToken -> 存入 aPNTs。
*   **原脚本**: `05_test_superpaymaster.ts`
*   **新测试**: `02_operator_setup.test.ts`
*   **API 验证**: `OperatorClient`, `FundingManager` (Base)。

### 场景 3: 终端用户体验 (Gasless UX)
*   **目标**: 新 EOA -> 部署 AA 账户 -> 领取 SBT -> 发送 Gasless 交易。
*   **原脚本**: `03_test_standard_aa.ts`
*   **新测试**: `03_end_user_gasless.test.ts`
*   **API 验证**: `EndUserClient`, `PaymasterClient` (Base).

### 场景 4: 实验数据收集 (PhD Data Collection)
*   **目标**: 运行基准测试 (Baseline) vs 实验组，自动记录数据。
*   **原脚本**: `collect_industry_baseline.ts`
*   **新测试**: `04_data_collection.test.ts`
*   **API 验证**: `ExperimentClient`, `TestCountManager`.

## 4. 执行计划 (Work Plan)

### 阶段 1: 基础层与实验工具建设 (1-2天)
1.  完善 `packages/core` 中的基础读取方法。
2.  **重点**: 实现 `ExperimentClient` 和 `TestCountManager`，确保数据收集通道畅通。

### 阶段 2: 业务 API 实现 (2-3天)
1.  按 P0 -> P1 顺序实现 `packages/sdk` 中的业务方法。
2.  严格遵守“基础层优先”原则，代码 Review 重点检查是否绕过 SDK 直接调用合约。

### 阶段 3: 场景回归与数据验证 (2天)
1.  迁移脚本至 `tests/scenarios/`。
2.  运行全量回归：`pnpm test:scenarios`。
3.  验证产生的实验数据格式是否符合论文要求。

### 阶段 4: Demo 重构 (P2 优先级)
*   在 `projects/aastar-sdk-demo` 仓库中进行。
*   基于已验证的 SDK API 改造前端逻辑。

## 5. 启动指令
```bash
# 1. 检查构建
pnpm build

# 2. 运行特定场景 (开发中)
pnpm test:scenarios --filter=01_community
```
