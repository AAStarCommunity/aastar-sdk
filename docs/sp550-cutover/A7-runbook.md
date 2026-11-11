# SP 5.5.0 rc.8：A7 分叉端到端与实链端到端 runbook

两次运行用同一个脚本 `scripts/sp550-live-e2e.ts`、同一套逐 op 硬检查。分叉这次是 A7，在 rc.8 定稿后跑；实链那次紧接部署之后跑。**只有这两次的结果算论文 C-30i/C-30j 的证据。** 之前 rc.4 分叉的 PASS（`fork-rehearsal/live-e2e-rc4.txt`）只证明 harness 和 SDK 能跑通（DSR 63e488e5）。

## 一、A7：rc.8 分叉，一条命令

### 一份分叉、一个状态（DSR 裁定）

A7 只执行一次，由 SP 来跑。SP 在约定的 chainId 和 fork block 上用 manifest 执行器跑 A7，然后把 anvil 状态导出：

```bash
python3 script/upgrade/manifest_exec.py simulate --stage a7 --inputs <rc8-inputs.json> --out <空目录> \
    --rpc-file <主节点文件> --rpc-file-secondary <备用节点文件> --block <fork block> [--plan <冻结的 plan>] --dump-state <file>
```

SP 的 anvil 以 `--hardfork amsterdam --accounts 0` 启动，交易发送方都是冒充身份，所以导出的状态里不含 RPC URL，也不含任何私钥。SDK 和 DVT 都加载这同一份导出，三方演练的是同一次部署。导出文件的 sha256、fork block 和 chainId 记入证据。

### 输入

| 输入 | 来源 | 说明 |
|---|---|---|
| 状态导出 `<dump>` 及其 sha256 | SP（A7 执行），由 DSR 转达 | sha256 对不上，脚本在启动 anvil **之前**就拒绝 |
| `a7-readback.json` | SP（A7 执行） | schema `aoa-a7-readback/1`；SDK 逐字段比对 |
| manifest pins JSON | SP 第 13 步的 manifest PR，由脚本生成 | 必须是 `--pins` 格式的 v2（带 spAdminExtension、lensVersion、registryImpl、disclosureRegistry、addresses{}、codehashes），和门用的是同一个文件 |
| operator | 同一个 manifest PR | 支付 xPNTs v2 的社区 operator |
| SP checkout | rc.8 tag | 用来记录 commit，并和 readback 头里的 spCommit 比对 |
| fork block | DSR 转达 | 跨会话只传 chainId 和块号 |
| `SP550_FORK_URL` | 作者配进本地环境，或者用 SDK 自己的节点 | 必须是归档节点。**不写日志，也不放进跨会话消息**。我的节点和 SP 的节点在上游状态上如有差别，阶段 2 会查出来 |
| `ULTRARELAY_DIR` | 本机 UltraRelay-AAStar checkout | 本地 bundler |

### 命令

```bash
SP550_FORK_URL=<归档节点> ULTRARELAY_DIR=<UltraRelay-AAStar> \
  scripts/sp550-fork/run-a7.sh --load-state <dump> --expect-sha256 <hex> --readback <a7-readback.json> \
      <SP rc.8 checkout> <manifest pins.json> <operator> <fork block> <out>
```

退出码为 0，并且 `<out>/run.log` 最后一行是 `A7 PASS`，才算通过；其他任何结果都是 `A7 FAIL at stage <n>: …`。退出时 anvil 和 bundler 都会被关掉。

### 各阶段和日志（都在 `<out>/` 下）

| 阶段 | 做什么 | 日志 |
|---|---|---|
| — | 开头记下：模式和导出文件的 sha256、SP 的 tag 和 commit、SDK commit、fork block、pins 的 sha256、anvil 版本 | `run.log` |
| 1 | 核对导出文件的 sha256，然后 `anvil --fork-url <自己的节点> --fork-block-number <同一块> --chain-id 11155111 --hardfork amsterdam --load-state <dump>`；导出里没有带余额的账户，所以用 `anvil_setBalance` 给测试私钥 0–3 打钱 | `anvil.log` |
| 2a | 加载后立刻跑读回门，用 `scripts/sp550-pin-fill.ts` 的预览模式：manifest pins，加上切换后的地址簿 | `gate.log` |
| 2b | 用 `scripts/sp550-readback-compare.ts` 把 SP 的 readback 和 pins、以及 SDK 自己的读数逐字段比对 | `readback.log` |
| 3 | 刷新 Chainlink 时间戳（仅分叉）；按分叉时钟启动 bundler | `oracle.log`、`ultrarelay.log` |
| 4 | SDK E2E，见下 | `e2e.log`、`e2e.json` |

