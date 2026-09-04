# AAStar SDK 任务台账 — Task

> 前置：[`roadmap.md`](roadmap.md)（M→F）。此刻状态见 [`progress.md`](progress.md)，跟进项见 [`followups.md`](followups.md)。
> 每个 Task 自包含，可独立开发与验收。**验收标准必须可机器验证**（跑命令能判定）。
> 状态：`BACKLOG` · `READY` · `IN_PROGRESS` · `BLOCKED` · `PR_OPEN` · `CHANGES_REQUESTED` · `APPROVED` · `DONE`

---

## F1.1 — DVT 上链注册证据

### T1.1.1 dvt3 独立节点上链注册 evidence 脚本  `DONE`
- **优先级**：high
- **目标**：把 dvt3（board B，EIP-2335 keystore）在 Sepolia 完成 stake + `registerWithProof` 的一次性脚本沉淀进版本库，让这条路径可复跑、可复核。
- **开发范围**：`tests/regression/onchain-evidence/dvt3-register.ts` —— 解密 keystore（仅内存）→ 校验 pubkey/nodeId 与 board `node_state.json` 一致 → `onboardDvtNode` dryRun 断言 nodeId 一致 → 真实上链 → 独立 re-read 复验 `isRegistered` / `nodeOperator`。
- **明确不做**：不把 keystore、passphrase、operator 私钥写进仓库（全部走 env）；不改 `onboardDvtNode` 本身。
- **依赖**：无（`buildDvtPop` + `dvtOperatorActions` 已随 PR #288 落地）
- **交付物**：evidence 脚本 + 一次成功的 register tx hash
- **验收命令**：`DRY_ONLY=1 pnpm exec tsx tests/regression/onchain-evidence/dvt3-register.ts`（需 board 侧 env；无 env 时至少 `pnpm exec tsc --noEmit` 通过）
- **涉及文件**：`tests/regression/onchain-evidence/dvt3-register.ts`
- **风险/回滚**：真实上链且 JASON 代付 ETH+GToken —— **默认必须先 `DRY_ONLY=1` 跑一遍**，nodeId 与板子 `node_state.json` 不一致时脚本自身 abort。
- **证据**：PR #316 合并进 main = `32b8f273`（2026-08-02）。评审 APPROVE；Codex PK 的 EIP-2335 控制字符剥离 Low → FU-5

### T1.1.2 记录 dvt3 注册的 tx hash 到 onchain-evidence 索引  `BACKLOG`
- **优先级**：mid
- **目标**：让 `docs/onchain-evidence.md` 有 dvt3 这条的 tx hash + 区块，符合「验收 = 上链 tx hash，不是单测」的纪律。
- **依赖**：T1.1.1
- **验收命令**：`grep -n "dvt3" docs/onchain-evidence.md`

---

## F1.2 — 节点 onboarding API

### T1.2.1 盘点 CLI/mjs 脚本 → API 的缺口  `READY`
- **优先级**：high
- **目标**：明确 `register-node.mjs` / `dvt3-register.ts` 里哪些步骤还没有对应的 SDK API，产出缺口清单（社区节点接入的真正交付物是 API + portal，不是脚本）。
- **开发范围**：只做盘点与设计，不写实现。
- **明确不做**：不动 portal UI。
- **依赖**：T1.1.1（先有一条跑通的真实路径再抽象）
- **交付物**：`docs/agent/` 下一份缺口清单或直接展开成 T1.2.2+
- **验收命令**：清单文件存在且逐条标注「已有 API / 需新增」

### T1.2.2 节点 onboarding API 实现  `BACKLOG`
- **优先级**：high
- **依赖**：T1.2.1
- **验收命令**：待 T1.2.1 定义

---

## F2.1 — Slash 治理 read getters（CC-13 批A）

### T2.1.1 slash 只读查询 API  `READY`
- **优先级**：mid
- **目标**：暴露 slash 状态/冷却/阈值等只读能力（`isSlashPending` 等已随 0.39.4 进 ABI）。
- **依赖**：无（地址依赖已由 CC-18 / 0.39.4 解除）
- **验收命令**：新增单测 `pnpm --filter @aastar/core test` 全绿 + 一条 Sepolia 实读证据

### T2.1.2 Timelock 写编排（批B）  `BLOCKED`
- **优先级**：mid
- **阻塞原因**：`@aastar/core` 尚未纳入 OZ `TimelockController` ABI；且 slash 治理的 proposer/executor 角色归属需业务确认。
- **依赖**：T2.1.1

---

## F3.1 — 四道同步门禁常绿

