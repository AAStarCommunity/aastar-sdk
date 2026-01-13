# AAStar SDK 深度审计与增强实施计划 (2026-Jan-13)

**日期**: 2026-01-13
**状态**: 关键路径阻断 (ABI Loading Bug) / 架构重构进行中
**分析者**: Gemini Agent (Antigravity)

## 1. 现状深度审计 (Deep Audit Status)

基于对 `packages/sdk`, `packages/core`, `packages/paymaster` 的代码审查，我们发现 SDK 的重构处于 **“骨架已立，血肉未连”** 的状态。

### ✅ 已完成的改进 (The Good)
1.  **AdminClient 命名空间化**: `admin.ts` 已经成功实现了 `system`, `finance`, `operators` 的命名空间分离，API 结构清晰。
2.  **OperatorClient 逻辑融合 (Thick Client)**: `operator.ts` 实现了 `onboardFully`，成功将 Staking, Registry, SuperPaymaster 的逻辑编排在一起，消灭了中间层 `packages/patterns`。
3.  **基础验证库**: `packages/core/src/utils/validation.ts` 已创建，包含地址、金额、Uint128 的基础验证逻辑。

### 🚨 严重阻断性问题 (Critical Blockers)
1.  **ABI 加载机制失效 (P0)**:
    *   **现象**: `packages/core/src/abis/index.ts` 假设所有 `.json` 文件都包裹在 `{ "abi": [...] }` 结构中 (`RegistryABIData.abi`)。
    *   **事实**: 实际的 ABI 文件 (如 `abis/Registry.json`, `abis/SuperPaymaster.json`) 是 **Raw Array** (`[...]`)。
    *   **后果**: 运行时 `RegistryABI` 等均为 `undefined`。导致所有依赖 ABI 的调用（如 `viem` 的 `readContract`）在运行时崩溃（报错 `abi.filter is not a function`）。

### ⚠️ 待解决的架构缺陷 (Architecture Gaps)
1.  **验证逻辑未接入**: 虽然 `validation.ts` 存在，但 `OperatorClient` 和 `AdminClient` **完全没有使用它**。参数仍然透传给 `viem`，缺乏防御性编程。
2.  **硬编码 ABI 坏味道**: `OperatorClient` (Lines 118, 137) 使用 `parseAbi` 硬编码了 `operators` 和 `getPaymasterByOperator` 的函数签名。这是巨大的维护隐患，应直接使用 `core` 导出的完整 ABI。
3.  **错误处理不统一**: `AdminClient` 使用 `wrapAdminCall` 抛出标准 `Error`，而 `OperatorClient` 混用 `decodeContractError` 和 try-catch。缺乏统一的 `SDKResult<T>` 返回结构。
4.  **Type Safety 缺失**: 大量使用 `as any` (e.g., `client as any`), 且合约调用缺乏 Typechain 支持，无法在编译期发现参数错误。

---

## 2. 增强实施计划 (Enhancement Plan)

### 阶段 0: 紧急修复 (Immediate Fixes - < 24h)

#### 2.1 修复 ABI 加载器
修改 `packages/core/src/abis/index.ts`，增加兼容层，自动识别 ABI 格式。

```typescript
// 伪代码示例
function extractAbi(artifact: any) {
  return Array.isArray(artifact) ? artifact : artifact.abi;
}
export const RegistryABI = extractAbi(RegistryABIData);
```

### 阶段 1: 健壮性加固 (Robustness)

#### 2.2 全面接入 Validation
修改所有 Client 方法，在首行接入 `validateAddress`, `validateAmount`。

```typescript
// OperatorClient.ts
async onboardFully(args: { stakeAmount: bigint, ... }) {
    validateAmount(args.stakeAmount, 'Stake Amount');
    validateAddress(args.xPNTsToken, 'xPNTs Token');
    // ...
}
```