阶段 2b 比对的内容：

- **头部**：chainId、forkBlock、hardfork 和 dumpSha256 要和这次运行一致；spCommit 要等于 SP checkout 的 commit；tag 和 readbackBlock 要等于 pins 里的值。anvilVersion 只记录，不比较。
- **每个固定合约**：address 和 codehash 都要等于 pins。version 字段要和 SDK 自己读到的 `version()` 一致：读得到就必须相等，`version()` 会 revert 就必须是 `null`；SP 和 Lens 的 version 还要等于各自的 pin。
- **代理**：SP 的 ERC-1967 槽和 EXTENSION、Registry 的 ERC-1967 槽，都要等于 pins；不是代理的合约，这几个字段必须是 `null` 或 `n/a:…`。
- **owner 和 pendingOwner**：只查 SP 和 Registry，和 SDK 的读数比对。
- **其余字段**：guardian、roles 和 checks{} 只要求存在，由 DVT 和 DSR 去比对。
- **字段一律不能省略**：`null` 表示按设计这个函数不存在，`unreadable:…` 表示调用失败，`n/a:…` 表示不适用。

阶段 4 依次做三件事，前一件不过就不做下一件：

1. **读回门，逐行打印**：和 2a 是同一套检查，E2E 自己再跑一遍。
2. **`--fork-setup`**：用冒充身份部署账户，授 ENDUSER，mint xPNTs，把 renewalMode 设成 SP_K。之后的前置检查会再核对一遍。
3. **发 op**：先发 S1；再发 S3b，必要时先用一笔 op 把 allowance 压到 `SP_CAP_FLOOR`，然后一直发，直到 SDK 自己选出 SP_RENEW，最多 `maxOps` 次。

### 逐 op 硬检查（C-30i / C-30j）

每个 op 都要过下面三项，数据取自 SDK 实际发给 bundler 的请求，以及链上 handleOps 的 calldata 和 receipt。任何一项不过，退出码就是 1：

1. **估算用占位签名。** 每个 `eth_estimateUserOperationGas` 带的都是 `PaymasterClient.dummySignature()`，而且发出时签名器还没被调用过。
2. **一个 op 只签一次名。** 只有一次 `eth_sendUserOperation`，带的是真签名，`signMessage` 只调用一次。如果因为 fee 或 PVG 重试而重签，这一项判失败，不会算成一次。
3. **SP_RENEW 由 SDK 自己选，前后一致。** 脚本从不传 `superPaymasterFlags`。发出的 flags 字节（v0.7 RPC 形式下是 `paymasterData[72]`）必须等于打包进 handleOps 的那个字节。带 SP_RENEW 时，同一个 receipt 里必须有 `AllowanceRenewed(user, SP, bySP=true)`，并且 `autoRenewUsed` 加 1；不带时这两样都不能出现。

另外，S3b 里带 SP_RENEW 的那个 op 还要求 `UserOperationEvent.success = true`。

**全新账户的第一笔 op（Amsterdam state gas）。** A7 要求用户账户在这次运行之前不存在（`requireFreshAccount`）。S1 就是这个账户的第一笔赞助 op，xPNTs 的 lock 和 allowance 槽都是第一次写入，在 Amsterdam 下要多付 state gas，这笔 op 必须成功。日志里会单独打一行 `A7 FRESH ACCOUNT`。

每个 op 打一行 `RESULT`，内容是：`S_user`（signMessage 次数）、估算次数、发送次数、SDK 选的 flags、allowance 变化、`autoRenewUsed` 变化、`AllowanceRenewed(bySP)`、tx hash。

### 跑完之后

- 把 `<out>/run.log` 和 `<out>/e2e.log` 拷进 `docs/sp550-cutover/a7/`，在 #434 里提交，PR 正文贴出 `run.log` 第一行和全部 `RESULT` 行。
- **不提交** `deploy.log` 和 `anvil.log`。它们可能带有节点的报错原文，原文里可能有 fork 源的 URL。

## 二、实链：部署之后立刻跑

前提：作者已经亲自输入 keystore 密码发出部署交易（清单第二节第 3 步）。下面每一步都是只读的，或者只在作者给 go 之后才发送。

### 1. 比对 SP 的实链 readback

部署交易发出之后，SP 的实链 readback 用的是同一个 schema（`aoa-a7-readback/1`）。拿它和冻结的 manifest pins 比对，并用两个节点在 readbackBlock 读链：

