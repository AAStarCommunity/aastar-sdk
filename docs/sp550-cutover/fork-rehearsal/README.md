# SP 5.5.0 rc.4：本地 Sepolia fork 演练（DSR 第 2 项）

> **标注：这是 fork 上的 rc 结果，不是 live 结果。** 合约为 SuperPaymaster `v5.5.0-rc.4` = `fbd74fb1`，跑在本地 anvil fork 上，配本机 bundler。真正的 live 一轮放到切地址工单里做。
>
> 运行日期 2026-11-08。fork 区块 12090052（Sepolia）。SDK 代码为本分支 `feat/sp550-cutover`，它叠在 #420 之上。

## 环境

| 项 | 值 |
|---|---|
| 链 | `anvil --fork-url https://ethereum-sepolia-rpc.publicnode.com --fork-block-number 12090052 --auto-impersonate`，地址 127.0.0.1:28546 |
| 升级方式 | SuperPaymaster `contracts/script/v3/UpgradeToV5_5_0.s.sol`（rc.4 原版），按 runbook 依次运行 `executePendingAPNTs` → `pauseOperators` → `run()` → `ensureStake` → `issueCommunityToken` → `configureOperatorV2` → `unpauseOperator`。`V55_APNTS_DECISION=execute`（DSR 指定） |
| bundler | 本机 UltraRelay-AAStar（Alto 的 fork），地址 127.0.0.1:3046。executor 用 anvil 公开测试 key，配置见 `ultrarelay.fork.json` |
| 密钥 | 只用 anvil 公开助记词。社区、operator、SP owner 的动作都靠 anvil 冒充地址完成，**没有用任何真实 key** |
| 共享链 | 没有碰。公开节点只作为 `--fork-url` |
| 进程 | 跑完已关闭 anvil 和 bundler，没有留下常驻进程 |

## fork 专用的捷径（live 上不会这样做）

1. 冒充以下地址发交易：SP owner `0xb560…df0E`、operator ANNI，以及 APNTsCapped 的 minter `0x16dF…dEBf`。
2. 把时间推过 APNTs 时间锁的 ETA（+92784 秒）。S7 在 live 上已经排进了 `0x9Eb1…e1E7`（APNTsCapped-1.0.0）。
3. 推进时间后，把 Chainlink aggregator 最新一轮的 `updatedAt` 改成当前时间，answer 不变。做法与 SP 的 `script/evidence/a2-full-rehearsal.sh` 中的 refresh_oracle 相同。
4. 用冒充的 minter 给 OWNER 和 ANNI mint 新 aPNTs（数量等于它们原有的余额），给 SP mint 等于 protocolRevenue 的量，这样 step 1(4) 和 1(6) 才能执行。live 上这一步由治理自己完成。
5. bundler 进程用 `time-shift.cjs` 把系统时钟平移到 fork 的链上时间，否则它会拿真实时间去比较 validAfter/validUntil。

## 升级结果（`setup.txt`）

- `SP.version()`：从 `SuperPaymaster-5.4.2` 变为 `SuperPaymaster-5.5.0`。
- `APNTS_TOKEN` 切换到 APNTsCapped `0x9Eb1…e1E7`。
- operator 余额快照：OWNER 1690.0、ANNI 844.5，protocolRevenue 399.6，合计 2934.1，等于 totalTracked。
- AAStar 的 v2 token 是 `0x50a3…6DD8`，operator 已恢复。
- 新合约地址见 `config.sepolia-fork.json`，由 SP 脚本写出。两次独立的 fork 运行部署出完全相同的地址。

## 切换核对脚本 `check:sp550-cutover`

| 对象 | 结果 |
|---|---|
| fork，使用 `pins.fork.json`，加 `--allow-rc` | **PASS 16/16** |
| fork，把 globalTierSource 换成 AOAProtocolRegistry 的地址（负对照） | FAIL 1/16，命中 `factory.defaultTierSource()` 这一项，exit 1 |
| Sepolia live（block 12090052），pin 为空 | FAIL 18/18：链上是 5.4.2，impl 为 `0xe25f88db`，exit 1 |

上表是 2026-11-08 的结果，当时默认快照是链头。现在在 fork 上重跑，要加 `--block latest`，理由见下文。

注意：`pins.fork.json` 里的 `spImplCodehash` 是从同一个 fork 读回的，所以这一项是同源比较。live 上它必须来自独立的链上读回。

