# SDK & Contract Optimization Evaluation Plan (GBT5.2 Recommendations)

## 概述
本方案针对 GBT5.2 对 `aastar-sdk` 及相关合约 ABI 扫描后给出的建议进行评估，并制定后续优化计划。我们将建议分为 **SDK 优化**、**合约安全加固** 以及 **架构对齐** 三个维度，并根据优先级划定动作：**优化 (Optimize)**、**置之不理 (Ignore)** 或 **更好的方案 (Better Solution)**。

---

## 评估与动作列表

### 1. SDK 侧建议评估 (packages/superpaymaster & core)

| 建议点 | 评估 | 动作 | 理由/方案 |
| :--- | :--- | :--- | :--- |
| **`getPaymasterAndData` 输入上界校验** | 高 | **优化 (Optimize)** | `uint128` 溢出或格式错误会导致 Bundler 端不可预测的失败。应在 SDK 侧拦截并抛出清晰错误。 |
| **`checkEligibility` 移除硬编码 Sepolia** | 中 | **优化 (Optimize)** | 支持多链是 SDK 的基本要求。应允许用户传入 `chainId` 或从 `provider` 自动获取。 |
| **`formatUserOpToBundlerV07` 字段长度严格断言** | 高 | **优化 (Optimize)** | V0.7 格式对字节长度（如 `0x...` 字符串长度）有严格要求，由于 JS 没有原生固定长度字节类型，SDK 必须代劳检查。 |

### 2. 合约侧（基于 ABI 反推）建议评估

| 建议点 | 评估 | 动作 | 理由/方案 |
| :--- | :--- | :--- | :--- |
| **`PaymasterV4` 价格预言机新鲜度与权限校验** | 极高 | **优化 (Optimize)** | 关键安全路径。需确认合约源码中是否有 `updatedAt` 和 `roundId` 校验。SDK 侧无法修正，需同步到合约端。 |
| **`SuperPaymasterV3` 债务隔离与 Slash 路径** | 高 | **优化 (Optimize)** | 多运营方模式下，用户债务必须隔离。Slash 逻辑需严格绑定 BLS 证明，防止误伤或攻击。 |
| **`BLS/DVT` 聚合签名实操验证** | 极高 | **更好的方案 (Better Solution)** | 若目前仅为逻辑占位，主网前必须实现完整的 BLS 配对验证，或先行降级为多签治理方案以保安全。 |
| **`Registry` 重放攻击防御 (Epoch/Nonce)** | 中 | **优化 (Optimize)** | Reputation 同步必须单调递增或带 Nonce，防止过期状态覆盖新状态。 |
| **`ReputationSystemV3` 数组上限与 NFT 真实性** | 中 | **优化 (Optimize)** | 防止 Gas DoS 攻击。NFT Boost 必须做 `balanceOf` 校验而非仅仅依赖输入数组。 |

---

## 执行计划与优先级

### 第一阶段：SDK 鲁棒性增强 (Priority: P0)
**目标**：确保 SDK 生成的 Payload 100% 符合规范，并能拦截低级输入错误。
- [ ] 在 `getPaymasterAndData` 中增加 `uint128` 范围检查与地址合法性检查。
- [ ] 重构 `checkEligibility`，支持从配置或环境中读取 `chainId`。
- [ ] 为 `formatUserOpToBundlerV07` 增加对 `Hex` 长度的显式断言。

### 第二阶段：合约安全与逻辑核对 (Priority: P1)
**目标**：将 ABI 发现的高风险点在合约源码中进行逐一核对与修复。
- [ ] 对接 `SuperPaymaster` 仓库，核对 `PaymasterV4` 和 `SuperPaymasterV3` 的关键权限代码。
- [ ] 评估 `BLS/DVT` 的实现深度，并给出迁移/补全方案。

### 第三阶段：文档与标准对齐 (Priority: P2)
**目标**：更新技术文档，确保 SDK 行为与合约逻辑完全一致。
- [ ] 更新 `projects/aastar-sdk/docs` 下的各组件文档。

---

## 备注
> [!IMPORTANT]
> 由于本仓库仅包含 ABI 且当前处于 SDK 开发模式，上述合约侧建议需在切换至合约仓库时强制执行。SDK 的优化可即刻开始。