#### 2.3 消除硬编码 ABI
将 `OperatorClient` 中的 `parseAbi` 替换为：
```typescript
import { SuperPaymasterABI, PaymasterFactoryABI } from '@aastar/core';
// 使用 SuperPaymasterABI 替代硬编码
```

### 阶段 2: 质量与测试体系 (Quality & Testing Strategy)

针对你提出的 **“全面的 ABI 封装和业务抽象”** 目标，我们采用以下策略：

#### 2.4 测试分层架构 (Vitest Integration)
引入 `vitest` 作为测试运行器，建立三层测试网：

1.  **L1: Unit Tests (Pure Logic)**
    *   **对象**: `utils/validation`, `utils/roleData`.
    *   **方法**: 纯函数测试，无需 Mock。
    *   **覆盖率目标**: 100%。

2.  **L2: Client Integration Tests (Mocked Chain)**
    *   **对象**: `OperatorClient`, `AdminClient`.
    *   **方法**: Mock `viem` 的 `publicActions` 和 `walletActions`。
    *   **目的**: 验证“业务编排逻辑”（例如：确保 `onboardFully` 确实按顺序调用了 Approve -> Register -> Deposit）。
    *   **工具**: `viem` 自带的 Mock Transport 或 `vitest` 的 `vi.spyOn`。

3.  **L3: E2E Contract Tests (Anvil Fork)**
    *   **对象**: SDK + 真实合约。
    *   **方法**: 在 CI 中启动 `anvil`，部署合约，然后运行 SDK 测试用例。
    *   **现状**: 目前的 `scripts/*.ts` 是这种模式的雏形，但需要迁移到 `test/*.test.ts` 以获得更好的断言和报告。

#### 2.5 ABI 类型安全 (TypeGen)
为了确保覆盖所有 ABI，建议引入 `@wagmi/cli` 或 `typechain` 生成 TypeScript 类型。
*   **Action**: 配置 `wagmi.config.ts` 读取 `abis/*.json`，生成强类型的 `readContract` / `writeContract` 接口。这样如果在 SDK 中漏掉了某个参数，TS 编译会直接报错。

### 阶段 3: 业务抽象与 API 化 (Business Abstraction)

#### 2.6 标准化返回结果 (Result Monad)
放弃 `throw Error`，全面采用 `SDKResult<T>`。

```typescript
export type SDKResult<T> = 
  | { success: true; data: T }
  | { success: false; error: AAStarError };
```
这对于前端集成至关重要，能区分“用户取消”、“网络错误”和“合约Revert”。

---

## 3. 详细执行清单 (Action Items)

| ID | 任务 | 优先级 | 涉及文件 | 备注 |
| :--- | :--- | :--- | :--- | :--- |
| **P0-1** | **修复 ABI 加载 Bug** | 🔥 Critical | `packages/core/src/abis/index.ts` | 必须首先解决 |
| **P1-1** | OperatorClient 接入 Validation | High | `packages/sdk/src/clients/operator.ts` | 防止非法参数 |
| **P1-2** | AdminClient 接入 Validation | High | `packages/sdk/src/clients/admin.ts` | 防止非法参数 |
| **P1-3** | 移除硬编码 ABI | Medium | `packages/sdk/src/clients/operator.ts` | 使用 Core 导出 |
| **P2-1** | 配置 Vitest 环境 | High | `vitest.config.ts` | 建立测试基建 |
| **P2-2** | 编写 Validation 单元测试 | Medium | `packages/core/src/utils/validation.test.ts` | 验证基建 |
| **P2-3** | 编写 OperatorClient Mock 测试 | High | `packages/sdk/src/clients/operator.test.ts` | 验证编排逻辑 |
| **P3-1** | 定义 SDKResult 并重构错误处理 | Medium | `packages/sdk/src/types/result.ts` | 提升 DX |

此计划旨在将 AAStar SDK 从“能用”提升到“生产级标准”，确保每一行代码都经过验证，每一个 ABI 调用都有类型安全保障。
