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

### T1.2.1 盘点 CLI/mjs 脚本 → API 的缺口 (PR #361)  `DONE`
- **优先级**：high
- **目标**：明确 `register-node.mjs` / `dvt3-register.ts` 里哪些步骤还没有对应的 SDK API，产出缺口清单（社区节点接入的真正交付物是 API + portal，不是脚本）。
- **开发范围**：只做盘点与设计，不写实现。
- **明确不做**：不动 portal UI。
- **依赖**：T1.1.1（先有一条跑通的真实路径再抽象）
- **交付物**：[`docs/agent/node-onboarding-api-gap.md`](node-onboarding-api-gap.md)
- **验收命令**：
  ```bash
  awk '/^\| G[0-9]+ \|/{n++; if (/\| (已有 API|需新增) \|$/) ok++} \
       END{printf "rows=%d labelled=%d\n",n,ok; exit (n>0 && n==ok)?0:1}' \
    docs/agent/node-onboarding-api-gap.md
  ```
  实测 `rows=21 labelled=21` rc=0；把任一条判定改成表外词（如 `待定`）→ `labelled=20` rc=1，
  所以它是能红的，不是恒真。
- **结论**：21 个能力步骤，**已有 API 13 / 需新增 8**。`register-node.mjs` 在两个仓库里各有一份且
  内容不同（DVT 侧 285 行、AirAccount 侧 107 行），三份全盘了。
- **顺带核实（跨仓，不在本 task 修；读 `AirAccount` @ `4de82e4`）**：两个文件做的事不同——
  `setup-server.py:155-157` 是真正的硬 pin，三个常量里 gToken/staking 逐字等于 canonical、
  **只有 validator 那条是已被取代的 `0x539B9681…`**；`register-node.mjs` 完整地址命中 **0 个**，
  它是 fail-closed（缺 `VALIDATOR_ADDRESS` 就 die），错的是它 die 信息里那句假事实
  「SDK canonical `aaStarBLSAlgorithm=0x0` 会失配」——canonical 实为活的 `0x7ac7E9d4…`。
  两个 validator 都有代码、都对我们的节点答 `isRegistered=true`，所以填错了在链上看不出来。

### T1.2.2 节点 onboarding API 实现  `BACKLOG`
- **优先级**：high
- **依赖**：T1.2.1
- **验收命令**：缺口清单里 8 条「需新增」（G1/G4/G5/G6/G11/G12/G14/G21）逐条有实现，或有记录
  在案的「决定不做」。
- **⏳ 进入实现前需 jason 拍板三条**（见清单 §需新增的 8 条）：
  - **G5** keystore 解密放哪个包——core 明确是 browser-safe（`no node:crypto`），解密进不来
  - **G11** portal 要不要支持上传加密 keystore（SDK 是 viem-only，不能照抄 ethers 那条实现）
  - **G21** bootstrap 注册路径（`requireStake==false` → `registerPublicKey`）是补齐还是明确不支持

---

## F2.1 — Slash 治理 read getters（CC-13 批A）

### T2.1.1 slash 只读查询 API  `PR_OPEN`
- **优先级**：mid
- **目标**：暴露 slash 状态/冷却/阈值等只读能力（`isSlashPending` 等已随 0.39.4 进 ABI）。
- **依赖**：无（地址依赖已由 CC-18 / 0.39.4 解除）
- **验收命令**：新增单测 `pnpm --filter @aastar/core test` 全绿 + 一条 Sepolia 实读证据
  - 实测：`617 passed | 34 skipped`（60 文件）✅
  - 链上：`AASTAR_ONCHAIN_TEST=1 pnpm exec vitest run packages/core/src/actions/aggregator.guardianSlash.onchain.test.ts` → 7/7 ✅
- **盘点结论**：SuperPaymaster 侧的 slash 只读面（`isSlashPending`/`getLatestSlash`/`getSlashCount`/
  `getSlashHistory`/`slashHistory`）与 aggregator 的 `slashPolicyAdmin`/`slashThresholds`
  **本来就已经有了**。真正缺的是 **guardian slash + 退出冷却**那一族，共 10 个 view，全部补齐。
- **本 task 的硬骨头**：`guardianSlashCases(uint256)` 的形状陷阱。链上 4.11.0 是 7 字、SP src 4.12.0
  是 8 字，**selector 不变**（`0xee02231c`），viem 拿 7 参 ABI 解更长的返回**不 revert**。所以这个
  getter 不走 `readContract`，改裸 `call` + 两道守卫：
  - **长度 === 224** —— 管「加字段」。链上实测锚定。
  - **`verifier` 字高 12 字节为 0** —— 管「同宽换字段/错位」。长度看不见这一类。
  - 新错误码 `ErrorCode.ABI_SHAPE_MISMATCH (E4004)`：链答了、但答案不可信，是唯一一类
    「继续走下去会产出貌似合理的错值」的失败，调用方必须能与 revert 区分且不得重试。
