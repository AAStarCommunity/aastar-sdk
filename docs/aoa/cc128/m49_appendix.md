# CC-128 补证附录：论文五场景的 SDK 证据与差异表（AOA M4.9-SDK）

> 对应：DSR CC-128 2026-10-30「有界补证」帖；任务书 `AOA_Cross_Repo_Closure_2026-10-31.md`（DSR `389289c9`）的「SDK 与 DVT 补交」一节。
> 对照对象：论文 `SuperPaymaster_Thesis_v7.9.md`（DSR `389289c9`）§5.2 的 Table 2 及脚注 a–d、式 [eq:epoch-capacity]。
> 本文只修证据、给差异。不修 12 项 SDK 缺陷，不开发 GUI 或新接口，不重采历史数据。

## 0. 固定版本与标签

| 角色 | 固定点 | 说明 |
|---|---|---|
| SDK 基线（5.4.2） | `aastar-sdk` `dbb3c47f`（main） | 论文已引用的 commit。`34b67c7f`（PR #419）只加了文档和脚本，`packages/` 与 `dbb3c47f` 逐字节相同 |
| SDK 5.5.0 适配 | `aastar-sdk` `49714635`（CC-122 R2，draft PR #420） | **未合并、未发版、未切地址**。论文的 AOA 列是 5.5.0，SDK 侧只有这个分支有对应代码 |
| 合约 | `SuperPaymaster` tag `v5.5.0-rc.4` = `fbd74fb1` | `git diff v5.5.0-rc.4 origin/main -- contracts/src` 为空（SP main `d3af1ddc`）。论文引用的 `1ac0e1c5` 到 rc.4 之间，`contracts/src` 也没有变化 |
| 账户 | `airaccount-contract` main `2ff4bf1` | 只用来核 `ACCOUNT_RENEW` 是否有实现 |

下文合约路径的简称：
- `Tok` = `contracts/src/tokens/v2/xPNTsTokenV2.sol`
- `Ext` = `contracts/src/tokens/v2/xPNTsTokenV2Ext.sol`
- `Base` = `contracts/src/tokens/v2/xPNTsV2Base.sol`
- `SP` = `contracts/src/paymasters/superpaymaster/v3/SuperPaymaster.sol`
- `Adm` = `contracts/src/paymasters/superpaymaster/v3/SuperPaymasterAdmin.sol`

SDK 路径的简称：
- `PMC` = `packages/paymaster/src/V4/PaymasterClient.ts`
- `V550` = `packages/core/src/actions/superPaymasterV550.ts`（只在 `49714635` 上有）

每条结论都标了证据级别：

| 标签 | 含义 |
|---|---|
| **实测·桩** | 离线运行 SDK 的真实代码，链读和 bundler 用桩替代：`scripts/cc128/count-signatures.ts` |
| **实测·anvil** | 本地 anvil 上部署 SP `v5.5.0-rc.4`，经 SDK 发真实交易并读回状态。**不是公链** |
| **历史日志** | 仓库里已有的 Sepolia 回执，版本较旧（单独注明） |
| **读码** | 只读了源码，没有运行 |
| **条件模型** | 论文的算式或假设，SDK 不会自动做到，需要满足所列前提 |
| **MISSING** | SDK 没有对应 API，或者上游没有实现 |

## 1. 三类签名

### 1.1 更正：估算签名不是 dummy，是同一个签名者的真实签名

论文 §5.2 及脚注 a 写的是，`PaymasterClient.ts:268–269` 在估算前「以程序方式签一个一次性的内存 dummy 结构」，「标准 ERC-4337 钱包不会再弹一次提示」。**SDK 代码并不是这样**：