2026-11-11 起（DSR 13dbedac）：pin 还要给**每个**已 pin 的地址带上运行时 codehash（`codehashes`，键与 pin 名相同，fresh 部署的地址簿用 `addresses.<key>`），gate 对每一个都核对，任何一个不符就拒绝。原因是 `version()` 区分不了构建：SP-a 的 `a8b57e17` 和托管版都报 `SuperPaymaster-5.5.1`，提现语义却不同。`pins.fork.json` 里的 `codehashes` 是从按同一 fork 块重搭的 rc.4 部署上读回的（`spImpl` 与原 `spImplCodehash` 一致，说明是同一份部署），同时补上了第 5 轮起必填的 `spVersion`。fork 上 codehash 来自部署本身，live 上来自读回。

### 按网络选择（2026-11-09 起）

`--network` 现在必填，pin 和部署方式只由它决定。脚本在读任何东西之前，先断言每个 RPC 的 chainId 等于该网络的 chainId；不一致就 exit 2。

| `--network` | chainId | 方式 | pin 表 |
|---|---|---|---|
| `sepolia` | 11155111 | 原地升级 5.4.2 → 5.5.0，proxy 不变（fork 演练也用它，anvil fork 的 chainId 不变） | `SP550_CUTOVER_PINS` |
| `op-sepolia` | 11155420 | 全新部署整套 V5（链上是不带 proxy 的 SP 3.2.2） | `SP550_FRESH_DEPLOY_PINS` |
| `op-mainnet` | 10 | 同上；另有发布暂停：3.2.2 的迁移或下线由作者决定 | `SP550_FRESH_DEPLOY_PINS` + `SP550_RELEASE_HOLDS` |

全新部署必须用两个**不同的** RPC endpoint 读回（`--rpc2`）。只差尾斜杠或主机名大小写的，也算同一个 endpoint，直接 exit 2。两边在快照块上必须返回所要的那一块，块哈希格式合法且相同。此后每一次状态读取都在两边各读一次，包括 version、impl 槽、各项 wiring 和 code；两边不一致，就记成 `DIVERGE` 对象。它和任何值都不相等，包括另一个 `DIVERGE`，所以对应那项检查一定失败。每个已 pin 的地址，无论在顶层还是地址簿里，在每个 RPC 上的 code 都必须非空且相同。viem 的读调用只能按块号读，不能按块哈希读，所以全部读完以后，要在每个 RPC 上把快照块的哈希再取一次，必须和开头一致。读完时重组还没退回去，gate 就判失败。**已知限制（A→B→A 重组）：**如果在两次取哈希之间，链从 A 切到 B 又回到 A，两次哈希相同，这次重组就发现不了，因为读取并没有绑定块哈希。所以快照块**默认取 finalized 块**：在所有 RPC 报告的 finalized 块里取最低的那个。finalized 块不会再被重组，这个窗口也就不存在了。哪个 RPC 给不出 finalized 块（报错，或者没有块号），就在读状态之前 exit 2。正式读回必须用这个默认值，不要用“链头往前几块”。

`--block` 的另外两种取值：
- 一个具体块号：原样使用，例如复核某次读回。
- `latest`：取各 RPC 链头里最低的那个，**只用于本地 fork 演练**。fork 上的升级发生在 fork 块之后，而 fork 的 finalized 块早于这次升级，用默认值会读到升级前的状态。

注意：读 finalized 块上的状态，需要 RPC 提供非链头状态。OP Mainnet 的 `optimism-rpc.publicnode.com` 免费档会把这种读取当成 archive 请求拒掉（`-32602 Archive requests require a personal token`），换一个 endpoint 即可。

**两个 RPC：** 正式读回一律要两个**不同的** RPC。只有在本地回环地址上做 fork 演练时，才允许只用一个 RPC；否则在读任何状态之前就 exit 2（clestons N4）。RPC 在快照块上 `getBlock` 或 `getCode` 抛错时，记为该项检查失败、exit 1，不会让脚本崩掉（N3）。

**版本来自 pin：** SP 的 `version()` 必须和 `pins.spVersion` **完全相等**。Lens 的 `EXPECTED_SP_VERSION` 必须等于 `keccak256(pins.spVersion)`，两项检查用的是同一个 pin。gate 里不写死任何版本号：5.5.0 这条发布线里的 SP 合约版本是 `SuperPaymaster-5.5.1`，版本一变就是一次要评审的 pin 改动。`spVersion` 为空、缺失，或者不是 `SuperPaymaster-5.5.x` 格式，都算 pin 不完整。

