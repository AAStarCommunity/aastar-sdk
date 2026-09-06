# 进展 — 此刻真实状态

> 由 pilot `run` 持续更新。规划见 [`roadmap.md`](roadmap.md)，台账见 [`tasks.md`](tasks.md)，跟进项见 [`followups.md`](followups.md)。
> **本文件里每一处 `T<x.y.z> \`STATUS\`` 都由 `check:progress-sync` 与 tasks.md 对账**——它烂过一次，见下。

## 当前聚焦：M5 上游同步 + 账本门禁补洞

**更新于 2026-09-06 · main = `ef5127a7` · npm `@aastar/sdk@0.46.0-rc.2`（dist-tag `rc`）**

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

## 本轮（2026-09-06）：评审积压清空 + rc.2 上线 + §4 全集实跑

### 评审积压：10 份 verdict 只在本地，GitHub 上一条都没有

`~/Dev/tools/PR-Daemon/reviews/sessions/2026-09-05-aastar-sdk/` 里躺着 #385–#394 的十份
APPROVE，**一条都没发到 GitHub**；`./watch.sh status` 显示 watcher 自 **2026-08-19 18:03**
就没跑。评审内容跑过了、也答过了（commit 里那些「#387 三条阻塞」就是答它们的），
**只有 `post_pr_review.sh` 那一步从来没跑**。

> **一次做完但没有留痕的评审，在门禁眼里等于没做。** CC-115 的 G0 读的是 GitHub 上的
> `reviewDecision`，不是谁的记忆。

jason 授权后用 PAT 模式补发，**9 个已合并**（#385 #386 #387 #388 #389 #391 #392 #393 #394）。
`#387` / `#390` 的 APPROVE 各差一个 commit（approve 之后补推的非阻塞项），按 acceptance D
「审最新 SHA」送去增量复审 —— 这正是 #360 踩过的坑。

### rc.2：一个 tag 装不上

`v0.46.0-rc.1` 只是个 git tag，树里 `packages/sdk/package.json` 仍是 `0.45.0`，
**npm 上从来没有过它**。已发布的 0.45.0 携带 v0.33.0 **之前**那批地址，
下游装它跑 CC-115 B3 栈会全挂、且挂得最难读。#388 合并后已发布 `0.46.0-rc.2`
（`latest` 仍留在 0.45.0），完整性哈希 `b8953258…a3b6d` 本地重算逐字相同，
空工程 import 实测三个键均为新值。**CC-115 B5 由此解锁**，已回帖。

### §4 全集：19 个 runner，14 绿

红的四条，成因分三类 —— **而三条同源**：

| 红 | 成因 |
|---|---|
| `cc103-committee` · `tier3-composite` · `tier3-webauthn(0x0a)` | 同一句 `lastSetMutationBlock()` 在 `0x7ac7E9d4…` 上 revert（上游 #244 已删）。#390 一合三条同消 |
| `x402-live-roundtrip` | 他仓未启用 opt-in facilitator 模块（503）。SDK 这半已由 `x402-direct-settle` 链上证明 |
| `dvt-realnode` | 门禁按设计红，在问一个产品问题（#392；jason 已选 (b)：legacy 路径**不算**本次发布声称支持的场景） |

另 2 条需板子侧 env 跑不了（`dvt3-register` 的 keystore、`dvt-kms-onboard` 的 `KMS_POP_URL`）。

### §4 期间查出并已修的三个真缺陷 —— 三条都是「声称」坏了，不是能力坏了

- **`configHashFromInitConfig` 只哈希 8 个字段，合约（#161）哈希 10 个。**
  症状 `InvalidOwnerSignature()` 读起来像密钥问题，实际是编码问题。
  链上向工厂读它自己的 `getConfigHash` 佐证：`0x05ca2a0c…` vs SDK `0x01ed5cc0…`。
  含此缺口的**已发布版本实测只有 `v0.45.0` 一个**。链上验收 tx `0xb5cd4426…d4405`。
- **`dvt-onboard-e2e` 的 PASS 行把 validator 写成字面量 `0x539B`**，而它实际跑在
  canonical `0x7ac7E9d4…` 上，跨两次 canonical bump 没人动。**错的 DVT validator 不会
  revert**（被取代的那个仍有 code、仍答 `isRegistered=true`），所以那行打印是唯一依据，
  而它在绿色路径上撒谎 —— 我自己就是第一个被它骗到的读者。已加门禁 `check:evidence-literals`。
- **`check:abi-drift:strict` 给的处方在 SuperPaymaster 上永远做不到。**
  上游 `foundry.toml` 声明 `additional_compiler_profiles = registry-size`（为把 Registry
  压进 EIP-170），foundry 于是给 98 个合约都写 `.default.json` + `.registry-size.json`、
  没有裸 `.json`。判据改成**测量**：比较候选者 ABI，相同则取用并写进报告，不同才拒绝。
  实测 98 个多 profile 合约 ABI 全同、0 个不同；`checked` 从 **26 涨到 34**。

### 这一轮的形状

三个缺陷加上评审打回我的五条，**八件事是同一件**：

> **一句读起来像已验证的话，和一句真被验证过的话，长得一模一样。**

而最刺的一次是：我在**修这个病的 PR 里**，又犯了五次（#395 评审五条阻塞全部成立），
其中一条是我写的注释宣讲「re-run the command, not the memory of it」，
而那条命令自己把实参省成了 `...`，**不可重跑**。

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
