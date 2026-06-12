# AAStar SDK v0.19.0 Beta Release Plan

> 版本目标：在 v0.18.0 基础上完成 SuperPaymaster v5.3.3 + AirAccount v0.17.2 + KMS v0.19.0 的 SDK 对齐，
> 分三个 Beta 递进发布，每个 Beta 对应一个稳定可测试的能力边界。

---

## 总体策略

| Beta | 代号 | 核心目标 | 验收标准 |
|------|------|---------|---------|
| v0.19.0-beta.1 | **Gasless Core** | 原有 gasless 能力在新合约下回归通过 | Anvil + op-Sepolia 全套 regression 绿灯 |
| v0.19.0-beta.2 | **Agent Ready** | Agent session key / KMS agent 调用全链路跑通 | 新增 agent 集成测试通过 |
| v0.19.0-beta.3 | **Full Sync** | 全量 ABI 覆盖 + 新 API 集成 + 完整测试矩阵 | ABI 覆盖率 100%，所有 issue 关闭 |

---

## Beta 1 — Gasless Core

### 目标

恢复 v0.18.0 中已具备的 **SuperPaymaster gasless** 和 **AirAccount 基础账户 gasless** 能力，
使其与 SuperPaymaster v5.3.3 + AirAccount v0.17.2-beta.2 合约对齐并通过完整回归测试。

### 范围

**不引入新功能**，只做合约破坏性变更的对齐修复：

- SuperPaymaster v5.3.3 breaking changes:
  - `operators()` tuple 字段重新索引（9 字段，去掉 `exchangeRate`）
  - `configureOperator` 缩减为 2 参数
  - `exchangeRate` 移到 xPNTs token 合约，需二次读取
  - `setBLSValidator` / `blsValidator` 已移除
- AirAccount M9 合约变更:
  - `buildGuardianAcceptanceHash` 新增 `dailyLimit` 绑定（C-3 front-run 修复）
  - `ModuleType` 常量更新：HOOK 3→4，FALLBACK=3
  - `AgentSessionKeyValidator` 精简：移除 `spendToken`/`spendCap`/`totalSpent`，`delegateSession` 新增显式 `account` 参数
  - 新增 `modifyTierLimitsWithGuardians`

### 依赖 PR（必须合并）

| PR | 作者 | 分支 | 当前状态 | 操作 |
|----|------|------|---------|------|
| **#36** | David (0XCY) | fix/sdk-v533-breaking-changes | CHANGES_REQUESTED | 我们自行修复后请他人 review |
| **#27** | David (0XCY) | chore/m9-contract-sync | CHANGES_REQUESTED | 我们自行修复后请他人 review |
| **#41** | jason | chore/abi-sync-v5.3.3-beta.2 | open | 直接 review 后合并 |
| **#42** | jason | sync/airaccount-v0.17.2-beta.2 | open | 直接 review 后合并 |

**PR #36 需修复的具体问题：**

1. `operator.ts:246` 新增的 `parseAbi(['function exchangeRate() view returns (uint256)'])` 违反项目规则，必须移入 `@aastar/core`
2. 同文件 `line 231` 的 `operators()` inline parseAbi（本 PR 修改过）同样需移入 core
3. 缺少 3 条新代码路径的单元测试：正常 exchangeRate 读取、zero-address 跳过、catch fallback
4. `catch {}` 全量静默，需区分"合约未部署"（预期静默）和 RPC/decode 失败（应 warn）
5. 硬编码 `'0x0000000000000000000000000000000000000000'` → 使用 `zeroAddress`

**PR #27 需修复的具体问题：**

1. Sepolia regression 确认 CREATE2 地址漂移（PR #47 encoding 变更影响），需运行后勾选 checkbox
2. golden-value test 需确认是独立验证（非循环）

### 关联 Issue（Beta 1 关闭）

| Issue | 标题 |
|-------|------|
| #34 | SuperPaymaster v5.3.3 operators() / configureOperator breaking change |
| #46 | v0.17.2-beta.2 SDK sync index |

### 验收命令

```bash
pnpm -r build
pnpm -r test
./run_sdk_regression.sh              # Anvil
./run_sdk_regression.sh --env op-sepolia
```