```bash
pnpm exec tsx scripts/sp550-readback-compare.ts --readback <live-readback.json> --pins <冻结的 manifest pins.json> \
    --chain-id 11155111 --rpc <节点 A> --rpc2 <节点 B> --sp-commit <rc.8 commit> 2>&1 | tee <out>/live-readback.log
```

实链上没有导出文件，所以 forkBlock、dumpSha256、hardfork 这几个头部字段只检查是否存在，SP 应写成 `n/a:live`。退出码为 0 才能进行下一步。

### 1b. 读回并填 pin（工具：`scripts/sp550-pin-fill.ts`，单独的 PR）

```bash
pnpm exec tsx scripts/sp550-pin-fill.ts --network sepolia --manifest <冻结的 manifest pins.json> \
    --rpc <节点 A> --rpc2 <节点 B> [--allow-rc]            # 先预览
pnpm exec tsx scripts/sp550-pin-fill.ts ... --write      # 门通过后写进源码
```

工具只在读回门对 manifest pins 和切换后的地址簿全部通过之后，才去填 `SP550_CUTOVER_PINS[11155111]` 和 `CANONICAL_ADDRESSES[11155111]` 的切换项。写完会再跑一次不带 `--pins` 的 `check:sp550-cutover`，这次读的是刚写进去的源码；不通过就把两个文件还原。只要有一个 RPC 是回环地址或 anvil，工具就拒绝 `--write`。这一步的产物走 pin 填充 PR，按常规流程评审。

### 2. 预检，然后正式跑

配置文件放在仓库外面，因为 bundler URL 通常带着 key：

```json
{
  "network": "sepolia", "mode": "live",
  "rpcUrls": ["<节点 A>", "<节点 B>"],
  "bundlerUrl": "<实链 bundler>",
  "gate": { "allowRc": true },
  "operator": "<operator>", "account": "<用户 AA 账户>",
  "userKey": { "keystore": "<加密 keystore 路径>" },
  "maxOps": 8
}
```

```bash
# 在 pin 填充分支上执行（门读的是已经写进源码的 pins，实链不允许 bookOverrides）
pnpm exec tsx scripts/sp550-live-e2e.ts --config <live.json> --live-go sepolia --preflight 2>&1 | tee <out>/live-preflight.log
pnpm exec tsx scripts/sp550-live-e2e.ts --config <live.json> --live-go sepolia 2>&1 | tee <out>/live-e2e.log
```

- `--live-go sepolia` 是作者给的 go，必须和配置里的 network 相同。
- 签名器**只**从加密 keystore 加载，密码由作者在隐藏提示符下输入；不在 TTY 下运行会被拒绝（`scripts/sp550-live-signer.ts`）。
- 实链没有 `--fork-setup`。账户已部署、有 ENDUSER、xPNTs 有余额、renewalMode = SP_K，这几项要事先准备好，而且准备它们的交易同样要作者给 go。`--preflight` 会逐项核对，不发任何 op。
- 逐 op 硬检查与分叉完全相同；退出码 0 才算通过。
- **gas 只来自实链。** 每个 op 的 gas 都取自实链 bundler 的 `eth_estimateUserOperationGas`，SDK 和本地 forge 都不估算（DSR：stable forge 1.7.1 不懂 Amsterdam 的 gas 规则）。`live-e2e.log` 的 `GAS SOURCE` 行会记下 bundler 的主机名和它报告的 client 版本，不记完整 URL。

### 3. 日志

`live-readback.log`、`live-preflight.log` 和 `live-e2e.log` 放进 `docs/sp550-cutover/live/`，与 pin 填充 PR 或者 #434 一起提交。PR 正文贴出全部 `RESULT` 行和 tx hash。**这一份才是论文用的实链证据。**

## 三、彩排记录

`run-a7.sh` 不带 `--load-state` 时是部署模式，只用来彩排脚本本身：

```bash
SP550_A7_DEPLOY_CMD='SP550_FORK_ATTACH=1 <sdk>/scripts/sp550-fork/setup-fork.sh "$PWD" <out>/rc4-deploy' \
  scripts/sp550-fork/run-a7.sh <SP rc.4 checkout> <pins.json> <operator> 12090052 <out>
```

这种模式接到 run-a7 已经起好的 anvil 上跑 rc.4 的升级步骤。在 rc.4 上彩排过一次，见 `fork-rehearsal/a7-rehearsal-rc4.txt`；DSR 记为**只验证工具，不是 A7 证据**。
