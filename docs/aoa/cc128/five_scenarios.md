# CC-128：五个终端用户场景的任务分解（SDK 绑定，main @ dbb3c47f）

> 只读调研。所有 SDK 引用为 `aastar-sdk` 仓 `dbb3c47f`（工作区与 HEAD 一致，仅一个无关的未跟踪文件）。合约引用为 `SuperPaymaster` 仓 tag `v5.4.2`（下文简称 `SP.sol` = `contracts/src/paymasters/superpaymaster/v3/SuperPaymaster.sol`，`Registry.sol` = `contracts/src/core/Registry.sol`，`MySBT.sol` = `contracts/src/tokens/MySBT.sol`，`xPNTs.sol` = `contracts/src/tokens/xPNTsToken.sol`，`Staking.sol` = `contracts/src/core/GTokenStaking.sol`）。
> 规则：步骤没有 SDK API 或需要 UI → 标 `MISSING`；不猜点击次数；GOMS 只用于任务结构。
> **本文所有"会 revert / 会被拒"的判断都是静态读码推断，没有发交易、没有做链上 eth_call。** 例外见下面的「链上核实」一节。

> **链上核实（主代理补，Sepolia block `12003768`，只读 `eth_call` / `eth_getStorageAt` / `eth_getCode`）——请先读这一节，它更正了正文的两处前提：**
> 1. **现役 Registry 是 `Registry-5.8.0`，不是 5.4.2。** SP 代理 `0x09DF…4DE9` 的 `version()` 读出 `SuperPaymaster-5.4.2`，它的 `REGISTRY()` 是 `0xf5Bf…8E71`，`version()` 读出 `Registry-5.8.0`。5.8.0 源码不在任何 tag 上；最后一个含该版本字符串的 SP commit 是 `815ae02a`。正文里标成 `Registry.sol` 的行号都取自 SP 的 `v5.4.2` tag，在 5.8.0 上**可能对不上**。下面两条已在 5.8.0 上核过。
> 2. **自注册（场景 2 #9）结论成立，已在链上确认。** 现役 Registry 实现 `0x9bed0f58…ccee`（EIP-1967 槽）的字节码里，`registerRole(bytes32,address,bytes)`（`0x669d7762`）的 PUSH4 出现 1 次，`registerRoleSelf(bytes32,bytes)`（`0x0ab0c75e`）出现 0 次。5.8.0 源码 `registerRole` 要求 `msg.sender == user`（`815ae02a:contracts/src/core/Registry.sol:319`）。
> 3. **「信用额度为 0 的新用户会被一律拒绝」在当前 Sepolia 上不成立。** `creditTierConfig[0]=0`，`[1..3]=300e18`；一个从未交互过的地址（`0x…dEaD`）读 `getCreditLimit` 得 **300e18**。因此这只是代码路径上的可能性，取决于治理参数；当前配置下新用户的额度是 300。正文场景 1 前提、场景 2 #13 里对应的句子，按本条理解。
> 4. `postOp` 下限：SP 5.4.2 源码 `MIN_POST_OP_GAS = 200_000`（`v5.4.2:contracts/src/paymasters/superpaymaster/v3/SuperPaymaster.sol:86`）；`packages/sdk/src/clients/endUser.ts:259` 写死 `50000n`。这条只读了代码，没有链上模拟。

## 0. 记号与计数口径

`SDK file:line` 列的前缀（汇总表按它计数）：

- `API`：有可调用的 SDK API，读码判断能在 5.4.2 上工作。
- `API⚠`：SDK API 存在、能调用，但读码发现缺陷（结果可能错，但不会因此卡住流程）。
- `MISSING`：没有 SDK API；或需要 UI；或 SDK API 存在但读码判断在 5.4.2 上走不通（这种情况会写明原因）。
- `链上`：EntryPoint / 合约内部步骤，不需要 SDK 动作，两个计数都不算。

签名列统计的是**签名事件**次数（谁签、什么 key、签什么）。"自动"指 SDK 用同一个本地 key 签，不提示用户。等待列里的"链上确认"按**单独的一次交易 / 一次 UserOp 打包**计数。同一次确认在多行出现时，后面的行写"同 #n"，不重复计。

主路径：除非另说，用户侧主路径是 `@aastar/enduser` 的 `UserClient.executeGasless(paymasterType:'Super')`，它调用 `@aastar/paymaster` 的 `PaymasterClient`（走 bundler）。**为什么不用 `@aastar/sdk` 的 `createEndUserClient().executeGasless`**：
- 它把 `paymasterPostOpGas` 写死成 `50000n`（`packages/sdk/src/clients/endUser.ts:259`），低于 5.4.2 的 `MIN_POST_OP_GAS = 200_000`（`SP.sol:86`）。验证阶段会返回 SIG_FAILURE（`SP.sol:1170-1176`），EntryPoint 随即以 AA34 revert。
- 它不走 bundler，由 EOA 直接调用 `handleOps`，ETH 由 EOA 付（`endUser.ts:315-344`）。
- 它固定用 SimpleAccountFactory 预测地址（`endUser.ts:363-394`），不适用于 AirAccount。

AirAccount（KMS / passkey，服务端）的路径另列为"变体 B"。

---

## 场景 1：已充值稳态（发一笔经 SuperPaymaster 代付的 gasless UserOp）

**账户前提**：
- AA 已部署，owner 是本地 EOA（主路径）。
- AA 持有 ROLE_ENDUSER，所以 `SP.sbtHolders[AA]==true`（由 `Registry.sol:535-541` 设置）；或者 AA 是注册过的 agent。判定见 `SP.sol:1600-1602`。
- **信用额度足够**：`getDebt + pendingDebts + 本次 charge ≤ Registry.getCreditLimit(AA)`。5.4.2 每一笔都检查这一条，与 xPNTs 余额无关（`SP.sol:832-835`，由 `:1217` 调用）。
- AA 持有该 operator 的 xPNTs（postOp 里 burn；不足时在信用上限内记债，见 `SP.sol:1444-1490`）。5.4.2 下用户**不需要** approve：`burnFromWithOpHash` 只限 SP 调用（`xPNTs.sol:484-490`）。
- operator 地址已知，且该 operator 已配置、未暂停、aPNTs 余额充足。
- SP 在 EntryPoint 的 ETH 押金充足，价格未过期。
- 调用方配置了 bundler URL。