- `PMC:253`（`dbb3c47f`）先放了一个占位签名 `0x11…`（65 字节），这才是真正的 dummy。
- 但 `PMC:268–269` 随即用调用方传入的签名者，调用 `signUserOpHash` 对**估算用的那一笔 op** 重新签名，把占位签名覆盖掉了。`signUserOpHash` 就是 `wallet.account.signMessage({ raw: userOpHash })`（`PMC:27–34`）。发给 `eth_estimateUserOperationGas` 的是这个真实签名。
- 估算用的 op 和最终提交的 op 不是同一笔（gas 字段不同），所以两次签的 hash 不同。
- `49714635` 上的对应行是 `PMC:259`（占位）和 `:275`（真实签名）。R2 在 `:506` 新增了一个只用来估 PVG 的占位签名，它从不交给签名者，也从不发出。

**实测·桩**：`scripts/cc128/count-signatures.ts` 用一个会计数的 viem LocalAccount，跑真实的 `submitGaslessUserOperation`，SP（operator）路径。两个 commit 的结果相同：

| 场景 | `signMessage` 次数 | 不同 hash 数 | 其他 |
|---|---|---|---|
| A 自动估算（不传 gas），bundler 接受 | **2** | 2 | — |
| B 调用方传入 `verificationGasLimit` + `callGasLimit` | **1** | 1 | 跳过估算 |
| C 自动估算，bundler 先回一次 `replacement underpriced` | **3** | 3 | 每次重试重签一次（`PMC:557/:606/:628`；R2 为 `:594/:643/:665`） |
| D 自动估算，bundler 没有 `eth_sendUserOperation`（-32601） | **2** | 2 | 钱包**自己发了一笔 `handleOps` 交易**（`PMC:635–648`） |

- 日志：`evidence/count-signatures.dbb3c47f.json`、`evidence/count-signatures.49714635.json`。两份都 exit 0。
- 负对照：把 A 的期望改成 1，脚本 exit 1。
- R2 那次运行的 `reads` 字段里有 `version`、`operators`、`gasParams`，可以确认走的是 5.5.0 分支。

**这对论文意味着什么**：
- 「+1 SDK est.」应改写为「+1 次对同一签名者的真实签名请求（签的是估算用的 op）」。
- 它会不会变成一次用户可见的确认，取决于集成方传进来的账户实现：
  - viem LocalAccount（私钥在进程内）不会提示。
  - KMS 或 passkey 账户每调用一次 `signMessage` 就走一次仪式。这一点是**读码**推断，没有测；AirAccount 变体 B（`transfer-manager.ts`）是另一条路径，本附录没有核。
  - JSON-RPC 账户的 `wallet.account` 上没有 `signMessage`，这条路径直接走不通（**读码**）。
- 调用方传入 gas 上限时，这次签名可以去掉（场景 B）。
- 传输层重试每次 +1，最多 +4（`PMC:505–506`）。

### 1.2 三类签名的落点

| 类别 | AOA（SP 5.5.0）路径 | 证据 |
|---|---|---|
| `S_user`：用户签名者 | 每笔 op 1 次最终签名（`PMC:496–498`；R2 `:532–535`），估算另加 1 次，重试另加 0–4 次（见 §1.1）。账户设置交易另计（§2 S2） | 实测·桩 |
| 程序生成的 dummy | 只有占位字节 `0x11…`（`PMC:253`；R2 `:259`、`:506`），不经过签名者，也不计入用户确认 | 读码 + 实测·桩（hash 计数里没有它） |
| `S_srv`：paymaster 服务器签名 | **0**。5.5.0 的 `paymasterAndData` 是 `[SP 20][pmVGL 16][postOp 16][operator 20][maxRate 32][token 20][flags 1]` = 125 字节，没有签名字段（R2 `packages/core/src/superPaymasterData.ts:14–17`、`:42–43`）；`SP.validatePaymasterUserOp`（`SP:226–`）里没有 ECDSA 或 recover | 读码；实测·anvil：链上 `paymasterAndData` 125 字节，flags=0 |
| 社区签名 | `xPNTs.mint`（S2、S3a），`safeMintForRole`（S2 AOA-Comm），`emergencyRevokePaymaster` / `proposeStandby` / `emergencySwitchToStandby`（S5） | 见 §2 |
| keeper / 价格维护者签名 | `SP.updatePrice()`，**无权限限制**（`Adm:476–477`，`external`，没有修饰器） | 读码 |