### T3.1.1 把 sync gate 固化进 CI（范围经实测修正）  `PR_OPEN`
- **优先级**：high
- **原目标**：四道（`abi:sync` / `check:abi` / `check:abi-drift` / `check:addresses`）全进 CI 硬门禁。
- **⚠️ 实测推翻了原目标**：在 `git archive` 造的干净 CI checkout（无 sibling 上游仓）里跑，**三道 ABI 门禁全部 skip-and-PASS** —— `check:abi-drift` 打 "no upstream out/ dirs — skipping"、`check:abi` 三个上游全 skipped、`abi:sync` 直接打 "0 missing · 0 drifted · PASS: ABIs complete + in sync with upstream"。它们要拿 sibling 目录里 `forge build` 出来的 `out/` 比对，runner 上根本没有。**照原样接进 CI = 一个拿零个产物比出来的绿灯**，比没有门禁更坏（`upstream-watch.yml` 对 full radar 记过同一约束）。
- **修正后的交付**：
  1. `check:addresses` 从 advisory（`continue-on-error`）翻成**硬门禁** —— 它自足（只比 `config.*.json` ↔ `CANONICAL_ADDRESSES`），且已 passes clean，ci.yml 原注释本就写着"passes clean 后翻硬"
  2. `check:stubs` 新增为**硬门禁** —— 同样自足，护 #169 那类静默 stub
  3. 三道 ABI 门禁加 `REQUIRE_UPSTREAM=1`：**上游缺席从 skip-and-pass 变成硬失败**，杜绝真空绿；`RELEASE-CHECKLIST §3` 改为必须带此 flag 跑
  4. ci.yml 里写明这三道**故意不进 CI** 的理由 + 将来若要进 CI 的前提（runner 先 checkout+build 上游，再置 flag）
- **明确不做**：不在 CI 里 checkout/build 上游合约仓（成本高、部分仓私有）——若要做是独立 task
- **验收命令**：`REQUIRE_UPSTREAM=1 pnpm run abi:sync && REQUIRE_UPSTREAM=1 pnpm run check:abi && REQUIRE_UPSTREAM=1 pnpm run check:abi-drift && pnpm run check:addresses && pnpm run check:stubs`（本机全绿）；且干净 checkout 里带 flag 跑三道 ABI 门禁必须 **exit 1**
- **涉及文件**：`.github/workflows/ci.yml`、`scripts/{abi-sync,check-abi-completeness,check-abi-drift}.ts`、`docs/RELEASE-CHECKLIST.md`
- **证据**：branch `chore/ci-sync-gates` / PR 待建

---

## F4.1 — pilot 规划层

### T4.1.1 建立 .pilot.yml + docs/agent 规划层  `PR_OPEN`
- **优先级**：high
- **目标**：让 pilot 能接管本仓库的持续开发：配置、三级规划文档、跟进账本齐备。
- **交付物**：`.pilot.yml`、`docs/agent/{roadmap,tasks,progress,followups}.md`、`.gitignore` 忽略 `.codegraph/`
- **验收命令**：`test -f .pilot.yml && test -f docs/agent/tasks.md && bash ~/.claude/skills/pilot/scripts/followups.sh count-open --docs-dir docs/agent`
- **证据**：branch `chore/pilot-scaffold` / PR #315

---

## F5.1 — SP 栈地址与 ABI（canonical → 4.11.0）

### T5.1.1 canonical `blsAggregator` 切到 4.11.0 + 三腿一致性断言  `DONE`
- **优先级**：critical
- **目标**：SDK 公共面的 sepolia `blsAggregator` 现在指向一个 SuperPaymaster 已经不认的合约。切到链上三腿一致指向的 `0xEaeC2F512eA50708211fa95533e4dBb60e3d2E5D`(BLSAggregator-4.11.0)，并让「三腿不一致」变成 CI 会红的断言，而不是靠人隔几周读一次链。
- **开发范围**：`packages/core/src/addresses.ts` sepolia 块 `blsAggregator`；`config.sepolia.json` 同字段；新增 `packages/core/src/addresses.threeLegs.test.ts`（对链读 `Registry.blsAggregator` / `SuperPaymaster.BLS_AGGREGATOR` / `DVTValidator.BLS_AGGREGATOR`，三者必须彼此相等且等于 canonical）。
- **明确不做**：不动 `dvtValidator`（另见 T5.3.1）；不动 op-sepolia / op-mainnet 块（那是旧 V3 栈，M3/F3.2 的事）。
- **依赖**：无。B4 已在 evidence 分支验证过同一组读数。
- **交付物**：canonical + config 一致；三腿断言测试；`docs/onchain-evidence.md` 追加一条读数记录。
- **验收命令**：`pnpm run check:addresses && pnpm --filter @aastar/core test`
- **涉及文件**：`packages/core/src/addresses.ts`、`config.sepolia.json`、`packages/core/src/addresses.threeLegs.test.ts`
- **风险/回滚**：改的是**公共面地址**。旧地址 `0xF51c…` 保留为注释（历史可读），不删。回滚 = 单文件 revert。
- **待人拍板**：无——旧地址已不被 SP 认可，留着比切更危险。
- **证据**：PR #331 **已合并 `099a2023`**（2 轮评审）。链上读数 @ block 11634451。第 2 轮打回的是「CI 从没设 `AASTAR_ONCHAIN_TEST`，四条链上断言在 CI 里一条都没跑，而文件注释却声称 CI 设了」——**注释担不住这种保证，改由 CI-only 断言担保**。三腿断言的**起点定为 Registry**：实测三个聚合器（4.11.0 / 4.3.0 / 4.1.0）的 `DVT_VALIDATOR()` 返回值完全相同，反向读区分度为零，从 pin 出发等于预设结论。变异验证：pin 改回 4.3.0 → 4 条红且 `no rotation in flight` 保持绿（它不承重）；改回 4.1.0 且不开链上 → 离线负对照单独红。