| # | 用户动作 | 系统动作 | 签名 | 等待 | 失败/恢复 | SDK file:line |
|---|---|---|---|---|---|---|
| 1 | 在 dApp 中确认要执行的调用 | — | 0 | 用户交互 | — | `MISSING`：UI。SDK 没有交易确认或展示组件 |
| 2 | — | 编码 `execute(target,value,data)` | 0 | 无 | 编码失败直接抛出 | `API` `packages/enduser/src/UserClient.ts:466-470` |
| 3 | — | 估算 gas：用 SP 的 paymasterAndData（pmVGL 和 postOp 都填 300k）构造占位 op，读 nonce，**签名**后调用 `eth_estimateUserOperationGas` | 1（自动。owner EOA，secp256k1，对 userOpHash 做 EIP-191 personal_sign，见 `PaymasterClient.ts:268-269`、`:27-34`） | bundler RPC 往返 | bundler 报错时抛 `Estimation Error: <json>`（`:309`）；返回 -32601 时改用 Anvil 默认值（`:298-307`）。SP 路径**跳过**价格过期检查（`:144`，只对 V4 检查） | `API` `packages/paymaster/src/V4/PaymasterClient.ts:126-323`；调用点 `UserClient.ts:486-500` |
| 4 | — | 调整 gas：pmVGL=`tuneGasLimit(est,60k,0.45)`，VGL=估算值+80k，postOp=`max(est+100k,200k)` | 0 | 无 | — | `API` `UserClient.ts:503-516` |
| 5 | — | 读 nonce（`account.getNonce()`）和费率（测试网下限 0.5 gwei），组装 paymasterAndData = `[SP 20][pmVGL 16][postOp 16][operator 20][maxRate 32 = uint256.max]` | 0 | RPC | — | `API` `PaymasterClient.ts:387-434`；`packages/paymaster/src/V4/PaymasterUtils.ts:94-114` |
| 6 | — | 计算 userOpHash，签名 | 1（自动，与 #3 同一把 key） | 无 | AirAccount v0.20+ 需要 `airAccountSig:true`（0x02 前缀），否则会偶发 AA24。但 `UserClient.executeGasless` **不透传**这个参数（`UserClient.ts:519-535`） | `API` `PaymasterClient.ts:496-498` |
| 7 | — | 调用 `eth_sendUserOperation`。遇到 replacement underpriced、fee 太低或 PVG 太低时，改字段、重签后重试，最多再试 4 次 | 0–4（自动重签） | bundler RPC | 其它错误抛 `Bundler Error`（`:650`）；**-32601 时静默改由 EOA 直接调用 `handleOps` 并自付 ETH**（`:635-648`）；仍失败则抛 "after retries"（`:655`） | `API` `PaymasterClient.ts:506-655` |
| 8 | — | 链上执行 `handleOps`，见本表下方说明 | 0 | **bundler 打包 + 链上确认（1）** | 见场景 4、5 | `链上` `SP.sol:1138-1236`（validate）、`:1346-`（postOp）、`:1444-1490`（_recordDebt） |
| 9 | — | 等 UserOp receipt | 0 | 同 #8 | 超时时返回 `{timeout:true}`（`:733-739`）；**不检查 `receipt.success`** | `API` `PaymasterClient.ts:727-742`。注意 `UserClient.executeGasless` 只返回 userOpHash（`UserClient.ts:519-537`），等待需要调用方自己再调 |
| 10 | 查看结果和扣费 | 解析扣费事件 | 0 | 无 | `getFeeFromReceipt` 只认 V4 的 `PostOpProcessed` topic，对 SP 的回执返回 null | `MISSING`：SDK 不解码 SP 的 `TransactionSponsored`（`PaymasterClient.ts:662-683` 只处理 V4） |

**#8 链上执行的内容**：
- SP 的 `validatePaymasterUserOp` 依次检查：operator 已配置、operator 未暂停、SBT 或 agent 资格、postOp gas ≥ 200k、黑名单、限频（validAfter）、maxRate、信用上限、operator 的 aPNTs 余额，然后乐观扣减 aPNTs。
- 执行 callData。
- postOp：`burnFromWithOpHash` 扣用户 xPNTs；失败时按 `_recordDebt` 记债（`SP.sol:1444-1490`）。

**变体 B（AirAccount 服务端，KMS + 设备 passkey，两阶段）**：

| # | 用户动作 | 系统动作 | 签名 | 等待 | 失败/恢复 | SDK file:line |
|---|---|---|---|---|---|---|
| B1 | — | `prepareTransfer`：构造 UserOp（paymasterAndData 见下方说明），计算 digest，调用 `beginCeremony` | 0 | KMS 服务往返 | 见下方说明 | `API⚠` `packages/airaccount/src/server/services/transfer-manager.ts:350-437`；`paymaster-manager.ts:148-206` |
| B2 | 在设备上完成 passkey 验证（`navigator.credentials.get`） | — | 1（用户。WebAuthn P-256 assertion，challenge = digest） | 用户交互 | 取消或过期 → 重新 prepare | `MISSING`：前端 UI。SDK 只返回 `publicKeyOptions` |
| B3 | — | `submitPreparedTransfer`：KMS 凭 assertion 签 owner ECDSA；tier ≥ 2 时再请求 DVT 做 BLS 共签 | 1（KMS，TEE 内 secp256k1，对 userOpHash 做 EIP-191）。tier2/3 另加 DVT 的 BLS 聚合签名 | KMS 往返；tier ≥ 2 时还有 DVT 往返 | challenge 不符时 KMS 返回 400 | `API` `transfer-manager.ts:438-`；`applySignature` `:741`；`buildDvtRequest` `:689` |
| B4 | — | 异步提交到 bundler，每 2s 轮询一次 receipt，最多 60 次 | 0 | **bundler + 链上确认（1）** | 失败时写 `status=failed`；AA32 被转成 `PaymasterPriceStalenessError`；**拿到 txHash 就标记 completed，不看 success** | `API⚠` `transfer-manager.ts:859-928`；`providers/ethereum-provider.ts:317-353` |
| B5 | 查询状态 | `getTransferStatus` | 0 | 轮询 | — | `API` `transfer-manager.ts:975` |

**B1 的 paymasterAndData 与 SP 识别**：
- 识别出 SP 时，拼成 `[SP][80k][300k][operator][maxRate]`。
- 识别 SP 用的是 4 字段的 `operators` ABI（`paymaster-manager.ts:37-40`），而 5.4.2 的结构有 9 个字段，第 0 个字段是 `uint128 aPNTsBalance`（SDK 自带的 `SuperPaymaster.json`）。
- operator 固定取 SP 的 `owner()`（`:182-192`），调用方不能指定。
- 识别失败时会静默落到 V4 的布局（`:208-238`）。这一点没有在链上验证。

**MISSING（场景 1）**：
- 交易确认 UI（#1）。
- SP 扣费结果解码（#10）。
- 变体 B 的前端 passkey UI（B2）。
- 附带的缺口：两条路径都不检查 `receipt.success`（#9、B4），详见场景 4。

**5.5.0 差异**：
- paymasterAndData 必须追加 `[token 20][flags 1]`（README `v5.5.0-rc.4` 第 143 行；spec `docs/design/aoa-balance-mode/03-final-spec.md:298-300`，flags 的 bit0=SP_RENEW、bit1=ACCOUNT_RENEW，两位都置 1 → sigFail）。#5 的 `buildSuperPaymasterData` 和 B1 都要改。
- 验证阶段改为托管：`tryLockForGas` / `settleLocked` 替代 `burnFromWithOpHash` / `recordDebt*`（README 第 141 行）。结算语义随之改变，#8 受影响。
- 显式 approve 先用，自动额度兜底（spec `:196` A-2）。
- 每笔 op 的 gas 参数要从链上 `gasParams()` 读取（spec `:634` GOV-5），#4 写死的 200k 下限需要改成读链上值。
- `dryRunValidation` 移到 `SuperPaymasterLens`（README 第 139 行）。
- SDK 在 dbb3c47f **还不支持**上面任何一项。