VPM 列（VerifyingPaymaster 的服务器签名）不在 SDK 里：SDK 没有 VerifyingPaymaster 客户端。

## 2. 逐格差异表（AOA-Self / AOA-Comm 两列）

「执行者」指谁发交易、谁付 gas。「资金」指这一步动了谁的资产。

### S1 已充值稳态 → 1 笔确认的 ERC-20 转账

| 步骤 | 执行者 / 签名 | 资金 | 等待 | SDK | 级别 |
|---|---|---|---|---|---|
| 签 op | 用户：1 次，自动估算时 +1 | — | — | `PMC:329–656`（R2 `:335–700`） | 实测·桩 |
| 验证：锁定完整的 `a0` | 链上（SP → `Tok.tryLockForGas`，`Tok:225–248`） | operator 的 `aPNTsBalance −a0`；用户 xPNTs 锁定 `x0` | — | — | 实测·anvil |
| 结算 | 链上（`Tok.settleLocked`，`Tok:250–271`） | 用户 burn `x_b`，退回 `a0−c` | **1**（打包确认） | — | 实测·anvil：用户 burn 70.5695 xPNTs；operator 减少量 = protocolRevenue 增加量；`lockedOf` 0→0；`inflightOf` 已清；UOE `success=true` |
| 付 gas 的 ETH | bundler 垫付，EntryPoint 从 SP 押金报销 | SP 在 EntryPoint 的押金 | — | — | 读码 |

- 实测日志：`evidence/s1-sp550-anvil-e2e.txt`（SDK `49714635` 的 `scripts/sp550-local-e2e.ts`）。
- **限制**：anvil 上没有 bundler，这笔 op 走的是 `-32601` 回退，由 EOA 直发 `handleOps`（日志里有 `Falling back to direct handleOps`）。所以「bundler 垫付」这一行在本次实测里**没有覆盖**。
- 历史日志：Sepolia SP v5.4.1-rc.1 的 gasless bundle `0xda662f6d…`（`docs/onchain-evidence/v0.28.0.md:25`、`:55`），UOE `success=true`。这是旧机制，只作旁证。

### S2 冷启动 → 达到 S1 的就绪状态

| 列 | 用户签名的交易 | 社区签名 | 资金 | 等待 | SDK |
|---|---|---|---|---|---|
| AOA-Self | 5 笔：`createAccount`（`UserClient.ts:45–116`），`USDC.approve` + `GTokenSale.buyTokensFor`（`packages/tokens/src/tokenSale.ts:224–288`），`GToken.approve`（`UserClient.ts:371–388`），`Registry.registerRole`（**MISSING**，三个现有 API 都不可用，见 `five_scenarios.md` 场景 2 #9） | 1：`xPNTs.mint`（`packages/core/src/actions/tokens.ts:334`） | 用户 EOA 的 ETH 付 5 笔 gas；USDC 买 GToken；GToken 质押；社区付 mint 的 gas | 5 + 1 | ETH 和 USDC 的获取都是 **MISSING**（外部） |
| AOA-Comm | 0 笔设置交易 | 2：`safeMintForRole`（`packages/core/src/actions/registry.ts:392–407`，质押由社区出）+ `mint` | 社区出质押和两笔 gas | 社区 2 笔 | counterfactual `initCode` 在主路径上是 **MISSING**：`UserClient.executeGasless` 不透传 factory（`UserClient.ts:497`）；`SuperPaymasterClient` 支持 factory，但只能发 ERC-20 转账 |

