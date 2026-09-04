# acceptance — M5 从用户视角「算不算做好了」

> 依据 [`research.md`](research.md)。这里只写**验收**，不写实现。每条都必须能由一条命令或一次链上读数判定。

## 谁是用户

| 用户 | 他们碰到的东西 | 漂移对他们意味着什么 |
|---|---|---|
| 集成方（YAAA/Cos72、社区 dApp） | `@aastar/sdk` 的 canonical 地址 + ABI | 按 SDK 编码 → 打到 SP 已不认的合约上；或解码进错字段 |
| DSR（论文） | evidence 分支的 pin | 论文引用的栈与实测栈不是同一个 |
| 本仓自己 | CI 门禁 | 门禁绿 ≠ 一致，漂移无人报警 |

## 验收条件（全部机器可判）

### A. 一致性 —— canonical 就是链上那个

- [ ] `pnpm run check:addresses` 绿（canonical ↔ `config.*.json`）
- [ ] **新增**：三腿断言绿 —— `Registry.blsAggregator` == `SuperPaymaster.BLS_AGGREGATOR` == `DVTValidator.BLS_AGGREGATOR` == canonical `blsAggregator`
- [ ] AirAccount 12 地址逐个链上存在，且 `FACTORY_VERSION`/`ACCOUNT_VERSION` == `0.33.0`
- [ ] `pnpm run check:abi-drift:strict` 绿且**归属到具名 revision**（输出里有 `Attributed to committed upstream revision(s): …`）

### B. 可证伪 —— 绿是挣来的

- [ ] 每道新门禁都有**配对红**：改一个 pin 值 → 对应那条检查变红（不是整体 exit code 变红）
- [ ] `guardianSlashCases` 形状门禁双向成立：7 字解得开、8 字报错
- [ ] 变异测试与实装分离验证过：把实装换回旧版，**新测试红、相邻测试仍绿**

### C. 不回归 —— 没把好的弄坏

- [ ] `pnpm -r build && pnpm -r test` 全绿
- [ ] `pnpm run check:browser` 绿（浏览器子路径不得静态引入 node 内置）
- [ ] `pnpm run check:stubs` 绿
- [ ] 公共面若有 breaking（如 ABI 函数集变化），在 PR 描述中显式列出，且**无函数消失**（只增不减）

### D. 留痕 —— 下一个人能复核

- [ ] 每次链上读数写进 `docs/onchain-evidence.md`，带 **block 号**
- [ ] 每个 PR 经 pr-daemon 审**最新 SHA** + required checks 全绿后才合并
- [ ] `docs/agent/{tasks,progress}.md` 与仓库真实状态一致

## 明确不在验收范围

- 主网（op-mainnet）—— 阻塞在他仓 V5 全栈重部署，M3/F3.2 跟踪
- DVT 双轴 pin 的最终裁决 —— DSR 的产品决策，SDK 只提供判据
- KMS 的服务端行为 —— SDK 只验自己这半的 API surface

## 「做好了」的一句话版

> 任何人在任意时刻跑 `pnpm run check:addresses && pnpm run check:abi-drift:strict`，绿就代表 SDK 的地址簿与 ABI **此刻**与链上一致；而且如果哪天不一致了，这条命令会红——不需要有人记得去读链。
