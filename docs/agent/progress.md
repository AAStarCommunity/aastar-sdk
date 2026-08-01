# AAStar SDK 实时状态 — progress

> 「此刻仓库真实发生了什么」。由 `pilot run` / `pilot status` 每一步更新。
> 更新时间：2026-08-01 23:45 · main = `91f7ede8` · SDK v0.43.0

## 当前聚焦
- **Milestone**：M4 仓库运维基线 / M1 DVT 节点上链交付
- **Feature**：F4.1 pilot 规划层 · F1.1 DVT 上链注册证据
- **正在开发的 Task**：T4.1.1（PR_OPEN）、T1.1.1（PR_OPEN）
- **分支**：`chore/pilot-scaffold`、`test/dvt3-onchain-register-evidence`
- **集成分支**：`main`（本仓库无 preview，见 `.pilot.yml`）

## 进行中 / 待回执的 PR
| Task | PR | 状态 | 备注 |
|:---|:---|:---|:---|
| T4.1.1 | 待建 | PR_OPEN | pilot 规划层 + `.gitignore` 忽略 `.codegraph/` |
| T1.1.1 | 待建 | PR_OPEN | dvt3 上链注册 evidence 脚本 |
| — | #15 | 挂起 | `[WIP] feat(m14) @aastar/react + @aastar/xiaoheishu`，已 APPROVE 但标题仍 WIP，**不建议合** |
| — | #14 | 挂起 | Spore `@aastar/messaging` draft，CI FAILURE，正常在途 |

## 阻塞项（BLOCKED）
- **T2.1.2 Timelock 写编排**：`@aastar/core` 缺 OZ `TimelockController` ABI；slash 治理 proposer/executor 角色归属待业务确认。
- **M3/F3.2 主网**：链上 SuperPaymaster 3.2.2（旧 V3）与 SDK 对齐的 5.4.2 不兼容，主网需 V5 全栈重部署 —— **他仓交付，SDK 只跟踪**。

## 最近完成
- 2026-08-01 PR #302 合并进 main（`check-abi-drift` 的 `AAStarBLSAlgorithm` name-collision 跳过，镜像已合并的 #301）
- 2026-08-01 清理 8 个已合并进 main 的本地分支（`safe-cleanup.sh --apply`，只 `-d`）
- 2026-08-01 四道同步门禁实测全绿：`abi:sync` / `check:abi` / `check:abi-drift` / `check:addresses`
- 2026-07-xx PR #314 CC-45 canonical Sepolia 地址同步至 airaccount-contract v0.28.0

## 下一个 READY
1. **T3.1.1** 四道 sync gate 进 CI（依赖已满足，门禁当前全绿，正是固化的时机）
2. **T1.2.1** CLI/mjs → API 缺口盘点（等 T1.1.1 合并后开工）
3. **T2.1.1** slash 只读查询 API（CC-13 批A，依赖已解除）