**5.5.0 补充（读码）**：用户**不需要**为 SP 开通额度。SP 的默认自动额度是 `SP_DEFAULT_CAP = 5,000` aPNTs（`Base:30`、`:270–272`），用户总额默认 `USER_TOTAL_DEFAULT = 5,000`（`Base:32`、`:281`），续期模式默认 `MODE_SP_K = 0`（`Base:46`、`:101`）。所以 S2 里没有 approve 或 setAutoAllowance 这一步。上一版 `five_scenarios.md` 写的是「5.5.0 下首次额度怎么开通待重新设计」，这里据源码收口。

### S3a 余额充值 与 S3b cap 续期（分开列）

**S3a 充值**：社区 owner 调 `mint(to, amount)`（`Ext:368`），执行者和付 gas 的都是社区，用户链上签名为 0。
- SDK 接口是 `tokens.ts:334`。它用的是 v1 xPNTs 的 ABI，`mint(address,uint256)` 的 selector 与 v2 相同（读码）。
- **实测·anvil**：R2 E2E 的准备步骤里，社区账户给用户 mint 了 1000 xPNTs（见 `sp550-local-e2e.ts` 的 setup）。
- 用户向社区发起申请这一步是 **MISSING**（链下）。
- 充值只增加余额，**不恢复 cap**。

**S3b cap 续期**：

| 路径 | 执行者 / 签名 | 资金 | SDK | 级别 |
|---|---|---|---|---|
| inline 续期（每个 cap 周期第一次，`K=1`）：在 op 的 flags 里置 `SP_RENEW` 位，验证阶段由 SP 代为续期 | 签名已包含在该 op 里，额外 0 | 同 S1 | SDK 能编码这个 flag（R2 `superPaymasterData.ts:56`、`:64–67`），但**不会自动置位**：R2 `PMC:358` 的注释要求调用方自己确认前提成立。所以「第一周期 0 签名、0 等待」是**条件模型**，「自动触发」是 **MISSING** | 读码 |
| inline 续期的前提 | `renewalMode == MODE_SP_K`（默认值），`autoRenewUsed < K`，`lockedOf == 0`，`creditReservedOf == 0`。不满足时返回 `INVALID_RENEWAL`（`Tok:199–203`） | — | 能读到的状态：`getXPNTsV2SponsorshipState`（R2 `V550:171–213`） | 读码 |
| 显式续期（每 2B 笔一次）：`renewForSelf(sp)`（`Tok:370`） | 用户：1 次签名 | **不能用 SP 代付**，见下方实测 | R2 只有 calldata 编码器（`V550:215–221`），没有提交封装 | **实测·anvil** |
| 显式续期的中继变体：`executeBySig(ACT_RENEW)`（`Ext:81–100`，EIP-712） | 用户签 1 次，中继者发交易 | 中继者的 ETH | **MISSING**：SDK 没有 digest、签名或中继 API，也没有中继服务 | 读码 |
| 在账户验证阶段续期：flags 置 `ACCOUNT_RENEW` 位（spec `03-final-spec.md:80`、`:300`） | 签名已包含在该 op 里 | 同 S1 | **MISSING（上游）**：`airaccount-contract` main `2ff4bf1` 里没有出现 `renewForSelf` 或 `ACCOUNT_RENEW`。SP 只检查两位不能同时置 1（`SP:295–296`） | 读码 |

**实测·anvil：显式续期必须另找资金**（`scripts/cc128/renew-funding-probe.ts`，日志 `evidence/s3b-renew-funding-probe.txt`，exit 0）：
- **P1**：把 `account.execute(token, renewForSelf(sp))` 放进一笔 SP 代付的 op。结果 UOE `success=false`，revert 原因是 `RenewBlocked`。用户**照样被扣了 62.9565 xPNTs**，`used` 从 70.57 涨到 133.53。
  原因：SP 在验证阶段已经加锁，`lockedOf > 0`；而 `_renew` 要求 `lockedOf == 0`（`Base:302–311`）。
