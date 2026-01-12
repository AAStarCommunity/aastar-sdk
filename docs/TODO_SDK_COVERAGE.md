# SDK Testing Coverage TODO

This document tracks the test cases and scenarios that were skipped or identified for future coverage during the SDK regression enhancement phase (v2.1.0).

## 1. Skipped Scenarios: Test 5 (V2 Regression)

Test 5 in `run_sdk_regression.sh` was skipped due to persistent `RoleAlreadyGranted` errors arising from local blockchain state conflicts.

### Tracked Interfaces
- `Registry.registerRoleSelf(bytes32 roleId, bytes roleData)`
- `SuperPaymaster.notifyDeposit(address community, uint256 amount)`

### Background Context
The test attempts to register the `ROLE_COMMUNITY` and `ROLE_PAYMASTER_SUPER` roles. Even with `hasRole` guards, the transaction reverts if the address is already registered in a previous run with different metadata or state.

### Action Plan
- **Status Update (2025-12-26)**: Even after synchronizing `ROLE_COMMUNITY` and `ROLE_PAYMASTER_SUPER` hashes across the SDK and contracts, the `RoleAlreadyGranted` error persists. This confirms a deep-seated blockchain state conflict where the test address is already registered in a way that bypasses simple hash-existence checks.
- [ ] Reset local Anvil state (`forge script scripts/SetupV3...` with fresh accounts).
- [ ] Re-enable Test 5 in `run_sdk_regression.sh`.
- [ ] Verify `notifyDeposit` balance updates on-chain.

## 2. Technical Debt: Core Constants Synchronization

- **Role Hash Discrepancy**: Standardize the generation of hashes across `core/constants.ts` and `Registry.sol`.
- **Wallet Client Export**: `createAAStarWalletClient` is currently omitted from `core` in favor of SDK-level role clients (`createAdminClient`). Evaluate if a generic public wallet constructor belongs in `core`.

---

## 3. SDK 完备性核实与进阶优化 (2025-12-26 源码审计更正)

经过对 SDK 源码的深度检索，核实多项安全审计报告（`12-26-2sdk-audit.md`）中提到的“缺失项”**实际上已经实现**。以下是修正后的技术现状与优化计划：

### 3.1 Paymaster V4 管理端 (🔴 已实现，待集成验证)
- **现状核实**: 源码中已存在 `addGasToken`、`addSBT`、`withdrawPNT` 等接口（见 `packages/core/src/actions/paymasterV4.ts`）。
- **后续行动**: 
    - [ ] **场景集成**: 在 Phase 3 的场景测试中，正式调用这些接口执行“管理员配置 Paymaster”的流程，确保 Sepolia 集成无误。
    - [ ] **文档补全**: 确保这些接口在开发者指南中清晰可见。

### 3.2 SuperPaymaster V3 动态定价 (🟠 已实现，待开启测试)
- **现状核实**: `setXPNTsFactory` 接口已在 `SuperPaymasterClient` 和 `core` action 中定义。
- **后续行动**:
    - [ ] **全链路验证**: 在 Sepolia 环境下开启该功能，验证 SDK 能否正确配合 Factory 进行 Gas 定价。

### 3.3 BLS 签名与 DVT 工具链 (🟠 已实现核心，待易用性增强)
- **现状核实**: `core/src/crypto/blsSigner.ts` 已包含 `BLSSigner` 工具类。
- **后续行动**:
    - [ ] **DVT 助手封装**: 在 `packages/dvt`（如后续拆分）中提供更高层的业务助手，进一步简化 `executeSlashWithProof` 的参数构造。

### 3.4 API 安全性与权限限制 (🟡 已标记，待物理隔离)
- **现状核实**: `StakingActions.lockStake` 已经添加了 `@internal` 注解和明确的警告。
- **后续行动**:
    - [ ] **物理隔离**: 考虑在未来的重构中将管理员相关的 Actions 从公共 Client 中完全剥离，实行物理上的权限解耦。

---
*上次更新: 2025-12-26 (基于 SDK 源码深度审计结果)*
