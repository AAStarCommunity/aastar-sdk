# AAStar SDK 重构实施计划 (2026-Jan) [v3.0 - Comprehensive]

**目标**: 打造一个既**安全健壮** (GPT-5.2) 又**极致易用** (Gemini CLI) 的生产级 SDK。
**来源**: 基于 `docs/refactor/2026-01-13-audit-analysis.md` 的综合评估。
**核心约束**: **Gasless 核心能力零退化**。所有阶段必须通过 `run_sdk_regression.sh`。

---

## 阶段 0: 全局安全加固 (Week 1 - P0)
*来源: GPT-5.2 安全建议*
*目标: 在不改变任何 API 结构的前提下，通过增加验证逻辑堵住安全漏洞。*

### 0.1 建立重构基准
- [ ] 锁定 `main` 分支代码，基于 `refactor-sdk-Jan-13` 分支工作。
- [ ] 确认当前全回归测试通过。
- [ ] **技术债务偿还**: 统一 ABI 导出机制 (消除 `{ "abi": ... }` 差异)，确保后续 Typechain 能正常工作。

### 0.2 输入验证体系 (Security Hardening)
- [ ] **创建验证层**: `packages/utils/src/validation.ts`。
    - 实现 `validateAddress`, `validateAmount` (防止负数/溢出), `validateChainId`。
- [ ] **Paymaster 深度防御**:
    - 在 `PaymasterUtils.ts` (V4) 中增加 `paymasterAndData` 构造时的参数边界检查 (uint128)。
    - **防止 Revert**: 在 SDK 层拦截非法参数，而不是等到链上 `AA23`。
- [ ] **API 守门员**:
    - 在 `SuperPaymasterClient.submitGaslessTransaction` 等高危写入口添加校验。

---

## 阶段 1: 架构重整与命名空间 (Week 2 - P1)
*来源: Gemini CLI 架构建议*
*目标: 解决“包碎片化”和“API 扁平化”问题。*

### 1.1 包结构物理合并 (Consolidation)
- [ ] **3-Package 结构**:
    - 🔄 **`packages/sdk`**: 吞噬 `enduser`, `community`, `admin` 等业务包。
    - 🔄 **`packages/paymaster`**: 吞噬 `superpaymaster` (物理合并，逻辑分离)。
    - 🔄 **`packages/react`**: 接管原 `dapp`。
    - 📦 **`packages/core`**: 保留作为 L0 基础层。

### 1.2 Admin 体系重构 (Namespacing)
- [ ] **实施命名空间**:
    - 将 `AdminClient` 的 50+ 方法按功能分类：
        - `admin.system.*` (Config, Upgrade)
        - `admin.operators.*` (Slash, Manage)
        - `admin.finance.*` (Fees, Revenue)
- [ ] **兼容性处理**: 短期内保留旧的一级方法作为 `@deprecated`，通过调用新方法实现。

---

## 阶段 2: 业务逻辑融合 (Week 3 - P1)
*来源: Gemini CLI "Thick Client" 建议*
*目标: 让 SDK 变得“好用”，消灭 `packages/patterns`。*

### 2.1 逻辑下沉 (Logic Fusion)
- [ ] **OperatorClient 进化**:
    - 移植 `OperatorLifecycle` -> `opClient.onboard()`。
    - 实现**智能连击**: `approve` -> `stake` -> `deposit` 一气呵成。
- [ ] **CommunityClient 进化**:
    - 移植 `CommunityLaunchpad` -> `commClient.launch()`。
- [ ] **交互优化**:
    - 所有涉及 ERC20 的 Action (deposit, stake)，增加 `autoApprove` 逻辑。

### 2.2 废弃 Patterns
- [ ] ❌ Delete: `packages/patterns`。彻底移除这个中间层。

---

## 阶段 3: 质量与标准化 (Week 4 - P2)
*来源: GPT-5.2 质量建议*
*目标: 统一错误处理与测试体系。*

### 3.1 错误处理 (Error Handling)
- [ ] 定义 `AAStarError` (含 Error Code)。
- [ ] 定义 `SDKResult<T> = { success, data, error }`。
- [ ] 全局替换 `console.error` 为标准抛错或返回 Result。

### 3.2 测试分层 (Testing)
- [ ] 引入 `Vitest`.
- [ ] 单元测试: 覆盖 `utils/validation` 和 `PaymasterUtils`。
- [ ] 集成测试: 固化 `scripts/test-kms-gasless.ts` 为标准 Test Case。

---

## 立即执行项 (Next Actions)

1. [ ] 创建 `packages/utils/src/validation.ts` (Phase 0)。
2. [ ] 在 `SuperPaymasterClient` 中应用验证 (Phase 0)。
3. [ ] 解决 ABI 加载格式不一致的技术债务 (Phase 0)。