- **P2**：同一个调用改由 owner EOA 直接执行 `SimpleAccount.execute`，自己付 ETH（gasUsed 47,064）。成功，`used` 归零。

**对论文的影响**：
- 「每 2B 笔，1 个签名 / 1 次等待」只有在有一个**付了 ETH 的执行者**时才成立，这个执行者可以是用户自己的 ETH、另一个 paymaster，或者一个中继者。
- AOA 的前提恰恰是账户里没有 ETH。所以这一步的资金来源要在表里写明，不能记成零成本。
- 如果客户端把续期当成一笔普通的 SP 代付 op 发出去，用户会白付一笔失败 op 的费用。

**容量 B**：
- `_lockDecision` 用完整的 `a0` 去比较剩余额度（`Tok:190–214`、`:207–209`）；结算后只占用 `c`（`Tok:265`，`_refund`）。
- 实测·anvil 的数据与此一致：一笔 op 之后 `used = 70.57`，等于 c，不等于 a0。所以论文按完整 `a0` 准入计算容量的写法与源码一致。
- SDK 不计算 `a0` 或 `B`。准入前能用的预检有两个：Lens `dryRunValidation`（R2 `V550:121–`），它对 `INSUFFICIENT` 给出 reason；以及 `getXPNTsV2SponsorshipState`。

### S4 失败 → 清除故障，并完成转账

| 子场景 | 动作 / 执行者 | 用户签名 | 资金 | 等待 | SDK | 级别 |
|---|---|---|---|---|---|---|
| (a) 内层调用 revert | 链上：照常结算，退回 `a0−c` | 0 | **用户照付 `c`** | 同原 op | **SDK 不报失败**：P1 的 UOE 是 `success=false`，但 `submitGaslessUserOperation` 照常返回交易 hash；bundler 路径下 `waitForUserOperation`（`PMC:727–742`；R2 `:771–786`）也不检查 `success` | **实测·anvil**（P1 本身就是一次内层 revert） |
| (a) 重试 | 用户重新发一笔 | +1（自动估算时再 +1） | 同 S1 | +1 | 重试决策 **MISSING**；执行沿用 S1 的 API。R2 的单笔在途保护（`packages/paymaster/src/SuperPaymaster/v550.ts:74–114`）在链上 nonce 前进后自动解除 | 读码 |
| (b) postOp revert | 链上：执行被回滚；SP 的 `_inflight` 和用户的锁都残留 | 0 | EntryPoint 的 ETH 照付 | — | — | 读码，**未实测** |
| (b) 清除：operator 一侧 | `SP.releaseStaleSponsorship(opHash)`（`SP:457–465`），任何人可调 | 0，或者由执行者签 | 执行者的 ETH；恢复的是 **operator 的** `a0` | +1 | **MISSING**：R2 只在错误提示里提到它（`packages/core/src/actions/superPaymaster.ts:15–17`），ABI 有，没有封装 | 读码 |
| (b) 清除：用户一侧 | `xPNTsTokenV2.releaseStaleLock(user, opHash)`（`Tok:273–276`），任何人可调；它恢复用户的 `lockedOf` 和已用额度 | 同上 | 执行者的 ETH | +1 | **MISSING**（同上） | 读码 |
| (b) 替代路径 | `releaseAndDisable(sp, opHash)`（`Ext:73–77`），之后要 `enableSpenderForSelf`（`Ext:67`）重新开启 | +2 | 用户自己找资金（理由同 S3b） | +2 | **MISSING** | 读码 |

**对论文 S4b 的更正**：`releaseStaleSponsorship` 只把 operator 的 `a0` 退回去，**不会**解除用户在 xPNTs 上的锁，用户那边要另调 `releaseStaleLock`。所以「清除故障」最多需要**两个合约上的两笔交易**，不是一笔。
- 用户的锁残留时，重试不一定失败：只要剩余额度 ≥ `a0` 且可用余额足够就能过。但它会让 `renewForSelf` 失败（`RenewBlocked`），也就会挡住 S3b。
- 两笔都没有权限限制，但执行者要付 ETH。

