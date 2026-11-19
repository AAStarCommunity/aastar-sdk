# CC-128：SP 5.5.0 调用路径与任务结构表（骨架）

> DSR 第 4 项。这张表是 [`five_scenarios.md`](five_scenarios.md) 的 5.5.0 版本；`five_scenarios.md` 针对的是 5.4.2，SDK 版本为 `dbb3c47f`。
> **状态：骨架。** 凡是 live 的格子都标 `pending`，要等 SP 5.5.0 正式部署、读回 gate（`check:sp550-cutover`）exit 0 之后，用 `scripts/sp550-live-e2e.ts` 实跑填入。fork 列来自已经跑过的本地演练，标注了出处，live 跑之前不会改动。
> 口径与 `five_scenarios.md` 相同：
> - 签名列只计**用户自己 key 的签名事件**；社区、operator、第三方的交易另列。
> - 等待列只计新增的交易或 UserOp 确认。
> - **GOMS 只用来支撑任务结构，不用来声称降低了真实的认知负担。** 计数描述的是 SDK 和协议层的任务结构，不是用户体验证据。

## 数据来源

| 标记 | 含义 |
|---|---|
| **fork rc.4** | 本地 Sepolia anvil fork 加本机 bundler，SP `v5.5.0-rc.4` = `fbd74fb1`，2026-11-08。见 `docs/sp550-cutover/fork-rehearsal/README.md`（#426），输出在 `e2e.txt`。**这一轮早于 #431**（估算改用 dummy 签名、自动 SP_RENEW），所以 S1 的签名数是 #431 之前的值。 |
| **fork rc.8** | 用 SP 的 rc.8 A7 fork 部署跑 `scripts/sp550-live-e2e.ts --config <fork.json>`。`pending`：A7 fork 还没有。 |
| **live** | 读回 gate exit 0 之后，跑 `scripts/sp550-live-e2e.ts --live-go <network>`。按网络分列；网络顺序遵照作者的决定：Sepolia 原地升级先上；OP 全新部署延期时，备选是 Sepolia L1，不是 OP Sepolia。`pending`。 |

## 表

| # | 场景 | SDK 路径 | 用户签名：fork rc.4 | 等待：fork rc.4 | 用户签名：fork rc.8 | 用户签名：live | 等待：live | live 证据（tx / op hash） |
|---|---|---|---|---|---|---|---|---|
| S1 | 已充值稳态，自动估算 | `PaymasterClient.submitGaslessUserOperation` | 2（估算 1 + 最终 1，早于 #431） | 1 | pending（#431 之后预期 1：估算改用 dummy 签名，见 #431 的单测） | pending | pending | pending |
| S1b | 已充值稳态，ERC-20 转账 | `SuperPaymasterClient.submitGaslessTransaction` | 2（早于 #431） | 1 | pending | pending | pending | pending |
| S1r | 限频：紧接着发第二笔 | 同 S1 | 第二笔被 bundler 拒绝（`-32503 not valid yet`），SDK 不等待、不重试 | — | pending | pending | — | pending |
| S2 | 冷启动（AOA-Comm，社区代办） | 社区侧交易，用户不签 | 0（社区 4 笔：createAccount、approve、`safeMintForRole`、mint） | 4（社区） | pending | pending | pending | pending |
| S3a | 充值 | 社区 `mint` | 0（社区 1 笔） | 1（社区） | pending | pending | pending | pending |
| S3b | **inline 续期（SP_RENEW）** | `PaymasterClient`，#431 自动置位 | 未跑（默认 cap 5000 aPNTs 用不完） | — | pending | pending（预期：除这笔 op 自己的签名外为 0） | pending | pending：本行要从链上读回四项——`paymasterAndData[124]` 带 SP_RENEW、`success=true`、`AllowanceRenewed(inline)`、`autoRenewUsed` +1 |
| S3b-s | S3b 的前置：把 cap 降到 `SP_CAP_FLOOR` | 用户发一笔 `setAutoAllowance` op | — | — | pending | pending（1 笔 op 的签名） | pending | pending |
| S4a | 内层调用 revert | `PaymasterClient`，调用方给定 gas 上限 | 1 | 1 | pending | pending | pending | pending：`success=false`，用户照样被扣费 |
| S5a | 价格过期 | Lens 预检，加第三方 `updatePrice` | 恢复后 2（早于 #431）；恢复前被 bundler 拒绝 | 1（第三方）+ 1 | pending | pending | pending | pending |
| S5b | operator 暂停 | Lens 预检 | 0：SDK 在签名之前就拒绝 | 0 | pending | pending | — | pending |
| C12 | 自打包 `handleOps` | `createEndUserClient().executeGasless` | 1（另加 EOA 的 handleOps 交易，用 ETH 付） | 1 | pending | pending | pending | pending |

## live 跑之前还要确认的

- rc.8 之后的语义变化，填 live 列时要逐条核对：
  - **两步提现、48 h 延迟：** 影响 operator 侧，不影响用户签名；
  - **pauseUnderstakedOperator：** S5b 会多一个触发原因；
  - **xPNTs v2 的 EIP-712 name 改为 token name：** 影响 permit 和 ACT_RENEW，本表的 SP_RENEW 路径不签 typed data；
  - L-01 已撤回，`validAfter` 仍取 postOp 的时间戳，S1r 的行为预期不变。
- 每一行 live 数据都要附 SDK 的 commit、SP 的 tag，以及读回 gate 的输出（快照块号和两个 RPC endpoint）。