---

## 场景 2：首次使用（从零到第一笔代付 op）

**账户前提**：
- 什么都没有：没有 key、没有 AA、没有 SBT/角色、没有 GToken、没有 xPNTs、没有信用。
- 目标社区已经由社区注册为 ROLE_COMMUNITY，它的 operator 已在 SP 配置好（这是社区侧的事，不在本场景内）。

| # | 用户动作 | 系统动作 | 签名 | 等待 | 失败/恢复 | SDK file:line |
|---|---|---|---|---|---|---|
| 1 | 生成或导入 owner key | — | 0 | — | — | `MISSING`：EOA 路径下 SDK 没有生成 key 或导入助记词的 API，要靠 viem。变体：passkey 注册 `packages/airaccount/src/auth/passkey/passkey.manager.ts:86`（需要 RP 后端和浏览器 UI）；KMS 签名者 `account-manager.ts:203`（`ensureSigner`） |
| 2 | 给 owner EOA 弄到测试网 ETH | — | 0 | 外部 faucet（链下，时长不定） | — | `MISSING`：用户侧没有。`SepoliaFaucetAPI.fundETH`（`packages/core/src/actions/faucet.ts:99`）需要 admin 私钥 |
| 3 | — | 预测 AA 地址 | 0 | RPC | — | `API` `UserClient.ts:74-78`（在 `deployAccount` 内）。另有 `endUser.ts:363-394`（SimpleAccount）、AirAccount `account-manager.ts:151-256`（counterfactual 地址，部署推迟到第一笔 UserOp 的 initCode） |
| 4 | — | EOA 直接调用 `factory.createAccount` 部署 AA | 1（EOA 交易，secp256k1） | **链上确认（1）** | gas 估算失败时用 2M gas 重发（`UserClient.ts:88-113`）；`deployAccount` **不等回执**，调用方要自己等 | `API` `UserClient.ts:45-116`。passkey 变体 `createAccountWithPasskey` 需要一个有 ETH 的 `deployerWallet` 代付（`account-manager.ts:634-657`）；两阶段版本见 `:664-` |
| 5 | 弄到 USDC（买 GToken 用的支付币） | — | 0 | 外部（链下） | — | `MISSING`：没有 onramp 或 bridge API |
| 6 | 买 GToken，直接送到 AA | `buySelfPay`：先 `approve(USDC)`（仅当 allowance 不足），再 `buyTokensFor(recipient=AA)` | 2（EOA 交易 ×2；allowance 已够时为 1） | **链上确认（2）** | `receipt.status≠success` 时抛错 | `API` `packages/tokens/src/tokenSale.ts:224-288`（recipient 见 `:67-69`）。替代：`buyGasless`（`:296-`），签 2 个 EIP-712（EIP-3009 + BuyIntent），再加 relayer 服务等待，链上确认 1 次；relayer 有故障切换（`:384-398`） |
| 7 | — | 检查加入条件 | 0 | RPC | 见下方说明 | `API⚠` `packages/sdk/src/clients/endUser.ts:349-362`；`packages/core/src/requirementChecker.ts:118-213`。应改为读 `registry.getRoleConfig`（`packages/core/src/actions/registry.ts:424`） |
| 8 | — | AA 授权 GToken 给 GTokenStaking（额度 1000 GT）：经 `AA.execute`，由 EOA 直接发交易、付 ETH，不是 UserOp | 1（EOA 交易） | **链上确认（1）** | — | `API` `UserClient.ts:371-388`、`:421-427` |
| 9 | — | AA 调用 `Registry.registerRole(ROLE_ENDUSER, AA, EndUserRoleData{account, community, "", "", stake})`。合约内会 `lockStakeWithTicket`、`MySBT.mintForRole`、`SP.updateSBTStatus(AA,true)`（`Registry.sol:245-274`、`:526-541`、`:360-374`） | 1（EOA 交易，如果手工完成） | **链上确认（1）** | 现有三个 API 都走不通，见下方说明 | `MISSING`：没有能为 AA 自注册的可用 API，要手工 `encodeFunctionData('registerRole')` 再 `UserClient.execute`（`:155-169`） |
| 10 | — | 校验角色、SBT 和 SP 资格 | 0 | RPC（`onboard` 内轮询 5 次，每次 2s） | `onboard` 吞掉异常，返回 `{success:false}`（`UserLifecycle.ts:119-122`） | `API` `packages/enduser/src/UserLifecycle.ts:104-113`；`packages/core/src/actions/sbt.ts:260`（`getUserSBT`）；`packages/core/src/actions/superPaymaster.ts:1310`（`sbtHolders`）；`packages/core/src/actions/agent.ts:46` |
| 11 | 向社区申请 xPNTs，或购买 / 兑换 / 跨链获得 | — | 0 | 社区响应（链下，时长不定） | — | `MISSING`：没有申请 API；没有用户侧的 xPNTs 购买、aPNTs→xPNTs 兑换或 bridge API。`TokenSaleClient` 卖的是 aPNTs 和 GToken（`tokenSale.ts:94-110`），不是社区 xPNTs |
| 12 | — | 社区 owner 给 AA mint xPNTs | 用户 0；社区 1 | **链上确认（1）** | `mint` 是 `onlyFactoryOrOwner`（`xPNTs.sol:1051`）；mint 时自动抵扣债务（`xPNTs.sol:607-634`） | `API`（社区侧）`packages/core/src/actions/tokens.ts:334` |
| 13 | — | 查询信用额度和可用信用 | 0 | RPC | 见下方说明 | `API⚠` `registry.ts:713`（`getCreditLimit`）；`superPaymaster.ts:1068`（`getAvailableCredit`）；`UserLifecycle.ts:211-246` |
| 14 | 选择 operator（sponsor） | 解析 community → operator | 0 | — | — | `MISSING`：`packages/core/src/communities.ts:15-33` 只有静态的 community→xPNTsToken 配置，没有 operator 字段，也没有链上发现接口；executeGasless 要求调用方直接传 `operator` |
| 15 | 发第一笔代付 op | 同场景 1 的 #1–#10 | 同场景 1：2（+0–4） | 同场景 1：链上确认 1 | 见下方说明 | 同场景 1 |

**#7 的缺陷**：
- 写死 0.44 GT（`endUser.ts:359`），只看钱包余额，不读 roleConfig 里的 minStake 和 ticketPrice。
- `requireSBT:false` 写死（`:360`）。
- 传入的地址表键名是 `gToken` / `mySBT`（`endUser.ts:108`、`:354`），而 checker 读的是 `gtoken` / `mysbt`（`requirementChecker.ts:156`、`:194`），于是回落到静态的 `CORE_ADDRESSES`。

