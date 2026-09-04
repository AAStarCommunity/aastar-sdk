# AAStar SDK Roadmap — Milestone → Feature

> 「未来要做什么」。具体怎么做 + 验收见 [`tasks.md`](tasks.md)；此刻真实状态见 [`progress.md`](progress.md)。
> 编号：M<里程碑> → F<里程碑>.<序号>。建立日期：2026-08-01（SDK v0.43.0）
>
> 本文件是 **pilot 的运行态规划层**，不取代既有的长文档，而是把它们收敛成可执行的 M→F→T：
> - 产品路线：[`../BETA-ROADMAP.md`](../BETA-ROADMAP.md)
> - 主网就绪盘点：[`../PRODUCTION_READINESS.md`](../PRODUCTION_READINESS.md)
> - 发布纪律：[`../RELEASE-CHECKLIST.md`](../RELEASE-CHECKLIST.md)
> - 上链证据索引：[`../onchain-evidence.md`](../onchain-evidence.md)
>
> 跨仓协同任务（CC-xx）活在 Seeder 协同中枢；本 roadmap 只收 **SDK 自己的交付物**。

## M1 — DVT 节点上链交付（对应 CC-17）
目标：社区节点从「本地能算 PoP」推进到「链上注册成功 + 可被独立复验」，并把注册路径从临时脚本收敛成产品化入口。

- **F1.1 上链注册证据** — 独立节点（board B / dvt3）在 Sepolia 完成 stake + `registerWithProof`，产出可复跑的 evidence 脚本与 tx hash
- **F1.2 节点 onboarding API** — `onboardDvtNode` 之上的 SDK API 层，取代一次性 CLI/mjs 脚本（脚本是引擎，不是交付物）
- **F1.3 portal UI 半边** — 对接 `https://kms.aastar.io/portal` 的社区节点接入界面（SDK 负责 API + UI 半边）

## M2 — BLS Slash 治理 API（对应 CC-13）
目标：把链上 slash 治理从「合约有函数」变成「SDK 有可用 API」，写路径经 Timelock 编排（已确认走 Timelock，不走 Safe）。

- **F2.1 批A — read getters** — slash 状态/冷却/阈值等只读查询（依赖已随 0.39.4 ABI 刷新解除）
- **F2.2 批B — 写编排** — calldata 构造 + OZ `TimelockController` 包装（需先把 TimelockController ABI 纳入 `@aastar/core`）

## M3 — 生产就绪与主网（对应 CC-30）
目标：SDK 在 anvil / testnet / mainnet 三环境行为一致，并明确主网真正的阻塞点归属。

- **F3.1 四道同步门禁常绿** — `abi:sync` / `check:abi` / `check:abi-drift` / `check:addresses` 全绿并进 CI（2026-08-01 实测四道均已 PASS，需固化防回归）
- **F3.2 主网阻塞跟踪** — 链上 SuperPaymaster 3.2.2（旧 V3）与 SDK 对齐的 5.4.2 不兼容 → 主网需 V5 全栈重部署；**这是他仓的事，SDK 侧只跟踪与适配，不阻塞自己的交付**
- **F3.3 三环境回归** — 业务场景全量回归（正向 + 负向）在 anvil / sepolia / op-sepolia 可跑通

## M4 — 仓库运维基线
目标：让这个仓库具备无人值守持续开发的条件，且状态永远与文档一致。

- **F4.1 pilot 规划层** — `.pilot.yml` + `docs/agent/`（roadmap / tasks / progress / followups）
- **F4.2 分支与 PR 卫生** — 已合并分支定期清理、PR 有 daemon 评审回执、跟进账本不积压

## M5 — 上游全面同步（SP / AirAccount / DVT / KMS）
目标：让 SDK 的 **canonical 地址簿与 ABI** 与四个上游的**链上真实部署**一致，并把「一致」变成一道每次 CI 都跑、且能红的门禁——而不是一次性对齐后继续漂。

立项依据与实测缺口见 [`research.md`](research.md)；不可破的技术边界见 [`architecture.md`](architecture.md)；精确坐标见 [`spec.md`](spec.md)。

- **F5.1 SP 栈地址与 ABI**（先做，风险最高）— canonical `blsAggregator` 仍是 `0xF51c…8B13`(4.1.0)，而 `Registry`/`SuperPaymaster`/`DVTValidator` 三腿链上均已指向 `0xEaeC2F51…2E5D`(**4.11.0**)。SDK 公共面的 `BLSAggregator` ABI 连 `guardianSlashCases` 都没有。
- **F5.2 AirAccount v0.31.0 → v0.33.0** — 上游又出新栈并已部署 Sepolia（`FACTORY_VERSION="0.33.0"` 链上实测），canonical 停在 v0.31.0 的 12 地址（CC-106 当时确已逐字段一致，这不是欠账，是上游前进了）。
- **F5.3 DVT 对齐核验** — `dvtValidator` 疑似未变（`0x568b1486…`），但必须出**证据**而不是假设；顺带把 DVT 侧 ABI/节点接口纳入同一套门禁。
- **F5.4 KMS 面扫描** — CC-2 / CC-19 / CC-25 三条变更通知从未处理；KMS 是 address-agnostic，风险在 **API surface 与安全加固**（fail-closed API key、XSS 修复）而非地址。

**为什么现在做**：B4（PR #329，已合并 `e4439dda`）在 evidence 分支上把「部署版 vs 源码版」的双轴 pin 与可证伪门禁跑通了。M5 是把同一套方法从 evidence 分支推到 **main 的公共面**——模式已验证，剩下的是逐个上游套用。

---

> 当前聚焦：**M5**（上游全面同步，F5.1 → F5.4 顺序执行）。
> M1 / F1.1（DVT 上链证据）与 M4 / F4.1（pilot 规划层）已建立，M2 / M3 待 M5 收口后重排。
> 每个 Feature 的 Task 拆分与状态见 [`tasks.md`](tasks.md)。