### S5a 服务或价格不可用 → 完成转账

| 处置路径 | 执行者 / 签名 | 资金 | 等待 | SDK | 级别 |
|---|---|---|---|---|---|
| 刷新价格后转账 | 任何人调 `SP.updatePrice()`（`Adm:476–477`，无权限限制）：签 1 次。然后用户转账（同 S1） | 刷新者的 ETH | 2 | `superPaymasterActions.updatePrice`（R2 `superPaymaster.ts:681`）；运维脚本 `scripts/keeper.ts` / `run-keeper.sh` | 读码 |
| （注）SDK 的 V4 估算路径 | 在测试网上，V4（不传 operator）的估算过程发现缓存价格过期时，会**用用户的钱包自动发一笔 `updatePrice()` 并等回执**（`PMC:143–196`）。这是一次用户没要求的交易。主网上直接抛错。**SP 路径没有这项检查**（`:144`） | 用户钱包的 ETH | +1 | — | 读码 |
| 切到已就绪的 standby 后转账 | 社区：`proposeStandby` → 时间锁 → `activateStandbyDesignation` → `emergencyRevokePaymaster` → `emergencySwitchToStandby`（`Ext:270–311`）。用户 1 次签名 | 社区的 ETH | 用户 1 次 | **MISSING**：SDK 不读 token 当前的 `SUPERPAYMASTER_ADDRESS` 或 `standbySP`，也不会切换 SP 地址或 operator。standby 发现与切换都没有 | 读码 |
| 原生 ETH 自付 | owner EOA 调 `account.execute` | owner 的 ETH | 1 | `UserClient.ts:155–169` | 实测·anvil：P2 就是这条路径（SimpleAccount） |
| 换 bundler | — | — | — | **MISSING**：`PMC` 只接受一个 `bundlerUrl` | 读码 |

- 历史日志：Sepolia Beta1（PaymasterV4）里有一笔 `updatePrice` 刷新 `0xb22a472b…`，之后一笔代付 op 成功（`docs/onchain-evidence.md:37–40`）。这是 V4，不是 SP 5.5.0。
- **keeper 现状**（DSR 10-30 帖要求暂停）：Sepolia keeper `io.aastar.price-keeper`（`run-keeper.sh sepolia`）的签名地址就是 SP deployer `0xb560…df0E`。2026-10-31 读到的状态：launchd 里是 `disabled`、未加载、没有进程，`keeper.log` 最后一次写入是 2026-09-27。SDK 侧不会启动它。

### S5b 紧急撤销授权