- **⚠️ 证据分三层，别读成「已验证」**：① 宽度 224 = 链上实测；② 字段序 = 锚在
  `BLSAggregator-4.11.0.deployed.json`（该文件已 70/70 selector 对上部署字节码），链上无法再佐证，
  因为 **selector 不编码 outputs**；③ **这两道运行时守卫今天是睡着的**——链上一个 case 都没排过队，
  全 0 返回下零地址本来就是合法零填充，两道守卫都区分不出对错。现在真正在干活的是单测里那组
  手铺哨兵 fixture，它钉的是「解码器 ↔ ABI 文件」这一环。第一个真 case 排队时守卫才醒。

### T2.1.2 Timelock 写编排（批B）  `BLOCKED`
- **优先级**：mid
- **阻塞原因**：`@aastar/core` 尚未纳入 OZ `TimelockController` ABI；且 slash 治理的 proposer/executor 角色归属需业务确认。
- **依赖**：T2.1.1

---

## F3.1 — 四道同步门禁常绿

### T3.1.1 把 sync gate 固化进 CI（范围经实测修正）  `DONE`
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
- **证据**：sync gate 已在 `ci.yml` 里（`check:addresses` / `check:abi-drift:strict` 均为独立 step，`abi-provenance` job 自建上游后跑 strict）。原条目标 `PR_OPEN` 而正文写「PR 待建」——两者自相矛盾，T5.4.3 对账时按 GitHub/仓库实况改正为 DONE。

---

## F4.1 — pilot 规划层

### T4.1.1 建立 .pilot.yml + docs/agent 规划层 (PR #315)  `DONE`
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

### T5.1.3 SP 侧回归 + 证据回写 (PR #333)  `DONE`
- **优先级**：high
- **目标**：证明 T5.1.1/T5.1.2 之后 SP 相关业务路径没坏，并把读数写进证据索引。
- **验收命令**：`pnpm -r build && pnpm -r test && pnpm run check:addresses && pnpm run check:abi-drift:strict`
- **依赖**：T5.1.1、T5.1.2
- **交付物**：`docs/onchain-evidence.md` 一条含 block 号的读数记录
- **证据**：PR #333。读数 @ block 11634683，三腿一致 + `pendingBLSAgg=0` + codehash 与 B4 冻结的 `deployedStack` pin 逐字一致。
- **一个本地环境陷阱（已记 FU-20）**：`check:abi-drift:strict` 在本地红、CI 绿。判据两条：本分支与 main **零代码差异**（红不可能由本 Feature 引入）；CI 最新 main run success，其中 `abi-provenance` job 正是跑这道 gate 的。真因是 `~/Dev/aastar/SuperPaymaster/out` 产物名带 profile 后缀（`<C>.default.json`），而 gate 找 `<C>.json`——`rm -rf out && forge build` 重建后仍如此，根 `foundry.toml` 与另一份产出无后缀名的 checkout 逐字相同。

---

## F5.2 — AirAccount v0.31.0 → v0.33.0

### T5.2.1 canonical 12 地址切到 v0.33.0 (PR #332)  `DONE`
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

### T5.2.2 committee framing 回归（v0.33.0 validator） (PR #334)  `DONE`
- **优先级**：high
- **目标**：v0.33.0 的 router `algorithm 1` 指向**新的** committee validator `0x7ac7E9d4…96a9`（v0.31.0 时是 `0x1A8Db639…`）。必须确认 SDK 的 per-signer 打包对新 validator 仍然成立——**读 `committeeActive()` 而不是猜**。
- **验收命令**：`pnpm exec vitest run packages/core/src/actions/committee.test.ts packages/core/src/abis/committeeAbi.test.ts`
- **依赖**：T5.2.1
- **风险**：`requireStake=true` 在新 validator 上已开启，且三个 operator 恰好卡在 `minStake`。属他仓风险，SDK 侧只需读、不改。
- **证据**：PR #334。编码器本就 validator-agnostic（`perSignerBytes` 从链读 `TREE_DEPTH` 推导），所以无需改代码——但「无需改」是对活合约的断言，只能靠读活合约来兑现。新增 `committee.onchain.test.ts` 5 条。
- **⚠️ 观测到过（非常态）**：`requiredQuorum` 在 2026-09-04 某次采样是 **fail-closed 哨兵** `type(uint256).max` → `quorumUsable=false`；评审方在 block 11634795 采样则读到 **2**。**这个值随 epoch 摆**，所以任何「当前是 X」的写法被读到时多半已经是假的——正确的说法是「观测到过」加采样点。属 DVT 侧运维状态，非 SDK 缺陷。我第一版断言 `quorumUsable === true`，15 分钟后在未改动的树上变红——那是在钉一个瞬时状态。改成断言 SDK 自己的推导关系（`quorumUsable === (requiredQuorum !== sentinel)`），时间无关且真承重。

