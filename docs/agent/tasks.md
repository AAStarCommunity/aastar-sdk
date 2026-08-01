# AAStar SDK 任务台账 — Task

> 前置：[`roadmap.md`](roadmap.md)（M→F）。此刻状态见 [`progress.md`](progress.md)，跟进项见 [`followups.md`](followups.md)。
> 每个 Task 自包含，可独立开发与验收。**验收标准必须可机器验证**（跑命令能判定）。
> 状态：`BACKLOG` · `READY` · `IN_PROGRESS` · `BLOCKED` · `PR_OPEN` · `CHANGES_REQUESTED` · `APPROVED` · `DONE`

---

## F1.1 — DVT 上链注册证据

### T1.1.1 dvt3 独立节点上链注册 evidence 脚本  `PR_OPEN`
- **优先级**：high
- **目标**：把 dvt3（board B，EIP-2335 keystore）在 Sepolia 完成 stake + `registerWithProof` 的一次性脚本沉淀进版本库，让这条路径可复跑、可复核。
- **开发范围**：`tests/regression/onchain-evidence/dvt3-register.ts` —— 解密 keystore（仅内存）→ 校验 pubkey/nodeId 与 board `node_state.json` 一致 → `onboardDvtNode` dryRun 断言 nodeId 一致 → 真实上链 → 独立 re-read 复验 `isRegistered` / `nodeOperator`。
- **明确不做**：不把 keystore、passphrase、operator 私钥写进仓库（全部走 env）；不改 `onboardDvtNode` 本身。
- **依赖**：无（`buildDvtPop` + `dvtOperatorActions` 已随 PR #288 落地）
- **交付物**：evidence 脚本 + 一次成功的 register tx hash
- **验收命令**：`DRY_ONLY=1 pnpm exec tsx tests/regression/onchain-evidence/dvt3-register.ts`（需 board 侧 env；无 env 时至少 `pnpm exec tsc --noEmit` 通过）
- **涉及文件**：`tests/regression/onchain-evidence/dvt3-register.ts`
- **风险/回滚**：真实上链且 JASON 代付 ETH+GToken —— **默认必须先 `DRY_ONLY=1` 跑一遍**，nodeId 与板子 `node_state.json` 不一致时脚本自身 abort。
- **证据**：branch `test/dvt3-onchain-register-evidence` / PR #316

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

### T3.1.1 把四道 sync gate 固化进 CI  `READY`
- **优先级**：high
- **目标**：`abi:sync` / `check:abi` / `check:abi-drift` / `check:addresses` 四道（2026-08-01 实测均 PASS）进 CI 硬门禁，防止再次悄悄变红。
- **开发范围**：CI workflow；`check:browser` 已是硬门禁，本任务补齐另外四道。
- **明确不做**：不改门禁脚本自身逻辑。
- **依赖**：无
- **验收命令**：`pnpm run abi:sync && pnpm run check:abi && pnpm run check:abi-drift && pnpm run check:addresses`（本地四连绿）+ CI 上同样四步存在
- **涉及文件**：`.github/workflows/*`

---

## F4.1 — pilot 规划层

### T4.1.1 建立 .pilot.yml + docs/agent 规划层  `PR_OPEN`
- **优先级**：high
- **目标**：让 pilot 能接管本仓库的持续开发：配置、三级规划文档、跟进账本齐备。
- **交付物**：`.pilot.yml`、`docs/agent/{roadmap,tasks,progress,followups}.md`、`.gitignore` 忽略 `.codegraph/`
- **验收命令**：`test -f .pilot.yml && test -f docs/agent/tasks.md && bash ~/.claude/skills/pilot/scripts/followups.sh count-open --docs-dir docs/agent`
- **证据**：branch `chore/pilot-scaffold` / PR #315
