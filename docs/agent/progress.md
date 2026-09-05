# 进展 — 此刻真实状态

> 由 pilot `run` 持续更新。规划见 [`roadmap.md`](roadmap.md)，台账见 [`tasks.md`](tasks.md)，跟进项见 [`followups.md`](followups.md)。
> **本文件里每一处 `T<x.y.z> \`STATUS\`` 都由 `check:progress-sync` 与 tasks.md 对账**——它烂过一次，见下。

## 当前聚焦：M5 上游同步 + 账本门禁补洞

**更新于 2026-09-05 · main = `49679dd9`**

| Feature | 状态 | 说明 |
|---|---|---|
| F1.1 DVT 上链注册证据 | **全部 DONE**（#316 · #368） | dvt3 注册 tx `0x7aa5231a…` @ block `11604058`，五格独立读数互证 |
| F1.2 节点 onboarding API | **全部 DONE**（#361 · #367 · #377） | **API 面已收口**：gap 判的 8 条「需新增」5 交付 / 3 拍板不做。剩下的是 CC-38 的另一半（portal 页面），不在本 Feature 内 |
| F2.1 Slash 只读面 | T2.1.1 `DONE`（#362） · T2.1.2 `BLOCKED` | 阻塞理由 #370 已按实测重写：不是缺 ABI，是**链上没有 Timelock、slashPolicyAdmin 仍是 EOA** |
| F3.1 同步门禁常绿 | T3.1.1 `DONE` | 门禁在 `ci.yml` 里都有独立 `run:` 行；本轮又补了三道，见下 |
| F5.1–F5.4 上游同步 | **全部 DONE** | SP 栈地址 · AirAccount v0.33.0 · DVT 对齐 · KMS 37 端点对账 |

### ⚠️ 这个文件烂过一次，而且没有任何门禁看得见

本文件上一版停在 8-02 之后没跟上：`F1.2` 一栏写着 `T1.2.1 PR_OPEN`（实际早已 DONE），
「下一个 READY」列的两条都已交付，`T2.1.2` 的阻塞理由是 **#370 已经证伪的旧版**。

**最要命的一条**：它还留着「`setup-server.py` 只有 validator 那条是已被取代的 `0x539B9681…`」——
**这句话已经被 #375 撤回了**（dvt 反驳，我上链复核，两个锚都成立）。

> **一次更正若没有扫过每一份副本，就把错的那份留在了会有人去读的地方。**

`check-task-ledger` / `check-followups` / `check-branch-task` 三道都不看这个文件。
已补 `check:progress-sync`：本文件里每一处 `T<x.y.z> \`STATUS\`` 必须与 tasks.md 相等。
判据不是「它现在绿」，是**它对烂掉的那一版会红**（实测报 `T1.2.1: progress 说 PR_OPEN，tasks 说 DONE`）。

## 本轮（2026-09-05）交付

**上游对照**
- **#362** guardian slash 只读面 + 形状门禁。链上 4.11.0 是 7 字、SP 源码 4.12.0 是 8 字（`uint16 slashBps` 插在 `verifier` 前），**selector 相同**，7 参解 8 字返回不 revert。已 fail-closed，错误码 `E4004`。
- **#366** `abi:sync` 只按 `name(inputs)` 建键、**从不比较 outputs**——它当时正对着上面那条真漂移报绿。已补 `return-shape`；上线前量过爆炸半径：646 个同签名函数、恰好 1 处不匹配、零误报。
- **#375** 更正我自己发出去的一条断言（见上）。真正的发现是：**Sepolia 上不存在单一的「现役 validator」，只存在「某账户的现役 validator」**。
- **#377** 因此交付 `getAccountDvtValidator` + `onboardDvtNode({ account })`。

**账本门禁补洞（四次同一形状）**
- **#374 / FU-63** 六条 `done=PR#374`，而门禁读 PR 描述里的 `Closes`，报 `0 CLAIMED closed` 然后打绿——**那句话是真的，只是它说的是空集**。
- **#376 / FU-66** 没写 PR 号的状态产生零条 claim，同样打绿；**而漂掉的行不成比例地就是解析不了的行**。同 PR / FU-67：打印的数与核过的数是两次计算，读者把 ✅ 当成对上面那个数的裁决。
- **#378 / FU-68** 上一条只修了「状态」那半，**同一个函数**判断「有没有命名 PR」那半仍 fail-open。
- **#379 / FU-71** T1.2.3 整条任务从未被写进台账，而 #377 已经合了。补 `check:branch-task`。
- **本次** progress.md 自己。

## 分支 / PR

| PR | 用途 | 状态 |
|---|---|---|
| #379 | T1.2.3 补记 + `check:branch-task` | 待评审 |
| #15 | `[WIP] feat(m14) @aastar/react` | **挂起**，jason 已拍板保持原状（不合不关） |
| #14 | Spore `@aastar/messaging` draft | 挂起，CI FAILURE，正常在途 |

## 阻塞项（BLOCKED）

- **T2.1.2 Timelock 写编排** —— 链上 `canonical.timelockController` 是零地址、`slashPolicyAdmin` 是 EOA。**两条解除条件都不在本仓。**
- **M3/F3.2 主网** —— 链上 SuperPaymaster 3.2.2（旧 V3）与 SDK 对齐的 5.4.2 不兼容，需 V5 全栈重部署。**他仓交付，SDK 只跟踪。**

## 等 jason 拍板（不阻塞主线）

1. `kmsEnabled=true` 且无 apiKey 时是否 fail-closed（FU-24 / FU-28）
2. CI 的 archive RPC secret（FU-38）—— 门禁 4-6 的链上断言现在在 CI 上跑不了
3. TS 密钥扫描器要不要接进 CI（FU-44）
4. 11 条无法核实出处的白名单条目怎么办（FU-45）

**已拍板已执行**：4.12.0 aggregator 暂不部署（4.11 满足论文）· git hooks 走 (b) 开扫描 · PR #15 保持原状 · portal 不收 keystore 文件。

## 等他仓（不阻塞）

- **dvt** 零合并冻结中（DSR 定的，到 CC-115 B6 冻结前）；`account?:` 无依赖
- **sp** 冻结期零动作；4.12.0 部署检查单那行文字已定稿，解冻后与另三项同一个 PR 提
- **DSR** B4/B4b 已接收；B6 runner 坐标 `main ≥ d769a122`

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