---

## F5.3 — DVT 对齐核验

### T5.3.1 dvtValidator 与 DVT 接口对齐出证据 (PR #335)  `DONE`
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
- **证据**：PR #335。交付的不是「又核了一次」，是**把它变成门禁**——`addresses.dvt.test.ts` 三条。
- **设计要点**：三腿测试只覆盖 DVT→aggregator 方向；反向（aggregator 认不认 canonical 的 dvtValidator）此前无断言。而单读 pin 的聚合器零区分度（三个聚合器返回同值），所以必须**从 Registry 起链**：`Registry.blsAggregator()` → 那个聚合器的 `DVT_VALIDATOR()` → 必须等于 canonical。第一跳确立「哪个是现役」，第二跳才有意义。
- **一条自我记录的测试**：显式断言「捷径版本对被取代的聚合器也会通过」——它不是在测 SDK，是在**测这个测试本身的设计**，让未来想「简化掉第一跳」的人看见代价。

---

## F5.4 — KMS 面扫描

### T5.4.1 KMS 探测：定位仓库与接口面 (PR #336)  `DONE`
- **优先级**：mid
- **目标**：解除原 T5.4.1 的阻塞——原任务标 BLOCKED 的理由是「不知道 KMS 仓库在哪、权威版本是什么」。那是**探测不是产品决策**，本 task 就做这一件事。
- **探测结果**（2026-09-05）：
  - **服务端仓** = `~/Dev/aastar/AirAccount`（airaccount-node），本机 HEAD `4de82e4`，最新 tag **`airaccount-node-v0.30.0-beta.1`**
  - **SDK 侧客户端面** = `packages/airaccount/src/server/services/kms-*.ts` —— **6 个文件、2165 行、37 个不同端点路径**
  - **⚠️ 版本落差**：`kms-http-client.ts:6` 的注释写 `v0.20.0 (Beta2)`，而服务端已到 v0.30.0-beta.1。注释是否等于实际接口面**未验证**。
  - CC-2(v0.26.1) / CC-19(v0.26.1→v0.27.4) / CC-25(v0.28.0) 三条通知的目标版本**全部已被 v0.30.0-beta.1 取代**，所以不能照着那三条逐条对——要对的是**当前**服务端。
- **为什么拆**：37 个端点 / 2165 行，一个 PR 做不完也审不动。硬塞会做成半吊子。
- **交付物**：本条台账记录 + T5.4.2 / T5.4.3 的拆分
- **验收命令**：`test -d ~/Dev/aastar/AirAccount && ls packages/airaccount/src/server/services/kms-*.ts | wc -l`

### T5.4.2 KMS 端点面对账（37 条 vs 服务端当前路由） (PR #337)  `DONE`
- **优先级**：mid
- **目标**：把 SDK 打的 37 个端点逐条对上服务端 v0.30.0-beta.1 的实际路由，产出「仍存在 / 已改名 / 已移除 / 服务端新增但 SDK 未用」四类清单。
- **明确不做**：不改客户端实现；只出对账结果与证据。每类差异各自成为独立 task。
- **依赖**：T5.4.1
- **验收命令**：对账脚本退出码 + 四类清单齐全
- **风险**：服务端是 Rust/TEE 栈，路由可能不在 TS 里。抓不到权威路由表就标 BLOCKED 说明缺什么，**不猜**。

### T5.4.3 CC-19 安全加固在 SDK 侧的对应面 (PR #338)  `DONE`
- **优先级**：mid
- **目标**：CC-19 是 fail-closed API key + XSS 修复。确认 SDK 客户端在 API key 缺失/无效时 fail-closed（不是静默降级），并给出配对红。
- **依赖**：T5.4.1
- **验收命令**：`pnpm exec vitest run packages/airaccount/src/server/__tests__/kms-*.test.ts`
- **结论**：`enabled` 是 fail-closed（`ensureEnabled()` 抛），**但 `apiKey` 完全没有门**——`kmsEnabled: true` 且 key 缺失时客户端不带 `x-api-key` 就发请求，`enabled` 仍报 `true`。所有真实调用都传 `process.env.KMS_API_KEY`，所以「忘了设环境变量」会产出一个**看起来配好了**的客户端，错误延后到服务端、表现得和吊销密钥/端点写错一模一样。
- **⏳ 待拍板（未擅自改行为，FU-24）**：要不要让 key 必填？那是**会破坏现有部署**的行为变更（本地 TEE 模拟器 / 测试夹具 / 自带网络层认证的内网端点都可能无 key），属产品决策。本 task 只写表征测试固化现状：将来谁改成必填，这些测试会红，**逼那次变更是有意识的**。
