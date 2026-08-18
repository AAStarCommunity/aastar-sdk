# AAStar SDK 实时状态 — progress

> 「此刻仓库真实发生了什么」。由 `pilot run` / `pilot status` 每一步更新。
> 更新时间：2026-08-02 01:40 · main = `025e1371` · SDK v0.43.0

## 当前聚焦
- **Milestone**：M3 生产就绪
- **Feature**：F3.1 同步门禁常绿
- **正在开发的 Task**：T3.1.1（PR_OPEN，范围经实测修正）
- **分支**：`chore/ci-sync-gates`
- **集成分支**：`main`（本仓库无 preview，见 `.pilot.yml`）

## 进行中 / 待回执的 PR
| Task | PR | 状态 | 备注 |
|:---|:---|:---|:---|
| T3.1.1 | 待建 | PR_OPEN | `check:addresses` 翻硬门禁 + `check:stubs` 新增硬门禁 + 三道 ABI 门禁加 `REQUIRE_UPSTREAM` 反真空绿 |
| — | #15 | 挂起 | `[WIP] feat(m14) @aastar/react + @aastar/xiaoheishu`，已 APPROVE 但标题仍 WIP，**不建议合**（FU-2） |
| — | #14 | 挂起 | Spore `@aastar/messaging` draft，CI FAILURE，正常在途 |

## 阻塞项（BLOCKED）
- **T2.1.2 Timelock 写编排**：`@aastar/core` 缺 OZ `TimelockController` ABI；slash 治理 proposer/executor 角色归属待业务确认。
- **M3/F3.2 主网**：链上 SuperPaymaster 3.2.2（旧 V3）与 SDK 对齐的 5.4.2 不兼容，主网需 V5 全栈重部署 —— **他仓交付，SDK 只跟踪**。

## 最近完成
- 2026-08-02 **T4.1.1 DONE** — PR #315 合并进 main（`025e1371`），pilot 规划层落库
- 2026-08-02 清理 5 个 squash-merged 本地分支（`git branch --merged` 认不出 squash，改用「merge-base + 逐文件 diff main 为空」逐个核实后手删）；顺带修复本工作副本被外部 agent 弄成 shallow 仓库（`.git/shallow` 截在 `40052c44`）导致 `merge-base` 失效、`safe-cleanup` 静默漏判 → `git fetch --unshallow` 已修
- 2026-08-02 **T1.1.1 DONE** — PR #316 合并进 main（`32b8f273`），dvt3 上链注册 evidence 脚本入库。评审：clestons APPROVE（R1a+R1b + Codex PK 深挖 EIP-2335/mod-r/EIP-2537 三段加密逻辑）；唯一 Low（控制字符剥离）转 FU-5，fail-closed 不阻塞
- 2026-08-01 PR #302 合并进 main（`check-abi-drift` 的 `AAStarBLSAlgorithm` name-collision 跳过，镜像已合并的 #301）
- 2026-08-01 清理 8 个已合并进 main 的本地分支（`safe-cleanup.sh --apply`，只 `-d`）
- 2026-08-01 四道同步门禁实测全绿：`abi:sync` / `check:abi` / `check:abi-drift` / `check:addresses`
- 2026-07-xx PR #314 CC-45 canonical Sepolia 地址同步至 airaccount-contract v0.28.0

## 下一个 READY
1. **T1.2.1** CLI/mjs → API 缺口盘点（T1.1.1 已合并，依赖已满足）
2. **T2.1.1** slash 只读查询 API（CC-13 批A，依赖已解除）