**#9 现有三个 API 都走不通**：
- `UserClient.registerAsEndUser` 手写编码了 `registerRoleSelf(bytes32,bytes)`（`UserClient.ts:409-413`）。SDK 自带的 `Registry.json` 里没有这个函数，5.4.2 只有 `registerRole(bytes32,address,bytes)`（`Registry.sol:245`），所以预期会 revert。
- `endUser.joinAndActivate` 用 `RegistryABI` 调 `'registerRoleSelf'`（`endUser.ts:161-168`），viem 在编码阶段就会抛错。
- `registryActions.registerRoleSelf`（`registry.ts:368-390`）的映射是对的，但 `msg.sender` 是 `account`（EOA），而合约要求 `msg.sender==user`（`Registry.sol:247`），所以它只能为 EOA 注册，不能为 AA 注册。

**#13 的不一致**：`getAvailableCredit` 不扣 `pendingDebts`（`SP.sol:813-818`），而验证阶段会扣（`:832-835`），所以可能高估。另外，按代码，信用额度为 0 的用户即使持有 xPNTs 也会被拒（`SP.sol:1217`）。**但当前 Sepolia 上新用户的额度是 300e18，不是 0**（见文首「链上核实」第 3 条），所以这条只在治理把 level 1 的额度设为 0 时才会触发。

**#15 的额外要求**：
- AA 必须已经部署：`UserClient.executeGasless` 不暴露 `factory/factoryData`（`UserClient.ts:497`）。`SuperPaymasterClient.submitGaslessTransaction` 支持 factory（`packages/paymaster/src/V4/SuperPaymasterClient.ts:12-13`、`:74-75`），但只能发 ERC-20 transfer。
- #3 选 counterfactual 的 AirAccount 时，#8 和 #9 的 `execute` 要求 AA 已部署，形成先后依赖。

**变体（不计入主表）**：
- **9′ 社区代注册**：用户联系社区，社区管理员调用 `safeMintForRole(ROLE_ENDUSER, AA, data)`，质押由社区出（调用者必须持有 ROLE_COMMUNITY，`Registry.sol:340-344`）。用户签名 0，社区 1–2（approve + safeMint），等待包括"社区响应（链下）+ 链上确认 1 次"。用户发起请求这一步是 `MISSING`；执行侧 API 是 `registry.ts:392-407` 和 `faucet.ts:128-191`（`SepoliaFaucetAPI.registerEndUser`）。用 9′ 可以去掉 #6、#8、#9 和"用户付 ETH"。
- **测试网一键**：`SepoliaFaucetAPI.prepareTestAccount`（`faucet.ts:45-96`）用 admin key 完成 ETH、ENDUSER 角色、mint 三步，用户签名 0。只适用于测试网和 admin。
- **鸡生蛋问题**：#8 和 #9 发生在用户获得 SP 资格之前，所以不能用 SP 代付，只能由 EOA 付 ETH，或者用 V4、第三方 paymaster。SDK 没有把"注册前先用别的 paymaster"串起来的 API。

**MISSING（场景 2）**：#1 key、#2 ETH、#5 USDC、#9 AA 自注册、#11 xPNTs 获取（申请、购买、兑换、跨链都没有）、#14 operator 发现，另外加上场景 1 的 2 个。

**5.5.0 差异**：
- `configureOperator` 只接受 xPNTs v2（README 第 142 行），社区侧部署流程会变。
- 自动额度：v2 工厂对 V4 的每用户默认额度为 0，用户需要显式 approve 或用 R2 签名开通（spec `:204` A-10）。SP 不是 spender（spec `:197` A-3），首次使用时额度怎么开通要按 spec `:163`（`setAutoAllowance`）重新设计步骤。
- 信用默认 OFF，改为 `requestCredit` → `effectiveCreditCap`（spec `:229` C-0；README 第 134-135 行）。这样 #13 的语义会变，"信用为 0 一律拒绝"这条也会变。
- #15 继承场景 1 的 paymasterAndData tail 和 Lens 两项改动。

---

## 场景 3：充值（用户获得更多 xPNTs / aPNTs）

**账户前提**：场景 1 的稳态账户，但 xPNTs 余额不足，或者有未偿债务。

| # | 用户动作 | 系统动作 | 签名 | 等待 | 失败/恢复 | SDK file:line |
|---|---|---|---|---|---|---|
| 1 | — | 读余额、债务、可用信用 | 0 | RPC | `getAvailableCredit` 不扣 pendingDebts（见场景 2 #13） | `API` `UserClient.ts:248`（`getTokenBalance`）；`tokens.ts:403`（`getDebt`）；`superPaymaster.ts:1068`、`:572`（`pendingDebts`）。展示 UI 不在 SDK 内 |
| 2 | 申请或购买 xPNTs（找社区要、买、用 aPNTs 兑换、跨链） | — | 0 | 社区响应（链下） | — | `MISSING`：同场景 2 #11 |
| 3 | — | 社区 owner mint 给 AA，合约在 mint 时自动抵扣债务 | 用户 0；社区 1 | **链上确认（1）** | `onlyFactoryOrOwner`（`xPNTs.sol:1051`）；自动还款见 `xPNTs.sol:607-634` | `API`（社区侧）`tokens.ts:334` |
| 4 | （可选）用现有余额主动还债 | AA 调用 `xPNTs.repayDebt(amount)` | 1（EOA 交易，或一笔 gasless op 的 2 次自动签名） | **链上确认（1）** | 无债时 `NoDebtToRepay`；余额不足时 `BurnExceedsBalance`（`xPNTs.sol:578-582`） | `MISSING`：`xPNTsTokenActions.repayDebt`（`tokens.ts:416`）的 `msg.sender` 是 `account`（EOA），还的是 EOA 的债，不是 AA 的；没有 AA 级封装，需要手工编码 + `UserClient.execute` |
| 5 | — | 向 paymaster approve 或 deposit | 0 | — | 5.4.2 SP 模式下**不需要**：SP 通过 `burnFromWithOpHash` 直接扣，且只有 SP 能调用（`xPNTs.sol:484-490`） | `链上`（N/A） |

**operator 侧补充（不计入用户步骤）**：
- 买 aPNTs：`TokenSaleClient.buySelfPay({token:'APNTS'})`（`tokenSale.ts:224-288`）。
- 存入 SP：`superPaymasterActions.deposit` / `depositFor`（`superPaymaster.ts:251`、`:284`）。
- SP 的 EntryPoint ETH 押金：`entryPointActions.depositTo`（`packages/core/src/actions/entryPoint.ts:35`）。
- 以上都由 operator 或 SP owner 签名。

**V4 变体（用户自持模式，不计入）**：`PaymasterClient.approveGasToken` 再 `depositFor`（`PaymasterClient.ts:113-121`、`:100-108`），用户签 2 次，链上确认 2 次。

