# AAStar SDK 重构实施计划 (2026-Jan)

**目标**: 将 AAStar SDK 从 "Advanced MVP" 升级为生产级加固版本。
**核心约束**: 保持所有 Gasless / Paymaster / SuperPaymaster 核心业务流程 100% 可用。
**基准测试**: `yarn test:l4` (全回归测试) 及 `scripts/test-kms-gasless.ts`。

---

## 阶段 0: 准备与安全基线 (Week 1)
*目标: 在不改变架构的前提下，通过增加验证逻辑堵住安全漏洞。*

### 0.1 建立重构基准 (Refactor Baseline)
- [ ] 锁定 `main` 分支代码，基于 `refactor-sdk-Jan-13` 分支工作。
- [ ] 确认当前 Full Regression (`run_sdk_regression.sh`) 全通过。
- [ ] 建立 `Snapshot` 测试，记录当前核心 API 的输入输出格式。

### 0.2 输入验证加固 (Security Hardening) - **P0**
- [ ] **通用验证模块**: 创建 `packages/utils/src/validation.ts`。
    - 实现 `validateAddress`, `validateAmount`, `validateChainId`。
- [ ] **Paymaster 加固**: 更新 `PaymasterUtils.ts`。
    - 在 `buildPaymasterData` 中增加对 `gasLimits` 的边界检查（防止 uint128 溢出）。
    - 验证 `paymasterAddress` 和 `tokenAddress` 格式。
- [ ] **API 入口防御**:
    - 在 `SuperPaymasterClient.submitGaslessTransaction` 入口处添加参数校验层。

---

## 阶段 1: API 标准化与错误治理 (Week 1-2)
*目标: 统一对外的交互体验，让调用者更容易处理结果。*

### 1.1 统一结果类型 (Result Types)
- [ ] 定义 `SDKResult<T>` 接口：
  ```typescript
  export type SDKResult<T> = 
    | { success: true; data: T }
    | { success: false; error: SDKError };
  ```
- [ ] 定义 `SDKError` 类，包含错误码系统 (`ERR_VALIDATION`, `ERR_NETWORK`, `ERR_CONTRACT`).

### 1.2 改造核心 Client 返回值
- [ ] 改造 `PaymasterClient` 和 `SuperPaymasterClient` 的核心方法，使其返回标准 Result 或者是抛出统一异常（需决策，建议统一抛出 `SDKError` 以保持 async/await 流程简洁）。

---

## 阶段 2: 架构解耦与包整合 (Week 2-3)
*目标: 降低模块间耦合，解决“包碎片化”和“继承地狱”问题。*

### 2.1 包结构整合 (Package Consolidation)
- [ ] **合并策略**:
    - `packages/paymaster` + `packages/superpaymaster` -> **`packages/paymaster`** (统一支付逻辑)。
        - **注意**: 物理合并但逻辑分离。保持 `PaymasterClient` (V4 Token Logic) 和 `SuperPaymasterClient` (Credit Logic) 为两个独立的导出类。
        - **共享**: 底层工具 (Utils, Types, Encoders)。
        - **隔离**: 验证逻辑 (`validatePaymasterUserOp`) 和 业务流程各自独立，互不干扰。
- [ ] **操作步骤**:
    1. 移动文件。
    2. 更新 `tsconfig.json` 和 `package.json` 依赖。
    3. 使用 `barrels` (index.ts) 重新导出，尽量保持对旧路径的兼容（如果可能）。

### 2.2 客户端重构 (Client Composition)
- [ ] **废弃 Mixin**: 逐步移除 `extends PublicActions, WalletActions...`。
- [ ] **引入 Modules**:
    - `NetworkModule`: 负责 `viem` Client 管理。
    - `ContractModule`: 负责低级合约调用。
    - `Orchestrator`: 负责高层业务流。
- [ ] **重写 `AAStarClient`**:
    - 作为单一入口，内部组合上述 Module。

---

## 阶段 3: 测试体系升级 (Week 4)
*目标: 从“脚本测试”升级为“工程化测试”。*

### 3.1 引入 Vitest
- [ ] 配置 `vitest` 环境。
- [ ] 迁移纯工具函数（Utils）测试到单元测试。

### 3.2 场景测试固定化
- [ ] 将 `scripts/test-kms-gasless.ts` 改造为标准的 Integration Test Case。
- [ ] 确保测试在 CI/CD 环境中可稳定运行（Mock 掉不必要的 RPC 调用，或使用 Anvil Fork）。

---

## 验证与验收标准

每完成一个子阶段，必须执行以下检查：

1.  **编译检查**: `pnpm build` 无报错。
2.  **单元测试**: 新增功能的 Unit Test 通过。
3.  **核心回归**:
    - `l4-setup.ts` 必须能完整跑通（Environment Setup）。
    - `test-kms-gasless.ts` 必须能成功模拟签名并提交（Business Flow）。
    - **Gasless 能力绝不能退化**。

## 立即执行项 (Next Actions)

1. [ ] 创建 `utils/validation` 模块。
2. [ ] 在 `SuperPaymasterClient` 中应用第一批输入验证。
3. [ ] 运行回归测试验证无副作用。
