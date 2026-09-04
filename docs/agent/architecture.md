# architecture — M5 的技术骨架与不可破边界

> 依据 [`acceptance.md`](acceptance.md)；精确坐标见 [`spec.md`](spec.md)。
> 本文件写**约束**，不写步骤。无人值守时，凡是要越过下面任何一条边界的改动，一律标 `BLOCKED` 记问题，不擅自决定。

## 骨架：三层，各管各的

```
canonical 地址簿   packages/core/src/addresses.ts     ← 下游唯一事实来源
      ↕ check:addresses（两边一致，但两边可以一起错）
网络配置           config.{network}.json
      ↕ 三腿断言 + 链上回读（← M5 新增的这一层，才是「对不对」）
链上真实部署       Sepolia
```

**关键认识**：`check:addresses` 校验的是**内部自洽**，不是正确性。M5 补的是它下面那一层。

## 不可破边界

### #1 部署版 ABI ≠ 源码版 ABI，且不得互换

SP 的 `contracts/src` 是 BLSAggregator **4.12.0**；链上部署的是 **4.11.0**；合约不可升级，所以 4.12.0 在任何链上都不存在。

4.11.0 是 4.12.0 的**严格子集** —— 72 函数里 71 个行为相同。第 72 个：

```
guardianSlashCases(uint256)   selector 0xee02231c   两版相同
  4.11.0（链上）  7 字：bytes32,bytes32,uint64,uint8,uint16,uint16,address
  4.12.0（源码）  8 字：…,uint16 slashBps,address        ← #400 插入
```

**不 revert，静默解错。** 所以：

- 面向链的东西一律 pin **部署版**产物（`abis/BLSAggregator-4.11.0.deployed.json`）
- 源码轴（`contracts[].abiSha256`）与部署轴（`deployedStack`）**故意指向不同 commit**，仓内有测试断言两者不得相等
- 谁要把它们「整理成一致」，必须先说明 4.12.0 是不是已经上链了

### #2 重定向，不是豁免

需要 ABI 对照另一个参照物时，用**重定向**（换参照物、仍受门禁管辖），不用 `KNOWN_DRIFT` 跳过。跳过会把 SDK 最要紧的 ABI 移出门禁——那是「豁免长得像覆盖」。

重定向由 **pin 驱动**，不是硬编码常量：pin 没声明就不重定向（合成测试环境因此不受影响），pin 声明了而产物缺失是**硬失败**，绝不静默回落到源码版产物。

### #3 归属只认 git 对象，不认工作区

上游 checkout 可能带无关的未提交文件。任何「这个产物属于哪个 revision」的判断，一律 `git show <rev>:<path>`。读工作区 = 让别人的在途编辑决定你的哈希算在什么上面。

### #4 fail closed，"读不到" 不等于 "通过"

- RPC 不可达 → gate **失败**，不是静默通过（`REPCREDIT_REQUIRE_ONCHAIN=1` 的用意）
- 上游产物缺失 → 失败，不是 skip
- 一个门禁若在它声称要防的情形下红不起来，它就不算存在

### #5 每道门禁必须有配对红

新增任何断言，同一个 PR 里必须有一个变异让它变红，**并且验证过红是归因到这个断言的**：换回旧实装后，新测试红 + 已知不承重的红要排除 + 相邻同名测试仍绿。三行合起来才是证据。

### #6 公共面只增不减

canonical 地址与 ABI 是下游的事实来源。函数集变化必须是**新增**；若某次同步会让函数消失，停下标 `BLOCKED`——那是 breaking，需要人决定发版策略。

## 门禁清单（M5 结束时应当全部在 CI 里）

| 门禁 | 管什么 | 现状 |
|---|---|---|
| `check:addresses` | canonical ↔ config 自洽 | 已在 CI |
| `check:abi-drift:strict` | vendored ABI ↔ 上游具名 revision | 已在 CI（abi-provenance job） |
| `check:deployed-stack` | pin ↔ **链上** | B4 已建，evidence 分支在 CI；**M5 要推到 main** |
| 三腿断言 | 三个指针彼此一致 | **T5.1.1 新建** |
| `check:browser` / `check:stubs` | 浏览器安全 / 静默桩 | 已在 CI |

## 风险登记

| 风险 | 触发条件 | 处置 |
|---|---|---|
| 公共面 ABI 70→72 | T5.1.2 合并 | 只增不减（已实测），release note 标注 |
| v0.33.0 新 committee validator `requireStake=true` 且三 operator 卡在 minStake | 他仓罚没/退出 | SDK 只读不改；已报 CC-115 |
| 上游又前进（如 4.12.0 上链） | 随时 | 双轴设计已容纳；`sourceRevision != abi.revision` 断言会提示复审 |