| 对象 | 动作 | 用户签名 / 等待 | 效果边界 | SDK | 级别 |
|---|---|---|---|---|---|
| SP | 无需撤销 approve：SP 从来没有拉款权限。对当前或历史 SP，`allowance` 恒为 0，`transferFrom` / `burn(from)` 会 revert（`Tok:117–118`、`:128–137`、`:147`） | 0 | — | — | 读码 |
| SP（停止新的锁定） | `disableSpenderForSelf(sp)`（`Ext:66`）；中继变体 `executeBySig(ACT_DISABLE)` | +1 / +1 | 新锁返回 `DISABLED`（`Tok:195`）；已经锁定的 op 照常结算。资金同 S3b，需另找 | **MISSING**（R2 只有 ABI） | 读码 |
| SP（社区侧） | `emergencyRevokePaymaster()`（`Ext:270–280`，`onlyCommunityOwner`） | 用户 0；社区 1 | 设置 `emergencyDisabled`，所有自动额度停用 | `tokens.ts:454–458`（v1 ABI，selector 相同，没有对 v2 跑过） | 读码 |
| 普通 spender 的**自动额度** | `disableSpenderForSelf(spender)` | +1 / +1 | 只停用自动额度部分 | **MISSING** | 读码 |
| 普通 spender 的**显式 approve** | `approve(spender, 0)` | +1 / +1 | `_spendV2` **先消耗显式额度，然后才检查是否被禁用**（`Tok:146–153`）。所以只调 `disableSpenderForSelf` 撤不掉显式额度，两者要分开撤 | `tokens.ts:320`（approve） | 读码 |
| 已签但还没上链的 EIP-2612 permit | **`approve(0)` 撤不掉它**：permit 上链时会直接把 allowance 改写成签名里的值。xPNTs v2 继承 OZ 5.0.2 的 `ERC20Permit`（`Base:7`、`:24`）；`Nonces` 只有 `nonces()` 是 public，`_useNonce` 是 internal（`singleton-paymaster/lib/openzeppelin-contracts-v5.0.2/contracts/utils/Nonces.sol:19`、`:28`），**没有对外的 nonce 作废函数**。能用的只有两种办法：等它过 deadline；或者 owner 用同一个 nonce 签一个新的 permit（比如 value 为 0）抢先提交，把这个 nonce 消耗掉（+1 签名 / +1 交易）。`executeBySig` 用的 `actionNonce`（`Base:127`，`Ext:85`）同样没有作废函数，只能靠 deadline | 见左 | permit 走 `ECDSA.recover`，所以只有 **EOA 持有人**会有这类暴露；智能账户签不了 permit | 有 `nonces` 读取（`tokens.ts:464–467`）和 `permit` 提交（`:469–477`，v1 ABI）。**签 permit 和作废 nonce 都是 MISSING** | 读码 |

TPM-P / TPM-U 两列（外部的 permit 型和 approve 型 paymaster）不在 SDK 里，本附录不提供证据。

## 3. 汇总：论文需要改的地方

| # | 论文位置 | 现在的写法 | 证据给出的结论 | 级别 |
|---|---|---|---|---|
| 1 | §5.2 三类签名；脚注 a | `PMC:268–269` 是「内存 dummy」，不会再弹一次提示 | 是对同一签名者的真实 `signMessage`，签的是另一笔 op 的 hash。会不会弹提示取决于账户实现；传入 gas 上限时可以免掉；每次重试 +1 | 实测·桩 |
| 2 | Table 2 S3b 的 AOA 两列 | 每 2B 笔：1 签名 / 1 等待 | 签名数对，但要写明**执行者自付 ETH**（或另一个 paymaster、中继者）；SP 代付会以 `RenewBlocked` 失败，用户照样付费。inline 续期需要客户端主动置 `SP_RENEW`，SDK 不会自动置 | 实测·anvil + 读码 |
| 3 | Table 2 S4(b) | `releaseStaleSponsorship`（+1 tx） | 最多两笔：SP 的 `releaseStaleSponsorship` 恢复 operator，xPNTs 的 `releaseStaleLock` 恢复用户；两笔都没有 SDK 封装（MISSING） | 读码 |
| 4 | §3 第 133 行「`releaseStaleSponsorship` 清除滞留的锁」 | 一次调用就清除锁、恢复 `a0` | `SP:457–465` 只恢复 operator 的 `aPNTsBalance`；用户的锁要用 `Tok:273` | 读码 |
| 5 | 脚注 a「返回 bundle tx hash 不检查 success」 | 引用 `L727–742` | `L727–742` 是 `waitForUserOperation`，它返回 receipt 但不判断 `success`；返回 tx hash 的是 `-32601` 回退（`:640`）。实测 P1：`success=false` 时 SDK 照常返回 | 实测·anvil |
| 6 | Table 2 S5b permit 一格 | 「需要作废 nonce 或等过期（取决于 token；MISSING）」 | xPNTs v2 没有作废函数，只能等 deadline，或者同 nonce 抢先提交。只影响 EOA 持有人。SDK 两者都 MISSING | 读码 |
| 7 | S2 AOA 列 | — | 5.5.0 下用户无需开通 SP 额度（默认 cap 5,000，默认模式 `MODE_SP_K`），不必为此加步骤 | 读码 |
| 8 | 论文第 203 行的 MISSING 引用 | `34b67c7f` | 仍然成立。5.5.0 相关的逐格结论以本附录（`49714635` + rc.4）为准 | — |