**MISSING（场景 3）**：#2 用户侧获取 xPNTs；#4 AA 级还债 API。

**5.5.0 差异**：
- 不再有 pending-debt 兜底，`retryPendingDebt` / `clearPendingDebt` / `pendingDebts` 被删除（README 第 140 行），#1 读 `pendingDebts` 这一项会失效。
- 债务仍在 mint 时抵扣，烧掉的是新铸的 xPNTs（spec `:684` ③）。
- #5 不再是 N/A：显式 approve 优先、自动额度兜底（spec `:196` A-2），额度续期走 `renewForSelf` 或 R2 `ACT_RENEW`（spec `:330` I2）。充值后可能还需要一步续期或授权。
- V4 的 `depositFor` 必须先显式 approve 或用 R2（spec `:204` A-10）。

---

## 场景 4：操作失败（验证被拒 / 执行 revert / postOp 失败）

**账户前提**：同场景 1，已经按场景 1 的 #2–#7 提交。

| # | 用户动作 | 系统动作 | 签名 | 等待 | 失败/恢复 | SDK file:line |
|---|---|---|---|---|---|---|
| 1 | — | 验证被拒，发生在估算阶段：SP 返回 SIG_FAILURE，bundler 报 AA34；账户签名错误报 AA24；价格过期报 AA22 或 AA32 | 0 | bundler RPC | SDK 抛 `Estimation Error: <raw json>`，**不分类** | `API` `PaymasterClient.ts:309` |
| 2 | — | 验证被拒，发生在发送阶段 | 0 | bundler RPC | fee、PVG、replacement 之外的错误一律抛 `Bundler Error: <raw>` | `API` `PaymasterClient.ts:650` |
| 3 | — | 诊断：手工调用 `dryRunValidation(userOp, maxCost)`，得到 `(ok, reasonCode)` | 0 | eth_call | 调用方要自己构造 PackedUserOperation 和 maxCost；reasonCode 是 bytes32 ASCII（`SP.sol:1558-1568`，共 10 种） | `API` `superPaymaster.ts:1019-1036`。没有接进 executeGasless |
| 4 | 看到可理解的原因和处置建议 | 把错误或 reasonCode 映射成用户提示和恢复动作 | 0 | 用户交互 | AirAccount 路径只翻译 AA32（`transfer-manager.ts:896-920`） | `MISSING`：没有 SP 错误分类和 reasonCode 解码；也没有 UI |
| 5 | — | 执行 revert：`UserOperationEvent.success=false`，gas 照收；postOp 照常运行（burn 或记债）；限频时间戳照写（`SP.sol:1360-1365`） | 0 | 同原 op | 用户为失败的调用付了 xPNTs 或背了债 | `链上` `SP.sol:1346-`、`:1444-` |
| 6 | — | 识别执行 revert，解码 revert reason | 0 | — | 见下方说明 | `MISSING`：没有 success 检查，也不解码 `UserOperationRevertReason` |
| 7 | — | postOp 结算失败，见下方说明 | 0 | 同原 op | 用户被这个 operator 拉黑，后续 op 都被拒 | `链上` `SP.sol:1444-1490`；`:1170-1176` |
| 8 | — | 读结算后的状态：是否被拉黑、pending 债务、已记录的债 | 0 | RPC | 只能手工读；`DebtRecordFailed` 事件没有解码器 | `API` `superPaymaster.ts:1202`（`userOpState`）、`:572`（`pendingDebts`）；`tokens.ts:403` |
| 9 | 申请解封或核销 | 由 owner 处理，见下方说明 | 用户 0；owner 或社区 ≥1 | 链下人工 + 链上确认 | — | `MISSING`：用户侧没有申请流程 |
| 10 | — | 传输层错误：fee 太低、PVG 太低、replacement underpriced 时自动改字段、重签、重发 | 0–4（自动重签） | bundler RPC | 最多 4 次重试 | `API` `PaymasterClient.ts:506-633` |
| 11 | — | 超时以后：查询状态或重新提交 | 0 | — | 见下方说明 | `MISSING`：没有幂等重提或重提策略 API |
| 12 | 决定是否重试 | 重试 = 重新走场景 1 | 2（+0–4） | 链上确认 1 次 | — | `MISSING`：决策 UI。执行重用场景 1 的 API |

**#6 现状**：`waitForUserOperation` 返回 receipt，但不判断 success（`PaymasterClient.ts:727-742`）。AirAccount 路径拿到 txHash 就标记 completed（`ethereum-provider.ts:331-353`；`transfer-manager.ts:871-877`）。

**#7 postOp 结算失败的两种情况**：
- `burnFromWithOpHash` 失败、但仍在信用上限内 → 改记债 `recordDebtWithOpHash`。
- 超过上限 → `userOpState[op][user].isBlocked = true`，`pendingDebts += amount`，并发出 `DebtRecordFailed`。
- postOp 整体 OOG 的情况由 validate 阶段的 `MIN_POST_OP_GAS=200k` 拦截。

**#9 owner 侧的恢复手段**：
- `retryPendingDebt` / `clearPendingDebt` 是 `onlyOwner`（`superPaymaster.ts:587`、`:605`；`SP.sol:1493-1510`）。
- 解封必须经 Registry：`SP.updateBlockedStatus` 只允许 REGISTRY 调用（`SP.sol:613-618`）。SDK 的 `superPaymasterActions.updateBlockedStatus`（`superPaymaster.ts:537`）直连 SP，预期会 revert。对应的 Registry 入口很可能是 `registry.ts:1275` 的 `updateOperatorBlacklist`，语义没有核实。

**#11 超时**：`waitForUserOperation` 返回 `{timeout:true}`（`:733-739`）。重新提交时会读新 nonce，SDK 不处理"原 op 稍后上链"这种竞态。

**MISSING（场景 4）**：#4 错误映射 + UI；#6 执行 revert 的检测和解码；#9 用户侧解封流程；#11 超时后的幂等重提；#12 重试决策 UI。

**5.5.0 差异**：
- postOp 失败后不再有 pending-debt：结算失败会让 postOp revert、执行回滚，然后由 `releaseStaleSponsorship(opHash)` 恢复 operator（README 第 140 行）。#7、#8、#9 的语义整体改变：不再有 isBlocked + pendingDebts 这条路径，`retryPendingDebt` / `clearPendingDebt` 被删除。
- #3 要改调 `SuperPaymasterLens.dryRunValidation(sp, userOp, maxCost)`（README 第 139 行；ABI `abis/SuperPaymasterLens.json`）。
- 验证阶段对 token 的三处调用在 revert 或返回畸形数据时一律 fail closed 为 sigFail（spec `:44` v3.9-rc 说明），#1 的拒绝原因会增加。

---

## 场景 5：赞助不可用（operator 押金耗尽 / operator 暂停 / 价格过期 / bundler 不可用）

**账户前提**：同场景 1，但 SP 一侧出了上述某个状况。

