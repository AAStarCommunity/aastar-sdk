# CC-128 / AOA-SDK-01 — SDK 侧证据包

> 工作单：AOA-SDK-01（Seeder CC-128，from:dsr）· 映射 AOA M1.5 / M3.6 / M4.2
> 基线：aastar-sdk `main` @ `dbb3c47f`（`@aastar/sdk` 0.46.0-rc.2，viem 2.43.3）
> Execution：**全程只读**。只用 `eth_getTransactionReceipt` / `eth_getTransactionByHash` / `eth_call`，无签名、无广播。
> 本文件是交付方报告；DSR 独立验收才推进对应 M 任务。

## 交付一（M1.5）— 对 SP #418 / CC-125 的 ACK

**ACK**：SDK 接受 SP #418 的建议，并按 DSR 的措辞记录：在 EIP-8037 链上把 `handleOps` 交易的 `gasLimit` 控制在 16,777,216（2^24）以内，是一条**建议边界**——
它消除 reservoir 造成的 under-reimbursement 那一项，但**不是 PVG 足额补偿的必要条件，也不是充分条件**，更不是协议强制。PVG 和费用仍需各自核对。

### SDK 里谁构造 `handleOps` 交易

| 路径 | 位置 | 谁决定 tx `gasLimit` | 是否 ≤ 2^24 有保证 |
|---|---|---|---|
| 主路径：`eth_sendUserOperation` 交给托管 bundler | `packages/paymaster/src/V4/PaymasterClient.ts`（`submitGaslessUserOperation`，bundler 类型由 `detectBundlerType(bundlerUrl)` 判定，`:502`） | **bundler**（SDK 只控制 UserOp 内的 gas 字段，控制不了 bundle tx） | SDK 侧不可控，取决于 bundler 实现与配置 |
| 回退：bundler 报 `Method not found` 时直接调 `handleOps` | `packages/paymaster/src/V4/PaymasterClient.ts:636-648` | viem `writeContract` 未传 `gas` → 取 `eth_estimateGas` 结果 | **否**，无上限检查 |
| `EndUserClient.executeGasless` 自打包 | `packages/sdk/src/clients/endUser.ts:203`（提交在 `:313-343`） | 同上，未传 `gas` → 取估算值 | **否**，无上限检查 |

**未覆盖项（如实报告，不在本单内改）**：两条自打包路径都没有 2^24 上限，也没有「估算值超过上限就拒发」的检查。单个 op 的估算值通常远低于 2^24（历史数据实测见下），但这只是读数，不是保证。若需要，SDK 可加一个可选的 `maxBundleGas`，超限时 fail-closed。这需要 DSR 或作者决定是否列入，SDK 不擅自加为默认行为。

另：`PaymasterClient.ts:642` 用 viem 的 `parseAbi` 现场拼了 `handleOps` 的 ABI，违反本仓「ABI 只来自 `@aastar/core`」的约定。这与 #418 无关，记作本仓清理项。

### 版本与配置来源