**沿用不变**：
- 历史 14 笔：按 tx 去重 ≡ 按 UOE 去重，只在这 14 笔上成立；`gasUsed` 列是 tx gas。不重采，也不混进最终的 50 组。
- `≤2^24` 仍然只是建议边界，不保证 PVG 足额补偿。
- 12 项 SDK 缺陷不在本单修。

## 4. 复现

```bash
# 签名计数（离线，在要测的那个 checkout 的根目录运行）
pnpm exec tsx scripts/cc128/count-signatures.ts          # exit 0；JSON 输出到 stdout

# 本地 anvil（不涉及公链）。先在 SP v5.5.0-rc.4 的 checkout 里部署：
anvil --port 28545 --hardfork prague
ANVIL_RPC_URL=http://127.0.0.1:28545 PRIVATE_KEY=<anvil #0 公开默认 key> ./deploy-core anvil --force
# 然后在 aastar-sdk 49714635 的 checkout 里运行：
SP550_CONFIG=<sp>/deployments/config.anvil.json SP550_RPC=http://127.0.0.1:28545 pnpm exec tsx scripts/sp550-local-e2e.ts
SP550_CONFIG=<sp>/deployments/config.anvil.json SP550_RPC=http://127.0.0.1:28545 pnpm exec tsx <本仓>/scripts/cc128/renew-funding-probe.ts
```

- 本次在 `fbd74fb1` 的干净 `contracts/src` 上部署，T-4 读回 50/50 通过。
- 三个脚本都是 exit 0。
- 部署和脚本都在 `env -i` 下运行，没有读取任何 `.env` 文件。

| 文件 | SHA256 |
|---|---|
| `scripts/cc128/count-signatures.ts` | `10525ceb7272f5eb88a908c254792d105dcad36169cf9eea629920d7334e8911` |
| `scripts/cc128/renew-funding-probe.ts` | `7f27799bf8562eed9dc44d1e6f9f56cbe7917364fe8eeac74931e3e343bc4bb0` |
| `evidence/count-signatures.dbb3c47f.json` | `9bb50b4248e9b90d99c7c93ea18b8dcdffd0b0773a8eefb4adf705f8fee936a2` |
| `evidence/count-signatures.49714635.json` | `c1a1ba5030559e340e4e5ce2efe5e9f4789ec4aca8b433bd3998b524211ccadd` |
| `evidence/s1-sp550-anvil-e2e.txt` | `7bd10e290ebc9f9654a3c66d657e46ca4253cfc4fe84e38dc0d870b6805e618e` |
| `evidence/s3b-renew-funding-probe.txt` | `12ab457cabafe4b6a3463c7c66abc3423dcfab89f293edc662f9ccc49b2ccd41` |

## 5. 未核实与限制

- **全部实测都在本地 anvil 或桩上，没有一项来自公链。** SP 5.5.0 尚未部署到 Sepolia。
- 本次实测没有经过真实 bundler：anvil 上走的是 EOA 回退。bundler 侧的重试分支能否被命中，取决于具体厂商。
- 账户只测了 SimpleAccount。AirAccount（KMS/passkey）上估算签名是否会多一次仪式，以及 owner 能否直接 `execute`，**没有测**。
- S4(b) 的 postOp revert、`releaseStale*`、standby 切换、`executeBySig`、permit 抢先作废，都只读了代码。
- `tokens.ts` 里 mint、approve、emergencyRevokePaymaster 用的是 v1 ABI，没有对 v2 实际跑过。
- 这里的签名和等待计数描述的是 SDK 和协议层的任务结构，**不能当作用户体验或认知负担的证据**。