**gate 认证的必须是 SDK 实际在用的：** 下面几种情况都判失败，否则 gate 报 PASS 的合约，和 SDK 实际调用的合约可以不是同一个（clestons B1、N1、N2）。
- 两种模式下，`pins.superPaymaster` 都必须等于 SDK 地址簿里的 `superPaymaster`。
- 原地升级模式下，地址簿里的 `aPNTs` 和 `xPNTsFactory` 必须分别等于链上的 `SP.APNTS_TOKEN()` 和 `SP.xpntsFactory()`。也就是说，切换时地址簿必须一起更新：今天 Sepolia 上地址簿里的 `xPNTsFactory` 是 v1 factory，升级后 SP 会指向 V2 factory。
- 全新部署模式下，地址簿里每个 pin 过的条目都必须等于 pin 值，声明为 absent 的 key 不能出现在地址簿里。
- pin 之间不能有地址重复，例外只有三对本来就该相同的：`superPaymaster` = `addresses.superPaymaster`，`aPNTsCapped` = `addresses.aPNTs`，`xPNTsFactoryV2` = `addresses.xPNTsFactory`。

pin 覆盖 SP 自己部署的整本地址簿，每个条目归谁由 `SP550_ADDRESS_OWNER` 规定，地址簿新增 key 却没归类，编译就会报错：
- `sp`：必须 pin。
- `sp-optional`：要么 pin，要么列进 `absent`（SP 的 manifest 声明这条链上没部署）；两样都没有，就算问题。
- `external`：EntryPoint、Chainlink、AirAccount/YAAA 这一类，包括 AirAccount 的 `agentRegistry`。它们不从 SP 的 manifest 取值，只核对 SP 自身的 wiring。

OP Mainnet 的发布暂停只能通过改 `SP550_RELEASE_HOLDS` 来解除，没有任何参数能绕过去。

校验逻辑在 `packages/core/src/sp550CutoverGate.ts`，脚本只是一层命令行包装。测试用模拟 RPC 覆盖了以下情况：
- 同一个 endpoint 用了两次；
- chainId 不对（包括只有第二个 RPC 不对）；
- 读取顺序（chainId 必须最先读）；
- 块哈希为 null、不一致，或者返回的不是所要的那一块；
- RPC2 上的 impl 或 wiring 与 RPC1 不一致；
- 发布暂停。

2026-11-10 实跑（pin 为空，只读，默认快照 = 最低 finalized 块）：

| 网络 | RPC | 快照块 | 结果 | 说明 |
|---|---|---|---|---|
| `op-sepolia` | `sepolia.optimism.io` + `optimism-sepolia-rpc.publicnode.com` | 51236181 | FAIL 22/26，exit 1 | 两边块哈希相同；读到 `SuperPaymaster-3.2.2`，impl 槽为 0 |
| `op-mainnet` | `mainnet.optimism.io` + `optimism.drpc.org` | 159338166 | FAIL 23/27，exit 1 | 同上，另多一项发布暂停 |
| `sepolia` | 私有 Sepolia RPC（单个，原地升级） | 12101458 | FAIL 17/19，exit 1 | 读到 5.4.2。按现在的规则（N4），单个非回环 RPC 会在读任何东西之前就 exit 2 |

chainId 错、缺 `--rpc2`、两个 RPC 是同一 endpoint、网络名未知、`--block` 取值非法、拿不到 finalized 块，这几种情况都 exit 2。

## SDK E2E（`e2e.txt`，`scripts/sp550-fork-e2e.ts`）