### T5.1.2 ~~把部署版 4.11.0 ABI 引入 main 的公共面~~  `DONE`（由 #329 提前完成）
- **原目标**：把公共面 `BLSAggregator.json` 从 4.1.0（70 函数）换成链上运行的 4.11.0（72 函数）。
- **实际状态**：**本 Task 在写下的时候就已经完成了，我没发现。** #329（`e4439dda`，本规划的 merge-base）改的正是这个文件。评审方 pr-daemon 指出，我复核确认：

  ```
  packages/core/src/abis/BLSAggregator.json vs scripts/repcredit/abis/BLSAggregator-4.11.0.deployed.json
    函数名集合 72 / 72，对称差 set()
    guardianSlashCases 存在，返回 7 字（4.11.0 形状）
    4.12.0 独有的四个未混入
  git log -1 -- packages/core/src/abis/BLSAggregator.json  →  e4439dda (#329)
  ```

- **为什么会写错**：我在合并 #329 **之前**读了一次 main，合并之后写规划时沿用那次读数。**自己改变了被测系统，然后引用改变之前的观测。**
- **留下的判据**（写进 `research.md` §2b）：断言「仓库现在是什么样」之前，先 `git log -1 -- <file>` 看那个文件最后一次是被谁改的。
- **对 F5.1 的影响**：范围缩小成**只做地址那一半**（T5.1.1），ABI 无需再动。`architecture.md` 边界 #6「公共面只增不减」保留——本轮不触发，下次同步仍适用。

### T5.1.3 SP 侧回归 + 证据回写  `PR_OPEN`
- **优先级**：high
- **目标**：证明 T5.1.1/T5.1.2 之后 SP 相关业务路径没坏，并把读数写进证据索引。
- **验收命令**：`pnpm -r build && pnpm -r test && pnpm run check:addresses && pnpm run check:abi-drift:strict`
- **依赖**：T5.1.1、T5.1.2
- **交付物**：`docs/onchain-evidence.md` 一条含 block 号的读数记录
- **证据**：PR #333。读数 @ block 11634683，三腿一致 + `pendingBLSAgg=0` + codehash 与 B4 冻结的 `deployedStack` pin 逐字一致。
- **一个本地环境陷阱（已记 FU-20）**：`check:abi-drift:strict` 在本地红、CI 绿。判据两条：本分支与 main **零代码差异**（红不可能由本 Feature 引入）；CI 最新 main run success，其中 `abi-provenance` job 正是跑这道 gate 的。真因是 `~/Dev/aastar/SuperPaymaster/out` 产物名带 profile 后缀（`<C>.default.json`），而 gate 找 `<C>.json`——`rm -rf out && forge build` 重建后仍如此，根 `foundry.toml` 与另一份产出无后缀名的 checkout 逐字相同。

---

## F5.2 — AirAccount v0.31.0 → v0.33.0

