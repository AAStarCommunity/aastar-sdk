# SuperPaymaster V3 SDK 测试指南 (CLI)

本文档面向开发者，提供 SuperPaymaster V3 系统在本地 Anvil 环境下的各种测试和初始化命令。

## 🛠 准备工作
在开始任何测试前，请确保：
1. 本地 `anvil` 已启动 (`anvil`)。
2. 位于 `projects/aastar-sdk` 目录。
3. `.env.v3` 文件存在（如果不存在，运行初始化脚本会自动创建）。

---

## 🚀 常用指令集

### 1. 初始化运行 (Init & Setup)
**场景**: 第一次运行测试，或者 Anvil 重启后需要重新同步合约状态。
```bash
./run_full_regression.sh --init-only
# 或者直接运行全量回归，它会自动包含初始化
pnpm run test:full
```

### 2. 快速回归测试 (Fast Test / Pre-commit)
**场景**: 日常开发中，快速验证核心安全逻辑（权限检查、影子账户等）。这也集成在 Git Pre-commit Hook 中。
```bash
pnpm run test:fast
```
*运行脚本: `scripts/99_bug_hunting_fast.ts`*

### 3. 全量场景回归 (Full Regression)
**场景**: 发布前验收，验证全部 72 个真实业务场景。包括重新部署、同步配置和运行所有核心测试脚本。
```bash
pnpm run test:full
```
*包含脚本: 01, 06, 08, 09, 10, 11, 12, 13, 14, 98, 99 系列*

### 4. 特定模块测试 (Module Specific)
如果你只想测试某个特定模块，可以使用以下快捷命令：

- **核心管理流程 (Registry/Admin)**:
  ```bash
  pnpm run test:admin
  ```
- **信用与还款系统**:
  ```bash
  pnpm run test:credit
  ```
- **安全与重入攻击**:
  ```bash
  pnpm run test:reentrancy
  ```

---

## 📊 测试报告解析
测试完成后，你会看到一个统一的报告。

> [!IMPORTANT]
> **报喜也报忧**: 我们的测试套件会截获每个脚本的内部 Revert。如果脚本输出中包含 "reverted" 或 "Error"，即便脚本没退出，回归套件也会将其标记为 **FAILED**。

---

## 🔍 故障排查
- **Panic: Allocated too much memory**: 这是 Anvil 在处理复杂 `roleData` 时的已知限制。如果遇到此错误，请尝试减小 `roleData` 中的字符串长度或清空 Anvil 重新运行。
- **DepositNotVerified**: 确保在调用 `notifyDeposit` 前，对应账户已向 Paymaster 合约转入足够的 aPNTs 代币。