验收要点：
- `submitGaslessUserOperation` 端到端成功（ERC-20 transfer via SuperPaymaster）
- `createAccountWithGuardian` + `buildGuardianAcceptanceHash` 参数正确
- `configureOperator(addr, config)` 2 参数调用正常
- `getOperatorStatus` 能读到 `exchangeRate`（从 xPNTs token）

---

## Beta 2 — Agent Ready

### 目标

在 Beta 1 能力基础上，集成 **Agent session key**、**KMS agent 调用**、**SuperPaymaster agent 赞助** 全链路，
覆盖 AirAccount grantSession、KMS sign-typed-data、SuperPaymaster 信用赞助三个环节。

### 范围

- **KMS v0.19.0 新 API**：
  - `grant-session` 端点（agent key 授权）
  - `sign-typed-data` breaking change：新的 106-byte / 149-byte 格式
  - 与 AirAccount v0.17.2 grantSession flow 对接
- **AirAccount session key flow**：
  - `grantSession`（UserOp / gasless，适用 agent）vs `grantSessionDirect`（owner EOA only，不适用 agent）
  - `AgentSessionConfig` 精简后的新字段（无 spendToken/spendCap）
  - `encodeDelegateSession(account, subKey, subCfg)` 3 参数新签名
- **SuperPaymaster agent 赞助**：
  - credit/debt 体系：`getCreditLimit` / `recordDebt` / `repayDebt`
  - `isRegisteredAgent` 白名单检查
  - Agent UserOp 的 paymaster data 组装

### 依赖 Issue（Beta 2 完成后关闭）

| Issue | 标题 | 负责方 |
|-------|------|------|
| #38 | KMS v0.19.0 API updates — grant-session + sign-typed-data breaking change | SDK team |
| #35 | grantSessionDirect is owner-EOA-only — clarify in docs + guard in SDK | SDK team |
| #32 | ERC-8004 SDK integration (AirAccount v0.17.1 diamond-lite routing) | SDK team |
| #25 | test: packSignature() byte-layout guard | SDK team |
| #24 | test: SuperPaymaster postGas=300_000 branch | SDK team |

### 新增测试

- `tests/regression/agent-session.ts` — agent session key 授权 + 使用端到端
- `tests/regression/kms-sign-typed.ts` — KMS sign-typed-data 新格式验证
- `packages/airaccount/src/server/__tests__/session-key-service.test.ts` 补全

### 验收要点

- agent EOA 通过 `grantSession`（不是 `grantSessionDirect`）获取 session key
- KMS `sign-typed-data` 使用 149-byte 格式，域分隔符正确
- SuperPaymaster 能识别 registered agent，使用 credit 赞助 UserOp
- `delegateSession(account, subKey, subCfg)` 3 参数调用正确

---

## Beta 3 — Full Sync

### 目标

完成所有合约的**完整 ABI 覆盖**，集成 SuperPaymaster、KMS、AirAccount 的全部新能力，
SDK 对所有 on-chain 接口提供类型安全包装，并通过完整测试矩阵。

### 范围

**SuperPaymaster 全量支付方式：**
- v5.4 removed/renamed functions 迁移（Issue #30）
- 全量支付模式：ETH 预付、社区积分（xPNTs）、ERC-20 稳定币、credit 免预付
- `x402` C-02/C-03 签名验证结算对齐（Issue #39）

**AirAccount 全量新能力：**
- v0.17.2-beta.3 完整 ABI（64 个函数，factory custom errors，VERSION 常量）（Issue #48）
- `ForceExitModule`：L2→L1 紧急退出路径 SDK 集成（Issue #43）
- `AirAccountDelegate`：EIP-7702 payload 构建 + integrator-supplied relay（Issue #44）
- EIP-7702 browser wallet onboarding（Issue #45，受限于 wallet 生态，可推迟）

**KMS 完整新 API：**
- 全量 v0.19.0 端点对接
- ABI 变更对应的 SDK 类型更新

### 依赖 Issue（Beta 3 完成后关闭）