### T5.2.1 canonical 12 地址切到 v0.33.0  `PR_OPEN`
- **优先级**：high
- **目标**：上游 v0.33.0 已部署 Sepolia 并验活（`FACTORY_VERSION="0.33.0"` / `ACCOUNT_VERSION="0.33.0"` 链上实测），canonical 停在 v0.31.0。整栈切换。
- **开发范围**：`packages/core/src/addresses.ts` 的 AirAccount 12 地址；权威来源 = airaccount-contract `.env.sepolia` 的 `V0330` 块（精确值见 `spec.md`，**不得由截断地址补全**）。
- **明确不做**：不动 v0.31.0 的历史注释；不改 committee framing 逻辑（0.45.0 已修）。
- **依赖**：无
- **交付物**：12 地址 + 每个地址一条链上存在性/版本断言
- **验收命令**：`pnpm run check:addresses && pnpm exec vitest run packages/core/src/addresses.test.ts`
- **涉及文件**：`packages/core/src/addresses.ts`、`packages/core/src/addresses.test.ts`、`config.sepolia.json`
- **风险/回滚**：v0.31.0 栈仍在链上，现有账户不受影响（CC-106 明载）。切的是**新账户默认走哪一套**。
- **待人拍板**：无——上游已明确 v0.33.0 是新栈。
- **实际是 6 个键不是 5 个**：初稿漏了 `agentRegistry`（v0.31.0 `0x37fc74Ea…` → v0.33.0 `0x734625F6…`）。canonical 只跟踪 12 地址里的 9 个（`webAuthnLib`/`committeeBLSLib` 是链接库、不在册），其中 6 个变、3 个复用。
- **证据**：PR #332。12/12 有 code、`FACTORY_VERSION`/`ACCOUNT_VERSION` 均 `"0.33.0"`、`factory.implementation()` == impl、`router.getAlgorithm(0x01/0x08)` 指向两个 validator、`committeeActive()==true` —— 全部 @ block 11634556。归因变异：钉 stale v0.31.0 committee validator 时「validator is armed」**保持绿**（v0.31.0 那个也 armed，对陈旧零区分度），红的是离线六键检查与**边**检查。

### T5.2.2 committee framing 回归（v0.33.0 validator）  `PR_OPEN`
- **优先级**：high
- **目标**：v0.33.0 的 router `algorithm 1` 指向**新的** committee validator `0x7ac7E9d4…96a9`（v0.31.0 时是 `0x1A8Db639…`）。必须确认 SDK 的 per-signer 打包对新 validator 仍然成立——**读 `committeeActive()` 而不是猜**。
- **验收命令**：`pnpm exec vitest run packages/core/src/actions/committee.test.ts packages/core/src/abis/committeeAbi.test.ts`
- **依赖**：T5.2.1
- **风险**：`requireStake=true` 在新 validator 上已开启，且三个 operator 恰好卡在 `minStake`。属他仓风险，SDK 侧只需读、不改。
- **证据**：PR #334。编码器本就 validator-agnostic（`perSignerBytes` 从链读 `TREE_DEPTH` 推导），所以无需改代码——但「无需改」是对活合约的断言，只能靠读活合约来兑现。新增 `committee.onchain.test.ts` 5 条。
- **⚠️ 实测发现**：`requiredQuorum` 当前是 **fail-closed 哨兵** `type(uint256).max`（epoch 滚动后未 pin 上一轮快照）→ `quorumUsable=false`，**此刻提交 committee payload 必被拒**。属 DVT 侧运维状态，非 SDK 缺陷。我第一版断言 `quorumUsable === true`，15 分钟后在未改动的树上变红——那是在钉一个瞬时状态。改成断言 SDK 自己的推导关系（`quorumUsable === (requiredQuorum !== sentinel)`），时间无关且真承重。

---

## F5.3 — DVT 对齐核验

### T5.3.1 dvtValidator 与 DVT 接口对齐出证据  `READY`
- **优先级**：mid
- **目标**：~~疑似未变，待核~~ → **已核验无变更**（评审方顺手跑了一条，我复核确认）：

  ```
  aggregator(0xEaeC2F51…).DVT_VALIDATOR()  = 0x568b1486BFE036e603eA11f0D03Dc47fa62c9E0e   ← 证明 canonical 是现役
  DVTValidator(0x568b1486…).BLS_AGGREGATOR() = 0xEaeC2F51…2E5D                            ← 三腿之一
  block 11634451
  ```

  所以本 task 的剩余工作**不是去核**，而是**把这条读数变成门禁**——让它以后每次 CI 自动核，而不是靠某个人想起来跑一次。注意两条读数管的是不同的事：前者证明 `dvtValidator` 地址仍是现役，后者只是三腿之一。
- **验收命令**：`pnpm run check:addresses && pnpm exec vitest run packages/core/src/dvt.test.ts`
- **依赖**：T5.1.1（三腿断言里已含 DVTValidator 一腿）
- **交付物**：证据记录 + 若无变更则明确写「已核验无变更 @ block N」

---

## F5.4 — KMS 面扫描

### T5.4.1 KMS API surface 与安全加固对齐（CC-2 / CC-19 / CC-25）  `BLOCKED`
- **优先级**：mid
- **目标**：三条 KMS 变更通知从未处理。KMS 是 address-agnostic，风险在 API surface 与安全加固（fail-closed API key、XSS 修复）。
- **阻塞原因**：**需要先确定本地有没有 KMS 仓库 checkout 及其权威版本**；`upstream_radar` 记的 KMS 锚点需重新解析。这不是产品决策，是探测，`run` 时第一步就能解除。
- **验收命令**：（解除阻塞后补）`pnpm exec vitest run packages/core/src/kms/`
- **待澄清**：KMS 当前权威版本号 / 仓库位置