| 项 | 值 | 来源 |
|---|---|---|
| SDK | `@aastar/sdk` 0.46.0-rc.2（npm `rc`）；`latest` = 0.45.0 | `packages/sdk/package.json` |
| viem | 2.43.3 | `packages/core/package.json` |
| EntryPoint | v0.7 `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | `@aastar/core` 地址簿；历史 14 笔 receipt 的 `to` 逐笔一致 |
| SuperPaymaster ABI | 5.4.2（`packages/core/src/abis/SuperPaymaster.json`） | 链上 Sepolia 现役 5.4.2；**5.5.0 未部署**，SDK 适配在独立分支（CC-122 R2），不切地址 |
| 地址 | `packages/core/src/addresses.ts` `CANONICAL_ADDRESSES[11155111].superPaymaster` = `0x09DF…4DE9`（代理） | `check:addresses` 门禁 |
| bundler | 运行时由调用方传入 `bundlerUrl`；回归和 L4 测试用 `tests/regression/config.ts:181`（`process.env.BUNDLER_URL`）。当前 `.env.sepolia` 的 `BUNDLER_URL` 主机为 Alchemy（`eth-sepolia.g.alchemy.com`） | `.env.sepolia` 是**未入库的秘密文件**：只报主机名；2026-01 采集当时的值**无法核实** |
| bundler 版本 | **未知**：托管服务不暴露版本 | — |

## 交付二（M3.6）— 历史 analytics 数据的来源

### 文件身份

| 文件 | SHA256 | 入库 commit |
|---|---|---|
| `packages/analytics/data/complete_dataset.csv` | `4d26c0edc251f8fb20446ae253342e09dc023250bdbf838275a154001d035f24` | `af87017d`（2026-01-19） |
| `packages/analytics/data/attribution_dataset.csv` | `83f5559f9755cfab550ddabdf1d0cc677aa6ebe1898098cfc03c535f54daad44` | `af87017d`（2026-01-19） |

### 实测读数（可用 `scripts/cc128/rebuild-tx-userop-map.sh` 重放）

1. **重复**：两份文件各有 28 条数据行，各含 14 个不同的 `txHash`，**每个恰好出现 2 次，且两次逐字节相同**。两份文件的 tx 集合相同。与 DSR 的盘点一致。
2. **tx 与 UserOp 的对应**：14 笔 tx 全部在 Sepolia（chainId 11155111）上，`to` 都是 EntryPoint v0.7，**每笔恰好有 1 个 `UserOperationEvent`**，14 个 `userOpHash` 互不相同，`success` 全部为 1。
   所以**仅在这个集合上**，按 tx 去重等价于按 UserOp 去重。这是对这 14 笔的实测，不是一般规律。DSR 在别处不应把 tx 去重当作 UserOp 去重。
   → `tx_userop_map.csv`
3. **`gasUsed` 列的口径**：CSV 里的 `gasUsed` 与 receipt 的 **tx 级 `gasUsed` 14/14 相等**，与 UOE 的 `actualGasUsed` **14/14 不相等**（UOE 值更大，因为含 PVG 等计费项）。这一列是 tx gas，不是 UserOp 计费 gas。
4. **paymaster 身份**（在每笔 op 所在区块读 `version()`）：
   - `testType=Anni Gasless` / `mode=super` 的 5 笔 → `SuperPaymaster-3.2.2`，分布在**3 个不同实例**（`0xc459…`×3、`0x61dd…`、`0xe743…`）；
   - `testType=Jason AA2 Gasless` / `mode=v4` 的 9 笔 → `PMV4-Deposit-4.3.0`，分布在 **4 个不同实例**（`0xda66…`×6、`0x3f95…`、`0xbef8…`、`0xffab…`）。
   → `pm_version_at_block.csv`
   **含义：这批历史数据测的是旧 V3 机制（SP 3.2.2）和 PaymasterV4，不是 5.5.0 balance mode。** 按 AOA 计划 M3.6，只能作为历史背景，不能混进新的受控样本。
5. **提交方**：14 笔 tx 由 **8 个不同的 EOA** 提交，都不是账户 owner，selector 全部是 `handleOps`（`0x765e827f`），符合托管 bundler 执行地址池的特征。具体是哪家 bundler 无法从链上判定。tx gasLimit 范围是 **409,819 – 983,071**，全部 ≤ 2^24。
   → `tx_submitter.csv`

### 生成链路与限制

- 报告头（`packages/analytics/reports/full/comprehensive_analysis_20260119.md`）写着「从 45 个日志文件中提取 28 条交易记录」，导出路径是 `~/Dev/mycelium/my-exploration/projects/aastar-sdk/...`。**那个 clone 已不存在。**
- 在本仓全部历史里（`git log --all -S`），`complete_dataset` / `attribution_dataset` 这两个文件名**只出现在报告和数据文件里，没有任何入库的代码写这两个文件**。也就是说，**生成脚本从未提交**，那 45 个日志文件也没有入库。
- 因此能给的是：**入库 commit `af87017d` 是生成时间的上界**；`testType` 名对应 `tests/l4-test-anni-gasless.ts`（首次入库 `3b948d77`，2026-01-12）和 `tests/l4-test-jason2-gasless.ts`。至于当时具体跑的是哪个 commit 的哪个脚本，**无法核实**。
- 仓库根目录的 `data/transaction_cache/` 存有这 14 笔的 receipt 缓存（14/14 命中，读写方是 `packages/analytics/src/core/DataCollector.ts`，最近入库 `57268b09`，2026-01-25）。这是旁证，不是生成脚本。
- **原数据未删除、未修改。** 去重 manifest 和是否从论文里剔除，由 DSR 按 M3.6 决定。

## 交付三（M4.2）— 五场景流程

（编写中，见后续提交。）

## 复现

```bash
SEPOLIA_RPC=<archive-capable Sepolia RPC> scripts/cc128/rebuild-tx-userop-map.sh   # exit 0；最后打印 5 个 SHA256
```

本次两次独立运行，三个输出文件逐字节相同：

| 文件 | SHA256 |
|---|---|
| `tx_userop_map.csv` | `538461e8fe206268313f2af5fe4fac66b05d43b49825d5900d46bfdc1a979940` |
| `tx_submitter.csv` | `8df17f8e5db10ff5b9f27289003783bc945ac818c33a2ff8fc3bef0f0df489b8` |
| `pm_version_at_block.csv` | `ade2319b24aa7ca57eb38d3a1c7303b5588c4848c738f77be5886fd33f3958d1` |

负对照：输入只有表头时，脚本报 `zero tx hashes read` 并 exit 1；`attribution_dataset` 删掉一笔 tx 时，脚本报 `different tx sets` 并 exit 1。