| Issue | 标题 |
|-------|------|
| #48 | AirAccount v0.17.2-beta.3 ABI sync（64 functions，custom errors，VERSION） |
| #43 | ForceExitModule SDK 集成 |
| #44 | AirAccountDelegate EIP-7702 SDK payload 构建 |
| #39 | x402 C-02/C-03 signature-required settlement |
| #30 | SuperPaymaster v5.4 removed/renamed functions |
| #45 | EIP-7702 browser wallet onboarding（可推迟，blocked by wallet ecosystem） |

### 验收要点

- `pnpm run audit:abi` 0 gaps（所有合约 ABI 与链上对齐）
- 所有 `packages/*/src/__tests__` 通过，coverage ≥ 80%
- Anvil + op-Sepolia 全套 regression 绿灯
- `docs/SDK_ABI_COVERAGE.md` 更新至 100% 覆盖

---

## 未解决 PR 状态跟踪

> 更新时间：2026-06-12

### 阻塞 Beta 1（需立即处理）

| PR | 标题 | 作者 | 状态 | 行动 |
|----|------|------|------|------|
| #36 | fix(sdk): align operator.ts + registry.ts to v5.3.3 | David | CHANGES_REQUESTED | **SDK team 自行修复** |
| #27 | chore(airaccount): sync SDK to M9 contract changes | David | CHANGES_REQUESTED | **SDK team 自行修复** |
| #41 | chore(abi): sync ABIs to SuperPaymaster v5.3.3-beta.2 | jason | open | review 后合并 |
| #42 | feat(core): sync AirAccount v0.17.2-beta.2 ABIs | jason | open | review 后合并 |

### 不阻塞发布（可并行 or 后续处理）

| PR | 标题 | 作者 | 状态 | 关联 Beta |
|----|------|------|------|---------|
| #33 | fix(abi): sync v5.3.3-beta ABIs（older，可能被 #41 覆盖） | jason | open (behind 2) | Beta 1，核查是否重复 |
| #47 | feat(community/research): paper7 CommunityFi | jason | open | 研究论文，不阻塞 |
| #37 | feat(keeper): network-parameterized run-keeper.sh | jason | open | Beta 3 / 独立 |
| #15 | [WIP] feat(m14): @aastar/react + @aastar/xiaoheishu | jason | CHANGES_REQUESTED WIP | Spore，不阻塞 |
| #14 | [WIP] feat(spore): @aastar/messaging M1-M13 | jason | open WIP | Spore，不阻塞 |
| #7  | feat(sdk): add ResendMailer email utility | jason | open (behind 1) | 低优先级 |

---

## 发布依赖图

```
main (v0.18.0)
  │
  ├── [merge #41, #42]         ← ABI sync (no code changes)
  │
  ├── [fix + merge #36, #27]   ← Breaking change alignment
  │
  ▼
v0.19.0-beta.1 tag
  │
  ├── implement #38 KMS v0.19.0 API
  ├── implement #35 grantSession guard
  ├── implement #32 ERC-8004 routing
  ├── close #24, #25 tests
  │
  ▼
v0.19.0-beta.2 tag
  │
  ├── implement #48 AirAccount beta.3 ABI
  ├── implement #43 ForceExitModule
  ├── implement #44 AirAccountDelegate EIP-7702
  ├── implement #39 x402 C-02/C-03
  ├── implement #30 SP v5.4 migration
  │
  ▼
v0.19.0-beta.3 tag → v0.19.0 release
```

---

## 分支清理记录

> 记录于 2026-06-12

| 分支 | 处置 | 原因 |
|------|------|------|
| `chore/sync-sepolia-v5.3.2-addresses` | ✅ 已删除（本地） | PR #19 已合并，remote 已 gone |
| `feature/v5-x402-sdk` | ✅ 已删除（本地） | PR #18 已合并，无 remote |
| `pr-15` | ✅ 已删除（本地） | 仅为 PR #15 的临时 checkout |
| `feat/paper3-e1-censorship-simulation` | ✅ 已删除（本地+远程） | PR #26 关闭（未合并），实验数据已存档在 PR |
| `feat/paper3-controlled-baseline` | ✅ 已通过 PR #49 合并入 main | Alchemy 受控基线数据，paper3 v7.9 |