| # | 用户动作 | 系统动作 | 签名 | 等待 | 失败/恢复 | SDK file:line |
|---|---|---|---|---|---|---|
| 1 | — | 预检 operator：`isConfigured`、`isPaused`、`aPNTsBalance` | 0 | RPC | 见下方说明 | `API` `superPaymaster.ts:1039-1066`（`operators`，按 9 字段解码，正确） |
| 2 | — | 预检 SP 在 EntryPoint 的 ETH 押金（不足时报 AA31） | 0 | RPC | 没有自动接入 | `API` `superPaymaster.ts:1083`（`getDeposit`）；`entryPoint.ts:21`（`balanceOf`） |
| 3 | — | 预检价格：`cachedPrice`、`priceStalenessThreshold`、`priceValidUntil`、`isChainlinkStale` | 0 | RPC | PaymasterClient 只对 V4 自动检查价格（`PaymasterClient.ts:143-196`），SP 路径跳过 | `API` `superPaymaster.ts:1222`、`:1297`、`:1354`、`:1325` |
| 4 | — | 预检用户：SBT/agent 资格、是否被拉黑、限频、信用 | 0 | RPC | `getAvailableCredit` 会高估（场景 2 #13） | `API` `superPaymaster.ts:1310`、`:1202`、`:1068`；`registry.ts:713` |
| 5 | — | 完整 dry-run，得到 reasonCode | 0 | eth_call | 需要手工构造 op | `API` `superPaymaster.ts:1019-1036` |
| 6 | 看到"暂不可代付"的原因 | 把 reasonCode 或预检结果映射成提示 | 0 | 用户交互 | — | `MISSING`：没有解码器，也没有 UI |
| 7 | — | 价格过期时的恢复：任何人都可以调用 `updatePrice()` | 1（EOA 交易，要付 ETH） | **链上确认（1）** | 见下方说明 | `API` `superPaymaster.ts:639`；`SP.sol:1079`；运维侧有 `scripts/keeper.ts` |
| 8 | 换一个可用的 operator 或社区 | operator 暂停或 aPNTs 耗尽时，用户自己修不了 | 0 | 等 operator 补充（链下） | operator 侧可用的写操作：`setOperatorPaused`、`deposit`（`superPaymaster.ts:402`、`:251`） | `MISSING`：没有 operator 发现或切换 API |
| 9 | 选择用其它 paymaster（V4，自持代币） | `UserClient.executeGasless({paymasterType:'V4', gasToken})` | 2（自动，同场景 1）；前置条件是 V4 存款（场景 3 的 V4 变体，+2） | 链上确认 1 次（前置 +2） | 手工切换，没有自动 failover | `API` `UserClient.ts:446-462`；`PaymasterClient.ts:207-211`、`:435-446` |
| 10 | 选择自付 ETH | EOA 直接调用 `AA.execute`，EOA 付 ETH | 1（EOA 交易） | **链上确认（1）** | 见下方说明 | `API` `UserClient.ts:155-169`；AirAccount 用 `usePaymaster:false`，要求 AA 自己有 ETH（`transfer-manager.ts:272-279`） |
| 11 | — | bundler 不可用：切换 bundler | 0 | — | 见下方说明 | `MISSING`：没有 bundler failover |

**#1 不要用的那个版本**：`@aastar/paymaster` 里的 `checkEligibility`（`packages/paymaster/src/SuperPaymaster/index.ts:49-90`）用错了下标：`[0]` 被当成 token，实际是 aPNTsBalance；`[2]` 被当成 isConfigured，实际是 isPaused；`[3]` 被当成 isPaused，实际是 xPNTsToken（`:65-67`）。异常会被吞掉，返回 `eligible:false`，所以结果不可信。

**#7 的条件**：
- 只有在 Chainlink 可用时有效。Chainlink 也不可用时，要走 DVT 或紧急价格路径（`updatePriceDVT` / `emergencySetPrice`），那是 owner 或 aggregator 的事。
- AirAccount 路径建议的 `checkPriceFreshness` 调用的是 `cachedPriceTimestamp()`（`paymaster-manager.ts:30-35`、`:97-123`）。SDK 自带的 SuperPaymaster 和 Paymaster ABI 里都没有这个函数，预期会抛错（未链上验证）。

**#10 的自动回退**：唯一的自动回退是 bundler 返回 -32601 时，静默改由 EOA 调用 `handleOps`（`PaymasterClient.ts:635-648`）。如果调用方没配 `bundlerClient`，`UserClient` 会把 RPC 节点的 URL 当成 bundler URL（`UserClient.ts:493`、`:526`），这个回退就会被触发：用户以为是 gasless，实际是 EOA 先垫付了 ETH。

**#11 bundler 不可用时的表现**：
- `PaymasterClient` 只接受单个 `bundlerUrl`，`fetch` 的网络错误原样抛出。
- AirAccount 的 `bundlerProvider` 也只有一个（`ethereum-provider.ts:110-115`），是否配置了 viem 的 fallback transport 取决于调用方，没有核实。
- 唯一的绕行是 #10。

**MISSING（场景 5）**：#6 原因映射 + UI；#8 operator 发现和切换；#11 bundler failover。另外 #1–#5 的预检**都没有接进** executeGasless，要调用方自己编排。

**5.5.0 差异**：
- #5 改用 `SuperPaymasterLens.dryRunValidation`（README 第 139 行）。
- token 层增加了应急路径：communityOwner 可以 `emergencyRevokePaymaster`，然后切到备用 SP（S-6）或换 SP（S-3）（spec `:615`）。这样"赞助不可用"多出一类原因：SP 被 token 层撤销。#8 需要新增读取 token 当前 SP 的步骤。
- 用户可以自己调用 `disableSpenderForSelf` / `revokeCredit`（spec `:615`）。这会让"自己关掉了代付"也成为不可用的一种原因。

---

## 附：资格获取、代币获取、续期与撤销（显式覆盖）

