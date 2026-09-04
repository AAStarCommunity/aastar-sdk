# research — M5 上游全面同步的立项依据

> 「为什么现在做这件事，依据是什么」。上层约束见本文件，往下：[`acceptance.md`](acceptance.md) → [`architecture.md`](architecture.md) + [`spec.md`](spec.md) → [`roadmap.md`](roadmap.md) → [`tasks.md`](tasks.md)。
> 建立日期：2026-09-04（SDK main = `e4439dda`，B4 PR #329 合并当日）

## 1. 问题陈述

SDK 的 canonical 地址簿与 vendored ABI 是**下游所有集成方的唯一事实来源**。它与链上真实部署之间目前存在四处漂移，而且**没有任何机制会在漂移发生时报警**——`check:addresses` 只校验 canonical 与 `config.*.json` 彼此一致，两边一起错它照样绿。

## 2. 实测缺口（2026-09-04，全部对链直读，非转述）

| 上游 | SDK canonical | 链上真值 | 性质 |
|---|---|---|---|
| SP `blsAggregator` | `0xF51c…8B13`（BLSAggregator-4.1.0） | `0xEaeC2F51…2E5D`（**4.11.0**），`Registry`/`SuperPaymaster`/`DVTValidator` 三腿一致 | **死地址** —— SP 已不认 |
| ~~SP `BLSAggregator` ABI~~ | ~~4.1.0 面，70 函数~~ | 4.11.0，72 函数 | ✅ **已由 #329 解决** —— 见下方勘误 |
| AirAccount 全栈 | v0.31.0 的 12 地址 | v0.33.0 已部署且验活 | 落后一版 |
| DVT `dvtValidator` | `0x568b1486…` | `aggregator.DVT_VALIDATOR()` == `0x568b1486…`（block 11634451） | ✅ 已核，无变更 |
| KMS | 未处理 CC-2 / CC-19 / CC-25 | — | 从未扫描 |

### 2b. 勘误（2026-09-04，评审方 pr-daemon 指出）

上表原有一行写「SDK 公共面 `BLSAggregator` ABI 是 4.1.0 的 70 函数、没有 `guardianSlashCases`」。**这条在本规划的 merge-base 上已经不成立**，实测：

```
packages/core/src/abis/BLSAggregator.json  vs  scripts/repcredit/abis/BLSAggregator-4.11.0.deployed.json
函数名集合:  72  72  对称差 set()          # 完全一致
guardianSlashCases: 存在，返回 7 字         # 4.11.0 形状
4.12.0 独有的四个: 未混入
```

**改它的正是 #329（`e4439dda`），也就是本规划的 merge-base。** 我在合并 #329 **之前**读了一次 main，合并之后写文档时沿用了那次读数，没有重读。

**根因值得记**：我自己改变了被测系统，然后引用改变之前的观测。判据 `git log -1 -- <file>` 一条命令就能戳穿——**凡是断言「仓库现在是什么样」，先看那个文件最后一次是被谁改的。**

由此 F5.1 的范围缩小：**ABI 那一半已完成，只剩地址那一半**（canonical `blsAggregator` 仍是 `0xF51c…8B13`，链上三腿均已是 `0xEaeC2F51…2E5D`，评审方独立复核确认）。

## 3. 为什么是现在

**方法已经验证过了。** B4（PR #329，4 轮评审，合并 `e4439dda`）在 evidence 分支上把这套东西跑通并证伪过：

- 「部署版 vs 源码版」双轴 pin —— 因为 SP 的 `contracts/src` 是 4.12.0 而链上是 4.11.0，且 4.11.0 是 4.12.0 的**严格子集**，72 个函数里 71 个行为相同，第 72 个 `guardianSlashCases` **selector 不变、返回字数变** → 不 revert，静默解错。
- 重定向而非豁免 —— 用 `KNOWN_DRIFT` 跳过会把 SDK 最要紧的 ABI 移出门禁，那是「豁免长得像覆盖」。
- 每道门禁配对红 —— 25→29 条检查，每条都有一个能让它变红的变异测试。

M5 = 把同一套方法从 evidence 分支推到 **main 的公共面**。不是发明新东西，是把已验证的模式逐个上游套用。

## 4. 已知会踩的坑（来自 B4 的实测，不是预感）

1. **截断地址不可补全**。我用 DSR 手册里的 `0xA97A7527…f897` 猜出一个全地址去查，链上 `code = 0x`。真值必须从上游 `.env.sepolia` / 部署记录取。
2. **上游工作区可能是脏的**。SP 与 airaccount-contract 的 checkout 都带未提交文件；凡是要归属到某个 revision 的读取，一律走 `git show <rev>:<path>`（git 对象），不读工作区。
3. **`git checkout <sha> -- <file>` 同时写索引**。做「换回旧实装看测试红不红」这类验证后，`cp` 还原只复原工作区 → 直接 `git add` 会把修复悄悄撤回而测试全绿。判据：还原后 `git diff` 与 `git diff --cached` **都**必须为空。
4. **计数会随量法浮动**。「路径含 X 的文件数」与「内容提到 X 的文件数」是两个数，都对。做存在性判断时优先用二值命令（`git cat-file -e`），它不受量法影响。

## 5. 不做什么

- 不碰 op-sepolia / op-mainnet 的旧 V3 栈 —— 那是 M3/F3.2，且阻塞在他仓的主网重部署。
- 不在 SDK 侧替上游做取舍（例：DVT 双轴 pin 该不该统一，是 DSR 的裁决，SDK 只陈述判据）。
- 不为了让门禁变绿而放宽门禁。

## 6. License / 边界

全部为本组织自有仓库（AAStarCommunity），无第三方 License 约束。跨仓协同经 Seeder（CC-xx），SDK 只交付自己那半。