| 场景 | 结果 |
|---|---|
| S2 冷启动（AOA-Comm） | 用户签名 0 次。社区发了 4 笔交易：createAccount、GToken approve、`safeMintForRole(ENDUSER)`、mint 1000 xPNTs v2 |
| S1 `PaymasterClient.submitGaslessUserOperation`（自动估算） | `success=true`；`signMessage` **2 次**（估算 1 次加最终 1 次）；链上等待 1 次；用户扣 84.19 xPNTs，`lockedOf=0`；operator 扣减额等于用户扣减额 |
| S1 限频 | 紧接着发第二笔会被 bundler 拒绝：`-32503 not valid yet`。原因是 `validAfter = lastTimestamp + minTxInterval`，**live 上 AAStar operator 的 minTxInterval 是 60 秒**。**SDK 不会等待也不会重试** |
| S1 `SuperPaymasterClient.submitGaslessTransaction`（ERC-20 转账） | `success=true`；`signMessage` 2 次；等待 1 次 |
| S3a 充值 | 用户签名 0 次，社区 mint 1 笔，用户余额 +100 xPNTs |
| S4a 内层调用 revert | SDK 照常返回 hash，不报错；`UserOperationEvent.success=false`；**用户照样被扣了 72.98 xPNTs**；`signMessage` 1 次（调用方传了 gas 上限） |
| S5a 价格过期 | Lens 返回 `STALE_PRICE`；SDK 提交时被 bundler 拒绝（`-32503 expires too soon`）；任意第三方发 1 笔 `updatePrice` 之后，Lens 返回 `OK`，再提交 `success=true`，`signMessage` 2 次 |
| S5b operator 暂停 | Lens 返回 `OPERATOR_PAUSED`；**SDK 在签名之前**就以可读错误拒绝；SP owner 恢复后可继续 |
| C12 `createEndUserClient().executeGasless` | `success=true`；`signMessage` 1 次，另加 EOA 自己的那笔 handleOps 交易，用 ETH 付费 |

## 复现

```bash
# SP fbd74fb1 的干净 checkout，并已执行 forge build
scripts/sp550-fork/setup-fork.sh <sp-checkout> <out> 12090052
# 准备 <out>/ultrarelay.fork.json（rpc-url 127.0.0.1:28546，port 3046，只开 v0.7 EntryPoint），然后：
SP550_FORK_OUT=<out> ULTRARELAY_DIR=<UltraRelay-AAStar> scripts/sp550-fork/restart-bundler.sh
SP550_FORK_CONFIG=<out>/config.sepolia-fork.json \
SP550_FORK_REFRESH_ORACLE_CMD=scripts/sp550-fork/refresh-oracle.sh \
SP550_FORK_AFTER_WARP_CMD="SP550_FORK_OUT=<out> ULTRARELAY_DIR=<...> scripts/sp550-fork/restart-bundler.sh" \
  pnpm exec tsx scripts/sp550-fork-e2e.ts
# 结束后关掉 anvil 和 bundler：kill $(cat <out>/anvil.pid) $(cat <out>/ultrarelay.pid)
```

E2E 脚本只接受本机回环地址上的 RPC 和 bundler，否则直接拒绝运行。

## 局限

- 账户只用了 SimpleAccount；AirAccount 的 KMS / passkey 签名仪式没有覆盖。
- 只跑了 AAStar 这一个 operator，ANNI / Mycelium 没有配置 v2，也没有恢复。
- S3b（cap 续期）没有跑：默认 cap 是 5000 aPNTs，几笔操作用不完。之前 anvil 上的实测见 `docs/aoa/cc128/m49_appendix.md`。
- 计数只描述 SDK 和协议层的任务结构，**不是用户体验证据**。

## pins schema v2（2026-11-11，DSR a25d86f4 / 9c8cded5）

`pins.fork.json` 新增了几个字段，都是从 rc.4 分叉上读回来的：
- `spAdminExtension` = `SP.EXTENSION()`；
- `lensVersion` = `Lens.version()`；
- `registryImpl` = Registry 代理 ERC-1967 槽里的地址；
- `addresses{}`：registry、policyRegistry、blsAggregator、dvtValidator、reputationSystem，取自 SDK 地址簿；
- 上面每个地址对应的 `codehashes`。

**rc.4 没有部署 DisclosureRegistry**，所以这份 pins 用 `scripts/sp550-pin-fill.ts` 跑出来恰好有一项 ❌：`pins complete and well-formed — disclosureRegistry: unpinned`，其余 62 项都通过。这是 #443 之前的记录：作者 2026-11-12 决定 5.5.0 不部署 DisclosureRegistry，manifest 现在写 `"disclosureRegistry": "n/a:none"`，读回里的条目每个字段都是 `"n/a:not deployed"`（#443），这一项不再是缺 pin。`docs/sp550-cutover/a7/` 下的 schema 和两份示例是 SP 的原样副本（schema sha256 cb49395f…），示例里那个已部署的 registry 只是格式示例，SDK 不改它们。

`scripts/sp550-readback-compare.ts` 负责逐字段比对 SP 的 `aoa-a7-readback/1` 读回文件、pins，以及 SDK 自己在链上读到的值。在这个分叉上用 cast 生成了一份读回文件做冒烟测试，结果 PASS。另外故意改坏了三处：Registry 的 version 写成 null、extension 写了一个 version、SP 的 owner 写错，三处都被拒绝了。