| 项 | 用户动作 / 系统动作 | 签名 | 等待 | 结果与注意 | SDK file:line |
|---|---|---|---|---|---|
| 资格：自注册 ENDUSER | 见场景 2 的 #8、#9 | 2（EOA 交易） | 链上 2 次 | 现有 API 有缺陷 | `MISSING`（见场景 2 #9） |
| 资格：社区代注册 | 社区调用 `safeMintForRole` | 用户 0 | 社区响应 + 链上 1 次 | 用户发起请求的接口缺失 | `registry.ts:392-407` |
| 资格：agent 通道（ERC-8004） | 读 `isRegisteredAgent` / `isEligibleForSponsorship` | 0 | RPC | 是 SBT 之外的另一条资格通道（`SP.sol:1600-1602`）；注册流程不在本文范围 | `agent.ts:33`、`:46` |
| 资格：用户自己 mint SBT | `UserClient.mintSBT` / `UserLifecycle.claimSBT` 从 AA 调用 `MySBT.mintForRole` | 1 | 链上 1 次 | **预期 revert**：`mintForRole` 是 `onlyRegistry`（`MySBT.sol:230-235`） | `MISSING`（API `UserClient.ts:209-224`、`UserLifecycle.ts:198` 不可用） |
| 资格：用户自己质押 | `UserClient.stakeForRole` 编码 `lockStake(...)` | 1 | 链上 1 次 | **预期 revert**：5.4.2 的 GTokenStaking 没有 `lockStake`，只有 `lockStakeWithTicket` / `topUpStake`（`Staking.sol:108`、`:184`）；质押应由 Registry 在 `registerRole` 内完成 | `MISSING`（API `UserClient.ts:265-280` 不可用） |
| 代币：GToken | `TokenSaleClient.buySelfPay` / `buyGasless` | 2 | 链上 2 次 / relayer + 链上 1 次 | 需要 USDC，获取 USDC 的步骤缺失 | `tokenSale.ts:224`、`:296` |
| 代币：xPNTs | 只能由社区 mint | 社区 1 | 社区响应 + 链上 1 次 | 用户侧的购买、兑换、跨链、等待都没有 API | `MISSING`（用户侧）；`tokens.ts:334`（社区侧） |
| 代币：aPNTs | `TokenSaleClient` 购买 | 2 | 链上 2 次 | 给 operator 存 SP 用，不是终端用户付 gas 的币 | `tokenSale.ts:224` |
| 撤销：退出社区 | AA 调用 `MySBT.leaveCommunity(comm)` | 1 | 链上 1 次 | 只停用 membership（`MySBT.sol:366-368`）；**不清 `SP.sbtHolders`**，所以用户**仍然可以被代付**。`sbtHolders` 只在 `exitRole` 退掉最后一个角色时清（`Registry.sol:306-318`） | `UserClient.ts:337-352`；`sbt.ts:664` |
| 撤销：退出角色 | AA 调用 `Registry.exitRole(ROLE_ENDUSER)` | 1 | 链上 1 次 | 锁定期未满时 `LockNotMet`（`Registry.sol:328-333`）；按 exit fee 扣除后退还 GToken；如果是最后一个角色，会 burn SBT 并把 `sbtHolders` 置 false（非致命，`:306-318`） | `UserClient.ts:320-335`；`registry.ts:480`；`UserLifecycle.ts:266` |
| 撤销：用户自己 burn SBT | `sbt.burnSBT` | 1 | — | **预期 revert**：`onlyRegistry`（`MySBT.sol:349`）。只能通过 `exitRole` | `MISSING`（用户侧） |
| 撤销：用户自己解除质押 | `UserClient.unstakeFromRole` / `UserLifecycle.unstakeAll` | 1 | — | **预期 revert**：`unlockAndTransfer` 是 `onlyRegistry`（`Staking.sol:217-220`），由 `exitRole` 内部调用 | `MISSING`（API `UserClient.ts:282-297`、`UserLifecycle.ts:275` 不可用） |
| 撤销：社区撤销成员 | `CommunityClient.revokeMembership`，内部调用 `burnSBT` | 社区 1 | — | 同样受 `onlyRegistry` 约束，**预期 revert** | `packages/enduser/src/CommunityClient.ts:360-372`（不可用） |
| 信用额度 | 读 `getCreditLimit`，等级由 `globalReputation` 对照 `levelThresholds` 得出 | 0 | RPC | 用户不能自己申请提额；提额来自声誉更新（BLS 批量更新，`registry.ts:755`）或 admin 调用 `setCreditTier`（`:1242`） | `registry.ts:713`；`UserLifecycle.ts:211-251` |
| 续期 | — | — | — | 5.4.2 的 SDK 和合约里没有 SBT 或 membership 过期、续期的概念（只有 `recordActivity`，见 `sbt.ts:714`，权限未核实） | `MISSING` / N/A |

**续期与撤销的 5.5.0 差异**：
- 新增自动额度续期：`renewForSelf` / R2 `ACT_RENEW`，K=1 次 SP 转述续期（spec `:330`）。
- 新增信用申请和撤销：`requestCredit` / `revokeCredit`，撤销只影响新预留（spec `:233` C-4）。
- 新增 `disableSpenderForSelf`（spec `:615`）。
- 这些在 dbb3c47f 的 SDK 里都没有。

---

## 汇总表

**计数方法**：
- 对每个场景的主表逐行按 `SDK file:line` 列的前缀计数：`API`、`API⚠` 计入"有 SDK API"，`MISSING` 计入 MISSING，`链上` 不计。
- 场景 2 的 #15 和场景 4 的 #12 是"重走场景 1"，按 S1 的数值单独加上：API 7，MISSING 2，用户签名 2，链上等待 1。
- "用户签名"只计用户自己 key 的签名事件（自动签名也算）；社区、owner、operator 的签名单列；重试时的 0–4 次重签写成 "+0–4"，不计入基数。
- "链上等待"只计新增的交易或 UserOp 确认。

| 场景 | 有 SDK API（API + API⚠） | MISSING | 链上内部（不计） | 用户签名事件 | 链上等待 | 逐行依据 |
|---|---|---|---|---|---|---|
| 1 主路径（UserClient → PaymasterClient） | 7（7 + 0） | 2 | 1 | 2（+0–4） | 1 | API：#2–#7、#9；MISSING：#1、#10；链上：#8。签名：#3、#6 各 1。等待：#8 |
| 1 变体 B（AirAccount KMS / passkey） | 4（2 + 2） | 1 | 0 | 2（tier ≥ 2 时 +DVT BLS 1） | 1 | API：B3、B5；API⚠：B1、B4；MISSING：B2。签名：B2（用户 passkey）、B3（KMS）。等待：B4 |
| 2 首次使用（自注册主路径，含 S1） | 15 = 自身 8（6 + 2）+ S1 7 | 8 = 自身 6 + S1 2 | 1（S1） | 7 = 自身 5 + S1 2（+0–4）；另有社区 1 | 7 = 自身 6 + S1 1 | API：#3、#4、#6、#8、#10、#12（社区侧）；API⚠：#7、#13；MISSING：#1、#2、#5、#9、#11、#14。签名：#4 1 + #6 2 + #8 1 + #9 1。等待：#4 1 + #6 2 + #8 1 + #9 1 + #12 1 |
| 3 充值 | 2（2 + 0） | 2 | 1（#5 N/A） | 0（选做 #4 还债 +1）；另有社区 1 | 1（选做 #4 +1） | API：#1、#3；MISSING：#2、#4。签名：#3 由社区签。等待：#3 |
| 4 操作失败 | 5（5 + 0） | 5 | 2 | 0（+0–4 自动重签）；选择重试 +2 | 0（失败发生在原 op 内）；选择重试 +1 | API：#1、#2、#3、#8、#10；MISSING：#4、#6、#9、#11、#12；链上：#5、#7 |
| 5 赞助不可用 | 8（8 + 0） | 3 | 0 | 视处置路径而定：#7 为 1；#9 为 2（前置条件另 +2）；#10 为 1 | 视处置路径而定：#7 为 1；#9 为 1（前置条件另 +2）；#10 为 1 | API：#1–#5、#7、#9、#10；MISSING：#6、#8、#11 |

