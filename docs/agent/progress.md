# 进展 — 此刻真实状态

> 由 pilot `run` 持续更新。规划见 [`roadmap.md`](roadmap.md)，台账见 [`tasks.md`](tasks.md)。

## 当前聚焦：M5 上游全面同步

**更新于 2026-09-05 · main = `1ecc587b`**

| Feature | 状态 | 说明 |
|---|---|---|
| F5.1 SP 栈地址 | **全部 DONE** (#331 · #329 · #333 → `ea0e8a9b`) | 地址已切、三腿断言在 CI 常跑、证据已回写 |
| F5.2 AirAccount v0.33.0 | T5.2.1 `DONE` (#332 → `a71106c2`) · T5.2.2 `READY` | 6 键已切并链上核验 |
| F5.3 DVT 对齐核验 | **DONE** (#335 → `a9b85a5a`) | 已从「核一次」变成「门禁常核」 |
| F5.4 KMS 面扫描 | **全部 DONE** (#336 · #337 · #338) | 37 端点已对账；`apiKey` fail-open 现状已被表征测试固化，是否改必填 = FU-24 待拍板 |
| F1.2 节点 onboarding API | T1.2.1 `PR_OPEN` | 缺口盘点交付：21 步 / 已有 API 13 / 需新增 8 |

**账本漂移已修正（2026-09-05）**：T5.4.2/T5.4.3 在 tasks.md 里一直标 `PR_OPEN`，而 #337/#338
分别在 09-04 17:59 / 17:47 就已 MERGED。这是 FU-43 记的那一类——**已交付却没标**，
结构上 `check:task-ledger` 看不见（它核「已声明的主张是否属实」，不核「已完成的工作是否被声明」）。

**方法论基线（仍适用）**：CC-115 B4 = PR #329，4 轮 pr-daemon 评审，approved `ecd4343d` →
合并 `e4439dda`。它建立的双轴 pin + 可证伪门禁方法，是逐个上游套用的模板。

**刚完成**：T1.2.1 缺口盘点。顺带核出一条跨仓事实：`AirAccount/kms/node-setup/` 把 Sepolia
validator 硬 pin 成已被取代的 `0x539B9681…`，理由写「SDK canonical 漂移成 0x0」，而 canonical
实为活的 `0x7ac7E9d4…`。两个 validator 都答 `isRegistered=true`，**pin 错了在链上看不出来**。
不在本仓修，已记入清单的「跨仓观察」。

**等他仓**（不阻塞）：
- CC-115 双轴 pin 裁决 —— 已两次问 @repo:dsr（`bd2be1ec` / `dc08ec2b`），未回
- DVT `fix/cc49-round5-…` 是否合入 master

## 分支 / PR

| 分支 | 用途 | 状态 |
|---|---|---|
| `feat/T1.2.1-node-onboarding-api-gap` | T1.2.1 缺口清单 | PR_OPEN |
| `chore/followups-20260905-v` | FU-34 账本更正 | PR #360，评审打在旧 sha，等再评审 |
| `docs/pilot-plan-upstream-sync` | 规划文档 | 待 PR |
| `codex/repcredit-e2e-evidence-20260823` | B4 evidence | 已合并（`e4439dda`），worktree 仍在 |

**挂起、需 jason 拍板**：PR #15（`[WIP] feat(m14)`，已 APPROVE 但标题仍 WIP、`checks=none`、
开了 161 天）与 PR #14（Spore draft，CI FAILURE）。即 FU-2，**不擅自合**。


---

<details><summary>历史状态（2026-08-18 之前）</summary>

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

</details>