注意：场景 2 里 #9 被计为 MISSING。原因是 SDK 有三个看起来能用的 API，但读码判断全部走不通（见场景 2 的 #9）。如果按"API 存在"计数，场景 2 就是有 SDK API 16、MISSING 7。附表中其它"预期 revert"的 API 也都按 MISSING 处理。

**链下等待（不在上表，供 GOMS 结构参考）**：
- 场景 1：bundler RPC。变体 B 还有 KMS（tier ≥ 2 时加 DVT）。
- 场景 2：外部 faucet 和 onramp（#2、#5）；社区响应（#11）。
- 场景 3：社区响应。
- 场景 4：owner 人工处理（#9）。
- 场景 5：operator 补充资金（#8）。

---

## 读码中顺带发现的 SDK 缺陷（与任务分解直接相关，均为静态推断，未修改代码）

1. `createEndUserClient().executeGasless` 的 postOp 写死 50k，低于 SP 5.4.2 的 `MIN_POST_OP_GAS` 200k，预期 AA34（`packages/sdk/src/clients/endUser.ts:259` 对照 `SP.sol:86`、`:1170-1176`）。它还由 EOA 直接调用 `handleOps`，没有走 bundler（`:315-344`）。
2. `getSuperPaymasterMiddleware` 的默认 postOp 是 10k（`packages/paymaster/src/SuperPaymaster/index.ts:13`），同样低于 200k。
3. 三处自注册都走不通：`UserClient.registerAsEndUser` 编码了不存在的 `registerRoleSelf(bytes32,bytes)`（`UserClient.ts:409-413`）；`joinAndActivate` 在编码期就抛错（`endUser.ts:161-168`）；`registryActions.registerRoleSelf` 只能为 EOA 注册。
4. `checkEligibility` 的 operators 下标错位（`packages/paymaster/src/SuperPaymaster/index.ts:65-67`）。
5. `RequirementChecker` 的地址键名与调用方不一致（`gtoken`/`mysbt` 对 `gToken`/`mySBT`）。
6. 两条路径都不检查 `receipt.success`。
7. `getFeeFromReceipt` 不支持 SP。
8. `UserClient.executeGasless` 不透传 `airAccountSig`。
9. `UserLifecycle.executeGaslessTx` 的 `operator` 是可选参数（`UserLifecycle.ts:144`）。CREDIT 策略下不传 operator 时，`PaymasterClient` 会给 SP 地址拼 V4 布局（`PaymasterClient.ts:201-212`、`:430-446` 以 `options?.operator` 分支）。
10. 预期 revert 的用户侧 API（目标函数受 `onlyRegistry` 限制，或函数不存在）：`mintSBT` / `claimSBT`、`stakeForRole`、`unstakeFromRole` / `unstakeAll`、`CommunityClient.revokeMembership`、`superPaymasterActions.updateBlockedStatus`（调用者须为 Registry）。
11. AirAccount 的 `paymaster-manager` 识别 SP 时 ABI 形状不对，且 operator 固定取 SP 的 `owner()`；`checkPriceFreshness` 调用的函数在 SDK 自带 ABI 中不存在。
12. `getAvailableCredit`（合约 view）与验证阶段的信用门槛口径不一致（是否扣 pendingDebts），这是 SP 合约侧的问题，SDK 原样暴露。

## SP 仓文档与 SDK 代码的出入（这些文档已过期）

- `docs/SDK-E2E-Scenario-Guide.md`（标注为 V5.3.0，2026-03-29；最后修改 `5480a46c` 2026-06-03）：
  - Sepolia 的 SP 地址 `0x829C…` 与 SDK canonical `0x09DF0d2e…`（`packages/core/src/addresses.ts:94`）不同。
  - 文中写 context 是 `abi.encode(operator,user,initialAPNTs)`，5.4.2 实际是 `(token,user,aPNTsAmount,userOpHash,operator)`（`SP.sol:1235`）。
  - 文中写 postOp 调用 `_consumeCredit`，5.4.2 实际是 `_recordDebt`。
  - "Common Error Patterns" 列了 `SBTRequired` / `PriceStale` 等 revert 名，但 5.4.2 的验证阶段不 revert，只返回 SIG_FAILURE（由 bundler 报 AA34），原因要通过 `dryRunValidation` 的 reasonCode 获取。
  - 伪代码里 postOp gas 填 100000，按 5.4.2 会被拒。
  - 伪代码由 EOA 直接调用 `handleOps`，与 `endUser.ts` 的做法相同。
  - `configureOperator` 写成三个参数，与 SDK action 的两个参数（`superPaymaster.ts:385`）不一致。
- `docs/Scenario_SDK_Mapping.md`（最后修改 `b9ee2175` 2025-12-23）引用的包 `@aastar/superpaymaster`、`@aastar/finance`、`@aastar/registry`、`@aastar/paymaster-v4` 在 SDK 的 `packages/` 下都不存在。这份文档的结论"SDK 已完全承载所有能力"与上文的 MISSING 清单矛盾。

## 未能核实的内容

- 子 agent 阶段**没有任何链上读写**。之后主代理补读的值见文首「链上核实」：SP 为 5.4.2、Registry 为 **5.8.0**、`creditTierConfig[1]=300e18`、新地址额度 300e18、`registerRoleSelf` 不在 Registry 字节码中。**仍未核实**：`roleConfigs(ROLE_ENDUSER)` 的 minStake、ticketPrice、lockDuration（`ROLE_ENDUSER()` 在 5.8.0 上 `eth_call` revert，需要换成另一种读法）；官方社区 operator 是否已配置、未暂停、余额充足；正文中 `Registry.sol` 的其余行号是否与 5.8.0 一致。
- 上文所有"预期 revert / 预期 AA34 / 预期抛错"都是读码推断，没有 eth_call 或 simulate 验证。viem 对 `paymaster-manager` 那个 4 字段 ABI 实际怎么解码，也没有运行验证。
- bundler 的错误码和错误字符串因厂商而异（Pimlico、Alchemy、Candide）。重试分支能否命中，取决于具体 bundler。
- KMS、DVT、relayer、社区响应、外部 faucet 和 onramp 的耗时都没有测量。
- 以下逻辑没有逐行追踪：AirAccount 的 `submitPreparedTransfer` 和 tier2/3 签名组装、`PasskeyManager.register` 的后端交互、`recordActivity` 与 `updateOperatorBlacklist` 的权限和语义、`ForceExitModule`（L2 强制退出，与代币 bridge 无关）。
- 5.5.0 部分只读了 `v5.5.0-rc.4` 的 README（第 132-150 行）和 `docs/design/aoa-balance-mode/03-final-spec.md`，没有读 5.5.0 的合约源码，也没有读 `SuperPaymasterLens`。用户提到的"bounded auto-allowance 之前先用显式 ERC-20 allowance"依据的是 spec 的 A-2（`:196`）；README 的 5.5.0 表格里没有这一条。
